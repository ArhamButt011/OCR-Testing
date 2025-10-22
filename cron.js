const cron = require("node-cron");
const fetch = require("node-fetch");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const isBetween = require("dayjs/plugin/isBetween");
const fs = require("fs");
const path = require("path");
const { default: PQueue } = require("p-queue");

dayjs.extend(utc);
dayjs.extend(isBetween);

// ======== CONFIG (env-tunable) ========
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://fzi6t0m8gas6eb-8080.proxy.runpod.net/api";
const OCR_URL = process.env.OCR_URL || "https://uygeoeqvd7iqpg-19123-8080.proxy.runpod.net/run-ocr";
const PROXY_DEADLINE_MS = Number(process.env.PROXY_DEADLINE_MS || 95000);

const BATCH_SIZE = Number(process.env.OCR_BATCH_SIZE || 3);   
const FALLBACK_BATCH_SIZE = Number(process.env.FALLBACK_BATCH_SIZE || 2);
const PRIMARY_CONCURRENCY = Number(process.env.PRIMARY_CONCURRENCY || 1);
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 130000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 5000);
const OCR_RETRIES = Number(process.env.OCR_RETRIES || 3);
const OCR_RETRY_BASE_BACKOFF = Number(process.env.OCR_RETRY_BASE_BACKOFF || 1000);
const PREFLIGHT_URL_CHECK = (process.env.PREFLIGHT_URL_CHECK || "true") === "true";
const SAVE_CHUNK_SIZE = Number(process.env.SAVE_CHUNK_SIZE || 50);

const OCR_COOLDOWN_MS = Number(process.env.OCR_COOLDOWN_MS || 10000); 
const OCR_GC_URL = process.env.OCR_GC_URL || ""; 

console.log("OCR Cron Job Script Initialized (deferred-fallback mode)");

const scheduledTasks = new Map();           
const jobRunning = new Map();               
let isInitialLoad = true;
let currentJobsHash = "[]";                 

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function postJsonWithRetry(url, jsonBody, { tries = OCR_RETRIES, timeout = OCR_TIMEOUT_MS } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const requestTimeout = Math.min(timeout, PROXY_DEADLINE_MS);

      const res = await fetchWithTimeout(
        url,
        { method: "POST", headers: { "Content-Type": "application/json", "Connection": "close" }, body: JSON.stringify(jsonBody) },
        requestTimeout
      );
      const text = await res.text();
      if (!res.ok) {
        console.error(`OCR HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
        throw new Error(`HTTP_${res.status}`);
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("OCR response not JSON:", text.slice(0, 200));
        throw new Error("NON_JSON_RESPONSE");
      }
    } catch (e) {
      lastErr = e;
      const backoff = OCR_RETRY_BASE_BACKOFF * i;
      console.warn(`postJsonWithRetry attempt ${i} failed: ${e.message}. Backing off ${backoff}ms...`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}


async function isUrlOk(u) {
  if (!PREFLIGHT_URL_CHECK) return true;
  try {
    const res = await fetchWithTimeout(u, { headers: { Range: "bytes=0-0" } }, 5000);
    return res.ok;
  } catch { return false; }
}

const getDBConnectionType = () => {
  try {
    const filePath = path.join(__dirname, "db-config.json");
    if (!fs.existsSync(filePath)) {
      console.error("db-config.json not found.");
      return;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const config = JSON.parse(raw);
    const dbType = config.dbType;
    console.log("DB Type:", dbType);
    return dbType;
  } catch (err) {
    console.error("Error reading DB config:", err.message);
  }
};

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// --- added: tiny helper to let OCR server free VRAM between batches ---
async function cooldownAndGc() {
  if (OCR_GC_URL) {
    try {
      await fetchWithTimeout(OCR_GC_URL, { method: "POST", headers: { "Connection": "close" } }, 5000);
      console.log("• Invoked OCR GC endpoint.");
    } catch (e) {
      console.warn("OCR GC endpoint failed:", e.message);
    }
  }
  if (OCR_COOLDOWN_MS > 0) {
    await sleep(OCR_COOLDOWN_MS);
  }
}

// ======== FIELD NORMALIZATION (prevents nulls) ========
// Safely get first non-empty field from aliases
function firstOf(obj, aliases, def = "") {
  for (const key of aliases) {
    if (obj && obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== "") {
      return obj[key];
    }
  }
  return def;
}
function toInt(x, def = 0) {
  if (x === null || x === undefined) return def;
  const s = String(x).replace(/[, ]/g, "");
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : def;
}
function toYesNoY(val) {
  const s = String(val || "").trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(s)) return "Y";
  if (["n", "no", "false", "0"].includes(s)) return "N";
  return "N";
}

// Map OCR record -> processed record
function toProcessedRecord(d, fileId, job, fileData, base_url) {
  if (!fileData || !fileData.FILE_NAME) return null;

  const filePath = `${base_url}/access-file?filename=${encodeURIComponent(fileData.FILE_NAME)}`;

  // Normalize common aliases to avoid nulls
  const blNumber = String(firstOf(d, ["B_L_Number", "BL_Number", "BOLNo", "BOL_No", "B_LNo", "B_L"], ""));
  const podDate = firstOf(d, ["POD_Date", "PODDate", "Proof_Of_Delivery_Date", "Delivery_Date"], "");
  const podSignature = firstOf(d, ["Signature_Exists", "Signature", "Sign_Exists"], "unknown");

  const issuedQty = toInt(firstOf(d, ["Issued_Qty", "IssuedQty", "Shipped_Qty", "Total_Issued"], 0));
  const receivedQty = toInt(firstOf(d, ["Received_Qty", "ReceivedQty", "Total_Received", "TOTAL_CARTONS_RECEIVED"], 0));
  const damageQty = toInt(firstOf(d, ["Damage_Qty", "Damaged_Qty", "DamageQty"], 0));
  const shortQty = toInt(firstOf(d, ["Short_Qty", "ShortQty"], 0));
  const overQty = toInt(firstOf(d, ["Over_Qty", "OverQty"], 0));
  const refusedQty = toInt(firstOf(d, ["Refused_Qty", "RefusedQty"], 0));

  const customerOrderNum = firstOf(d, ["Customer_Order_Num", "CustomerOrderNum", "Order_No"], "");
  const stampExists = firstOf(d, ["Stamp_Exists", "StampExists"], "");
  const statusRaw = firstOf(d, ["Status", "OCR_Status"], "");
  const statusMap = { failed: "failure", valid: "valid", "partially valid": "partiallyValid", partial: "partiallyValid" };
  const recognitionStatus = statusMap[String(statusRaw).toLowerCase()] || "null";
  const sealIntact = toYesNoY(firstOf(d, ["Seal_Intact", "SealIntact", "Seal_Status"], "no"));

  return {
    _id: fileId,
    jobId: job._id,
    fileId: fileId,
    pdfUrl: decodeURIComponent(new URL(filePath).searchParams.get("filename") || ""),
    deliveryDate: new Date().toISOString().split("T")[0],
    noOfPages: 1,

    blNumber,
    podDate,
    podSignature,

    totalQty: issuedQty,
    received: receivedQty,
    damaged: damageQty,
    short: shortQty,
    over: overQty,
    refused: refusedQty,

    customerOrderNum,
    stampExists,
    finalStatus: "valid",
    reviewStatus: "unConfirmed",
    recognitionStatus,

    breakdownReason: "none",
    reviewedBy: "OCR Engine",
    uptd_Usr_Cd: "OCR",
    cargoDescription: "Processed from OCR API.",
    none: "N",
    sealIntact,
  };
}

// ======== HASH + DIFF (safe rescheduling) ========
function jobConfigOf(job) {
  return {
    id: String(job._id),
    everyTime: job.everyTime,
    selectedDays: Array.isArray(job.selectedDays) ? [...job.selectedDays].sort() : [],
    fromTime: job?.pdfCriteria?.fromTime ?? "",
    toTime: job?.pdfCriteria?.toTime ?? "",
    dayOffset: job.dayOffset,
    fetchLimit: job.fetchLimit,
  };
}
function makeJobsHash(jobs) {
  const arr = jobs.map(jobConfigOf).sort((a, b) => (a.id > b.id ? 1 : -1));
  return JSON.stringify(arr);
}
function compareJobs(newJobs, scheduledMap, prevHash) {
  const prev = JSON.parse(prevHash);
  const prevById = new Map(prev.map((j) => [j.id, j]));
  const added = [], removed = [], changed = [], kept = [];
  const newById = new Map(newJobs.map((j) => [String(j._id), j]));
  const scheduledIds = new Set(scheduledMap.keys());
  for (const id of scheduledIds) if (!newById.has(id)) removed.push(id);
  for (const job of newJobs) {
    const cfg = jobConfigOf(job);
    const had = prevById.get(cfg.id);
    if (!had) added.push(job);
    else (JSON.stringify(had) === JSON.stringify(cfg) ? kept : changed).push(job);
  }
  return { added, removed, changed, kept };
}

function clearScheduledJobs() {
  for (const [jobId, task] of scheduledTasks.entries()) {
    try { task.stop(); task.destroy?.(); } catch { }
    scheduledTasks.delete(jobId);
  }
}

// ======== PRIMARY PASS (no per-file fallback here) ========
async function processPrimaryBatch(batch, job, base_url) {
  const payload = [];
  const fileMetaDataMap = new Map();
  const forFallback = [];

  await Promise.all(batch.map(async (item) => {
    const fileId = item.FILE_ID || item.file_id;
    const fileTable = item.FILE_TABLE || item.file_table;
    try {
      const fileRes = await fetchWithTimeout(`${base_url}/pod/file?fileId=${fileId}&fileTable=${fileTable}`);
      if (!fileRes.ok) throw new Error(`file meta ${fileId} HTTP_${fileRes.status}`);
      const fileData = await fileRes.json();
      fileMetaDataMap.set(fileId, fileData);

      await fetchWithTimeout(
        `${base_url}/pod/store`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: fileData.FILE_ID }) }
      );

      const filePath = `${base_url}/access-file?filename=${encodeURIComponent(fileData.FILE_NAME)}`;
      if (await isUrlOk(filePath)) {
        payload.push({ _id: fileId, file_url_or_path: filePath, FILE_TABLE: fileTable });
      } else {
        console.warn(`Preflight failed; defer to fallback: ${fileId}`);
        forFallback.push({ _id: fileId, file_url_or_path: filePath, FILE_TABLE: fileTable });
      }
    } catch (e) {
      console.warn(`Meta/store failed; defer to fallback: ${fileId} (${e.message})`);
      forFallback.push({ _id: fileId, file_url_or_path: "", FILE_TABLE: fileTable });
    }
  }));

  if (payload.length === 0) {
    return { processed: [], failedForFallback: forFallback.length ? forFallback : batch.map(it => ({ _id: it.FILE_ID || it.file_id, FILE_TABLE: it.FILE_TABLE || it.file_table })) };
  }

  // one OCR call for the batch
  let ocrData;
  try {
    ocrData = await postJsonWithRetry(OCR_URL, payload, { tries: OCR_RETRIES, timeout: OCR_TIMEOUT_MS });
  } catch (e) {
    console.warn(`Primary OCR failed for batch (${e.message}); deferring entire payload to fallback.`);
    return { processed: [], failedForFallback: [...forFallback, ...payload] };
  }

  if (!Array.isArray(ocrData)) {
    console.warn(`OCR returned non-array; deferring payload to fallback.`);
    return { processed: [], failedForFallback: [...forFallback, ...payload] };
  }

  console.log(`OCR returned ${ocrData.length} item(s) for this batch`);

  const byId = new Map(ocrData.map(x => [x._id, x]));
  const processed = [];
  const failedForFallback = [...forFallback];

  for (const rec of payload) {
    const d = byId.get(rec._id);
    const fileData = fileMetaDataMap.get(rec._id);
    if (d && fileData && fileData.FILE_NAME) {
      const pr = toProcessedRecord(d, rec._id, job, fileData, base_url);
      if (pr) processed.push(pr);
      else failedForFallback.push(rec); // keep for fallback if mapping failed
    } else {
      failedForFallback.push(rec);
    }
  }

  return { processed, failedForFallback };
}

// ======== FALLBACK PASS (after all primary batches complete) ========
async function processFallbackBatches(failedList, job, base_url) {
  const processed = [];
  const stillFailed = [];
  const groups = chunk(failedList, FALLBACK_BATCH_SIZE);

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];

    // Retry OCR for this group
    let ocrData;
    try {
      ocrData = await postJsonWithRetry(OCR_URL, group, { tries: OCR_RETRIES, timeout: OCR_TIMEOUT_MS });
    } catch (e) {
      console.warn(`Fallback OCR group ${gi + 1}/${groups.length} failed (${e.message}). Marking group failed.`);
      stillFailed.push(...group);
      // --- added: cooldown/GC even on failure ---
      await cooldownAndGc();
      continue;
    }
    if (!Array.isArray(ocrData)) {
      console.warn(`Fallback OCR group ${gi + 1} returned non-array. Marking failed.`);
      stillFailed.push(...group);
      await cooldownAndGc();
      continue;
    }

    // Rebuild metadata for each file to avoid nulls
    const fileMetaDataMap = new Map();
    await Promise.all(group.map(async (rec) => {
      try {
        const fileRes = await fetchWithTimeout(`${base_url}/pod/file?fileId=${rec._id}&fileTable=${rec.FILE_TABLE || "XTI_FILE_POD_T"}`);
        if (!fileRes.ok) throw new Error(`file meta ${rec._id} HTTP_${fileRes.status}`);
        const fileData = await fileRes.json();
        fileMetaDataMap.set(rec._id, fileData);
      } catch (e) {
        console.warn(`Fallback meta fetch failed for ${rec._id}: ${e.message}`);
      }
    }));

    const byId = new Map(ocrData.map(x => [x._id, x]));
    for (const rec of group) {
      const d = byId.get(rec._id);
      const fileData = fileMetaDataMap.get(rec._id);
      if (d && fileData && fileData.FILE_NAME) {
        const pr = toProcessedRecord(d, rec._id, job, fileData, base_url);
        if (pr) processed.push(pr);
        else stillFailed.push(rec);
      } else {
        stillFailed.push(rec);
      }
    }

    // --- added: cooldown/GC between fallback groups ---
    await cooldownAndGc();
  }

  return { processed, stillFailed };
}

// ======== SAVE HELPERS ========
async function saveProcessedRecords(base_url, records) {
  if (!records.length) return;

  // 1) Auto-confirm step (optional)
  try {
    const confirmRes = await fetchWithTimeout(`${base_url}/settings/auto-confirmation`);
    const confirmJson = await confirmRes.json().catch(() => ({}));
    if (confirmJson?.isAutoConfirmationOpen) {
      for (const part of chunk(records, SAVE_CHUNK_SIZE)) {
        const res = await fetchWithTimeout(
          `${base_url}/pod/update`,
          { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ocrDataList: part }) }
        );
        const text = await res.text();
        if (!res.ok) console.error(`/pod/update HTTP_${res.status}: ${text.slice(0, 300)}`);
      }
    }
  } catch (e) {
    console.warn(`Auto-confirmation step failed: ${e.message}`);
  }

  // 2) Persist processed data
  for (const part of chunk(records, SAVE_CHUNK_SIZE)) {
    const res = await fetchWithTimeout(
      `${base_url}/process-data/save-data`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(part) }
    );
    const text = await res.text();
    if (!res.ok) console.error(`/process-data/save-data HTTP_${res.status}: ${text.slice(0, 300)}`);
    for (const entry of part) console.log(`File ${entry.fileId} processed (saved).`);
  }
}

// ======== JOB RUNNER ========
async function runOcrForJob(job, base_url) {
  console.log(`OCR script started for job ${job._id}`);
  const dbConnectionType = getDBConnectionType();
  console.log("db connection ->", dbConnectionType);

  try {
    const retrieveRes = await fetchWithTimeout(
      `${base_url}/pod/retrieve?dayOffset=${job.dayOffset}&fetchLimit=${job.fetchLimit}`
    );
    if (!retrieveRes.ok) {
      console.error(`retrieve HTTP_${retrieveRes.status}`);
      return;
    }
    const fileList = await retrieveRes.json();
    if (!Array.isArray(fileList) || fileList.length === 0) {
      console.log("No files to process for this job.");
      return;
    }
    console.log(`Total files: ${fileList.length}`);

    const batches = chunk(fileList, BATCH_SIZE);
    console.log(`Chunked into ${batches.length} batches, last batch size = ${batches[batches.length - 1]?.length || 0}`);
    const primaryQueue = new PQueue({ concurrency: PRIMARY_CONCURRENCY });

    let totalProcessed = 0;
    let totalDeferred = 0;
    const fallbackBucket = [];

    // STREAM-SAVE PER BATCH
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      primaryQueue.add(async () => {
        console.log(`Primary batch ${i + 1}/${batches.length} (size=${batch.length})`);

        const { processed, failedForFallback } = await processPrimaryBatch(batch, job, base_url);

        // Save successes from this batch immediately
        if (processed && processed.length) {
          await saveProcessedRecords(base_url, processed);
          totalProcessed += processed.length;
        }

        // Accumulate fallback candidates
        if (failedForFallback && failedForFallback.length) {
          fallbackBucket.push(...failedForFallback);
          totalDeferred += failedForFallback.length;
        }

        // Progress heartbeat
        console.log(
          `Progress so far → processed=${totalProcessed}, deferred=${totalDeferred}, batch=${i + 1}/${batches.length}`
        );

        // --- added: let OCR server free GPU memory between batches ---
        await cooldownAndGc();
      });
    }

    // Wait until ALL primary batches finish
    await primaryQueue.onIdle();
    console.log(`Primary pass complete. Processed (saved): ${totalProcessed}, Deferred: ${fallbackBucket.length}`);

    // Fallback pass on accumulated failures
    if (fallbackBucket.length > 0) {
      console.log(`Starting fallback pass for ${fallbackBucket.length} file(s)...`);
      const { processed: fbProcessed, stillFailed } = await processFallbackBatches(fallbackBucket, job, base_url);
      console.log(`Fallback complete. Recovered: ${fbProcessed.length}, Still failed: ${stillFailed.length}`);

      // Save fallback recoveries
      if (fbProcessed.length) await saveProcessedRecords(base_url, fbProcessed);

      // Optional: persist stillFailed somewhere
      if (stillFailed.length) {
        console.warn(`Unrecoverable after fallback: ${stillFailed.map(x => x._id).join(", ")}`);
        // TODO: POST to /process-data/save-failures if you have it
      }
    }

    console.log(`All processing completed for job: ${job._id}`);
  } catch (err) {
    console.error("OCR job error:", err.message);
  }
}

// ======== CRON/SCHEDULING (promise guard) ========
function getCronExpressionFromTime(timeStr) {
  const [hours, minutes] = String(timeStr).split(":").map(Number);
  if (hours === 0 && minutes > 0) return `*/${minutes} * * * *`;
  if (minutes === 0 && hours > 0) return `0 */${hours} * * *`;
  if (hours > 0 && minutes > 0) return `${minutes} */${hours} * * *`;
  return "* * * * *";
}

function scheduleOne(job, base_url, wmsUrl, userName, passWord) {
  const cronExp = getCronExpressionFromTime(job.everyTime);
  if (!cron.validate(cronExp)) {
    console.error(`Invalid cron expression for job ${job._id}: ${cronExp}`);
    return;
  }

  const key = String(job._id);

  const task = cron.schedule(cronExp, async () => {
    const existing = jobRunning.get(key);
    if (existing) {
      console.log(`↺ Skip run: previous run still active for job ${key}`);
      return;
    }

    const runPromise = (async () => {
      try {
        const now = new Date();
        const currentDay = now.toLocaleString("en-US", { weekday: "long" });
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        const fromTime = new Date(job.pdfCriteria.fromTime);
        const toTime = new Date(job.pdfCriteria.toTime);
        const fromTimeStr = `${String(fromTime.getUTCHours()).padStart(2, "0")}:${String(fromTime.getUTCMinutes()).padStart(2, "0")}`;
        const toTimeStr = `${String(toTime.getUTCHours()).padStart(2, "0")}:${String(toTime.getUTCMinutes()).padStart(2, "0")}`;

        const isDaySelected = job.selectedDays.includes(currentDay);
        const inWindow =
          (currentTime >= fromTimeStr && currentTime <= toTimeStr) ||
          (fromTimeStr > toTimeStr && (currentTime >= fromTimeStr || currentTime <= toTimeStr)); // cross-midnight

        if (isDaySelected && inWindow) {
          console.log(`✓ Running OCR Job: ${key}`);
          await runOcrForJob(job, base_url); // MUST await full completion
        } else {
          console.log(`⏳ Job ${key} skipped (day/time window not matched).`);
        }
      } catch (e) {
        console.error(`Error running job ${key}:`, e.message);
      } finally {
        jobRunning.delete(key);
      }
    })();

    jobRunning.set(key, runPromise);
    await runPromise; // serialize this tick
  });

  task.start();
  scheduledTasks.set(key, task);
  console.log(`✓ Scheduled job ${key} with cron: ${cronExp}`);
}

async function scheduleJobs() {
  try {
    const dbResponse = await fetchWithTimeout(`${BASE_URL}/auth/public-db`);
    const dbData = await dbResponse.json().catch(() => ({}));
    if (dbData?.database !== "remote") {
      console.log("Database is not remote. Skipping job scheduling.");
      return false;
    }

    await fetchWithTimeout(`${BASE_URL}/ipAddress/ip-address`).catch(() => null);
    const base_url = BASE_URL;

    const wmsRes = await fetchWithTimeout(`${base_url}/save-wms-url`);
    const { wmsUrl, username: userName, password: passWord } = await wmsRes.json().catch(() => ({}));

    const jobRes = await fetchWithTimeout(`${base_url}/jobs/get-job`);
    const jobJson = await jobRes.json();
    const jobs = jobJson.activeJobs || [];

    const newHash = makeJobsHash(jobs);

    if (isInitialLoad) {
      console.log(`Initial load: scheduling ${jobs.length} jobs`);
      for (const job of jobs) scheduleOne(job, base_url, wmsUrl, userName, passWord);
      currentJobsHash = newHash;
      isInitialLoad = false;
      return true;
    }

    const { added, removed, changed, kept } = compareJobs(jobs, scheduledTasks, currentJobsHash);

    for (const id of removed) {
      const task = scheduledTasks.get(id);
      if (task) { try { task.stop(); task.destroy?.(); } catch { } }
      scheduledTasks.delete(id);
      console.log(`✗ Removed job ${id}`);
    }
    for (const job of changed) {
      const id = String(job._id);
      const task = scheduledTasks.get(id);
      if (task) { try { task.stop(); task.destroy?.(); } catch { } }
      scheduledTasks.delete(id);
      console.log(`↻ Will reschedule changed job ${id}`);
    }
    for (const job of [...added, ...changed]) scheduleOne(job, base_url, wmsUrl, userName, passWord);

    console.log(`Update summary → added: ${added.length}, changed: ${changed.length}, removed: ${removed.length}, kept: ${kept.length}`);

    currentJobsHash = newHash;
    return added.length + changed.length + removed.length > 0;
  } catch (err) {
    console.error("Scheduling failed:", err.message);
    return false;
  }
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function waitForAPI(retries = 10, interval = 2000) {
  const url = `${BASE_URL}/auth/public-db`;
  console.log("Waiting for API to be ready...");
  while (retries--) {
    try {
      const res = await fetchWithTimeout(url, {}, 5000);
      if (res.ok) {
        console.log("✓ API is up, starting scheduler...");
        const success = await scheduleJobs();
        if (success) console.log("✓ Initial scheduling completed");
        return;
      }
    } catch { }
    if (retries > 0) {
      console.log(`⏳ API not ready, ${retries} retries left...`);
      await delay(interval);
    }
  }
  console.error("❌ API failed to respond after multiple retries.");
}

// graceful shutdown
process.on("SIGINT", () => {
  console.log("SIGINT → shutdown");
  clearScheduledJobs();
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("SIGTERM → shutdown");
  clearScheduledJobs();
  process.exit(0);
});

// start + periodic diffing
waitForAPI();
const jobCheckInterval = setInterval(async () => {
  console.log("⏰ Checking for updated jobs...");
  const changed = await scheduleJobs();
  if (changed) console.log("✓ Job set updated");
  else console.log("No changes; schedules intact.");
}, 150000);

process.on("exit", () => clearInterval(jobCheckInterval));
