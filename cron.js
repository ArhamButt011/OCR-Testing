/* eslint-disable no-console */
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
const BASE_URL = process.env.BASE_URL || "https://h0palyajms52cn-8080.proxy.runpod.net/api";
const OCR_URL = process.env.OCR_URL || "https://w70nd5g17ekhdj-8080.proxy.runpod.net/run-ocr";

const BATCH_SIZE = Number(process.env.OCR_BATCH_SIZE || 4); // primary pass batch size
const FALLBACK_BATCH_SIZE = Number(process.env.FALLBACK_BATCH_SIZE || 2); // fallback pass batch size
const PRIMARY_CONCURRENCY = Number(process.env.PRIMARY_CONCURRENCY || 1); // batches in parallel
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 200000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 5000);
const OCR_RETRIES = Number(process.env.OCR_RETRIES || 3);
const OCR_RETRY_BASE_BACKOFF = Number(process.env.OCR_RETRY_BASE_BACKOFF || 1000); // ms
const PREFLIGHT_URL_CHECK = (process.env.PREFLIGHT_URL_CHECK || "true") === "true";
const SAVE_CHUNK_SIZE = Number(process.env.SAVE_CHUNK_SIZE || 50);

// ======== LOG START ========
console.log("OCR Cron Job Script Initialized (deferred-fallback mode)");

// --- scheduler state ---
const scheduledTasks = new Map(); // jobId -> cron task
const jobRunning = new Map();     // jobId -> boolean (avoid overlapping runs)
let isInitialLoad = true;
let currentJobsHash = "[]"; // JSON string of job configs

// ======== HELPERS ========
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

async function postJsonWithRetry(url, jsonBody, { tries = OCR_RETRIES, timeout = OCR_TIMEOUT_MS } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jsonBody),
        },
        timeout
      );
      const text = await res.text(); // don't assume JSON
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
    // HEAD can be blocked; GET 1 byte instead
    const res = await fetchWithTimeout(u, { headers: { Range: "bytes=0-0" } }, 5000);
    return res.ok;
  } catch {
    return false;
  }
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

// ======== HASH + DIFF (for safe rescheduling) ========
function jobConfigOf(job) {
  return {
    id: job._id,
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
  const prev = JSON.parse(prevHash); // array of jobConfig
  const prevById = new Map(prev.map((j) => [j.id, j]));
  const added = [], removed = [], changed = [], kept = [];
  const newById = new Map(newJobs.map((j) => [j._id, j]));
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
    try {
      task.stop();
      task.destroy?.();
    } catch { }
    scheduledTasks.delete(jobId);
  }
}

// ======== TRANSFORM OCR → PROCESSED RECORD ========
function toProcessedRecord(d, fileId, job, fileData, base_url) {
  const filePath = `${base_url}/access-file?filename=${encodeURIComponent(fileData.FILE_NAME)}`;
  return {
    _id: fileId,
    jobId: job._id,
    fileId: fileId,
    pdfUrl: decodeURIComponent(new URL(filePath).searchParams.get("filename") || ""),
    deliveryDate: new Date().toISOString().split("T")[0],
    noOfPages: 1,
    blNumber: String(d?.B_L_Number || ""),
    podDate: d?.POD_Date || "",
    podSignature: d?.Signature_Exists || "unknown",
    totalQty: Number(d?.Issued_Qty) || 0,
    received: Number(d?.Received_Qty) || 0,
    damaged: d?.Damage_Qty,
    short: d?.Short_Qty,
    over: d?.Over_Qty,
    refused: d?.Refused_Qty,
    customerOrderNum: d?.Customer_Order_Num,
    stampExists: d?.Stamp_Exists,
    finalStatus: "valid",
    reviewStatus: "unConfirmed",
    recognitionStatus: ({ failed: "failure", valid: "valid", "partially valid": "partiallyValid" }[d?.Status]) || "null",
    breakdownReason: "none",
    reviewedBy: "OCR Engine",
    uptd_Usr_Cd: "OCR",
    cargoDescription: "Processed from OCR API.",
    none: "N",
    sealIntact: d?.Seal_Intact === "yes" ? "Y" : "N",
  };
}

// ======== BATCH HELPERS ========
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Primary pass: build payload for a batch, call OCR once.
 * Return { processed: [], failedForFallback: [ { _id, file_url_or_path } ] }
 */
async function processPrimaryBatch(batch, job, base_url) {
  const payload = [];
  const fileMetaDataMap = new Map();

  // 1) Fetch file metadata and store, build URLs
  await Promise.all(batch.map(async (item) => {
    const fileId = item.FILE_ID || item.file_id;
    const fileTable = item.FILE_TABLE || item.file_table;
    try {
      const fileRes = await fetchWithTimeout(`${base_url}/pod/file?fileId=${fileId}&fileTable=${fileTable}`, {}, FETCH_TIMEOUT_MS);
      if (!fileRes.ok) throw new Error(`file meta ${fileId} HTTP_${fileRes.status}`);
      const fileData = await fileRes.json();
      fileMetaDataMap.set(fileId, fileData);

      await fetchWithTimeout(
        `${base_url}/pod/store`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: fileData.FILE_ID }) },
        FETCH_TIMEOUT_MS
      );

      const filePath = `${base_url}/access-file?filename=${encodeURIComponent(fileData.FILE_NAME)}`;
      // Preflight (optional)
      if (await isUrlOk(filePath)) {
        payload.push({ _id: fileId, file_url_or_path: filePath });
      } else {
        console.warn(`Preflight failed; defer to fallback: ${fileId}`);
      }
    } catch (e) {
      console.warn(`Meta/store failed; defer to fallback: ${fileId} (${e.message})`);
    }
  }));

  if (payload.length === 0) {
    return { processed: [], failedForFallback: batch.map(it => ({ _id: it.FILE_ID || it.file_id })) };
  }

  // 2) Call OCR once for this batch
  let ocrData;
  try {
    ocrData = await postJsonWithRetry(OCR_URL, payload, { tries: OCR_RETRIES, timeout: OCR_TIMEOUT_MS });
  } catch (e) {
    console.warn(`Primary OCR failed for batch (${e.message}); deferring entire payload to fallback.`);
    return { processed: [], failedForFallback: payload };
  }

  if (!Array.isArray(ocrData)) {
    console.warn(`OCR returned non-array; deferring entire payload to fallback.`);
    return { processed: [], failedForFallback: payload };
  }

  // 3) Map successes; anything missing from response → fallback
  const byId = new Map(ocrData.map(x => [x._id, x]));
  const processed = [];
  const failedForFallback = [];

  for (const rec of payload) {
    const d = byId.get(rec._id);
    const fileData = fileMetaDataMap.get(rec._id);
    if (d && fileData) {
      processed.push(toProcessedRecord(d, rec._id, job, fileData, base_url));
    } else {
      failedForFallback.push(rec);
    }
  }

  return { processed, failedForFallback };
}

/**
 * Fallback pass (after all primary batches done):
 * Try OCR again but on the accumulated failed list (batched).
 * Return { processed: [], stillFailed: [] }
 */
async function processFallbackBatches(failedList, job, base_url) {
  const processed = [];
  const stillFailed = [];
  const groups = chunk(failedList, FALLBACK_BATCH_SIZE);

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];

    // Try OCR for this fallback group
    let ocrData;
    try {
      ocrData = await postJsonWithRetry(OCR_URL, group, { tries: OCR_RETRIES, timeout: OCR_TIMEOUT_MS });
    } catch (e) {
      console.warn(`Fallback OCR group ${gi + 1}/${groups.length} failed (${e.message}). Marking all in group as failed.`);
      stillFailed.push(...group);
      continue;
    }

    if (!Array.isArray(ocrData)) {
      console.warn(`Fallback OCR group ${gi + 1} returned non-array. Marking group failed.`);
      stillFailed.push(...group);
      continue;
    }

    // We need file metadata again to build processed records.
    // Fetch metadata in parallel (small groups).
    const fileMetaDataMap = new Map();
    await Promise.all(group.map(async (rec) => {
      try {
        const url = new URL(rec.file_url_or_path);
        const filename = url.searchParams.get("filename");
        if (!filename) throw new Error("no filename in url");
        const fileRes = await fetchWithTimeout(`${base_url}/pod/file?fileId=${rec._id}&fileTable=${rec.FILE_TABLE || "XTI_FILE_POD_T"}`, {}, FETCH_TIMEOUT_MS);
        // Note: if your /pod/file requires fileTable, you may want to carry it in 'rec' at primary phase
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
      if (d && fileData) {
        processed.push(toProcessedRecord(d, rec._id, job, fileData, base_url));
      } else {
        stillFailed.push(rec);
      }
    }
  }

  return { processed, stillFailed };
}

// ======== SAVE HELPERS ========
async function saveProcessedRecords(base_url, records) {
  if (!records.length) return;
  // Auto-confirm check
  try {
    const confirmRes = await fetchWithTimeout(`${base_url}/settings/auto-confirmation`, {}, FETCH_TIMEOUT_MS);
    const confirmJson = await confirmRes.json().catch(() => ({}));
    if (confirmJson?.isAutoConfirmationOpen) {
      for (const part of chunk(records, SAVE_CHUNK_SIZE)) {
        await fetchWithTimeout(
          `${base_url}/pod/update`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ocrDataList: part }),
          },
          FETCH_TIMEOUT_MS
        );
      }
    }
  } catch (e) {
    console.warn(`Auto-confirmation step failed: ${e.message}`);
  }

  // Save data
  for (const part of chunk(records, SAVE_CHUNK_SIZE)) {
    await fetchWithTimeout(
      `${base_url}/process-data/save-data`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(part),
      },
      FETCH_TIMEOUT_MS
    );
    for (const entry of part) console.log(`File ${entry.fileId} processed.`);
  }
}

// ======== JOB RUNNER ========
async function runOcrForJob(job, base_url) {
  console.log(`OCR script started for job ${job._id}`);
  const dbConnectionType = getDBConnectionType();
  console.log("db connection ->", dbConnectionType);

  try {
    const retrieveRes = await fetchWithTimeout(
      `${base_url}/pod/retrieve?dayOffset=${job.dayOffset}&fetchLimit=${job.fetchLimit}`,
      {},
      FETCH_TIMEOUT_MS
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
    const primaryQueue = new PQueue({ concurrency: PRIMARY_CONCURRENCY });

    const allProcessed = [];
    const fallbackBucket = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      primaryQueue.add(async () => {
        console.log(`Primary batch ${i + 1}/${batches.length} (size=${batch.length})`);
        const { processed, failedForFallback } = await processPrimaryBatch(batch, job, base_url);
        allProcessed.push(...processed);
        fallbackBucket.push(...failedForFallback);
      });
    }

    await primaryQueue.onIdle();
    console.log(`Primary pass complete. Processed: ${allProcessed.length}, Deferred to fallback: ${fallbackBucket.length}`);

    // Persist primary processed first
    await saveProcessedRecords(base_url, allProcessed);

    // Fallback pass
    if (fallbackBucket.length > 0) {
      console.log(`Starting fallback pass for ${fallbackBucket.length} file(s)...`);
      const { processed: fbProcessed, stillFailed } = await processFallbackBatches(fallbackBucket, job, base_url);
      console.log(`Fallback complete. Recovered: ${fbProcessed.length}, Still failed: ${stillFailed.length}`);

      // Persist fallback processed
      await saveProcessedRecords(base_url, fbProcessed);

      // Optional: persist or log stillFailed for manual review
      if (stillFailed.length) {
        console.warn(`Unrecoverable after fallback: ${stillFailed.map(x => x._id).join(", ")}`);
        // You could POST stillFailed to a /save-failures endpoint here if you have one
      }
    }

    console.log(`All processing completed for job: ${job._id}`);
  } catch (err) {
    console.error("OCR job error:", err.message);
  }
}

// ======== CRON/SCHEDULING ========
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

  const task = cron.schedule(cronExp, async () => {
    try {
      if (jobRunning.get(job._id)) {
        console.log(`↺ Skip run: previous run still active for job ${job._id}`);
        return;
      }
      jobRunning.set(job._id, true);

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
        console.log(`✓ Running OCR Job: ${job._id}`);
        await runOcrForJob(job, base_url);
      } else {
        console.log(`⏳ Job ${job._id} skipped (day/time window not matched).`);
      }
    } catch (e) {
      console.error(`Error running job ${job._id}:`, e.message);
    } finally {
      jobRunning.set(job._id, false);
    }
  });

  task.start();
  scheduledTasks.set(job._id, task);
  console.log(`✓ Scheduled job ${job._id} with cron: ${cronExp}`);
}

async function scheduleJobs() {
  try {
    const dbResponse = await fetchWithTimeout(`${BASE_URL}/auth/public-db`, {}, FETCH_TIMEOUT_MS);
    const dbData = await dbResponse.json().catch(() => ({}));
    if (dbData?.database !== "remote") {
      console.log("Database is not remote. Skipping job scheduling.");
      return false;
    }

    await fetchWithTimeout(`${BASE_URL}/ipAddress/ip-address`, {}, FETCH_TIMEOUT_MS).catch(() => null);

    const base_url = BASE_URL;

    const wmsRes = await fetchWithTimeout(`${base_url}/save-wms-url`, {}, FETCH_TIMEOUT_MS);
    const { wmsUrl, username: userName, password: passWord } = await wmsRes.json().catch(() => ({}));

    const jobRes = await fetchWithTimeout(`${base_url}/jobs/get-job`, {}, FETCH_TIMEOUT_MS);
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

    // incremental update
    const { added, removed, changed, kept } = compareJobs(jobs, scheduledTasks, currentJobsHash);

    // remove deleted/changed
    for (const id of removed) {
      const task = scheduledTasks.get(id);
      if (task) {
        try { task.stop(); task.destroy?.(); } catch { }
        scheduledTasks.delete(id);
        console.log(`✗ Removed job ${id}`);
      }
    }
    for (const job of changed) {
      const task = scheduledTasks.get(job._id);
      if (task) {
        try { task.stop(); task.destroy?.(); } catch { }
        scheduledTasks.delete(job._id);
        console.log(`↻ Will reschedule changed job ${job._id}`);
      }
    }

    // add new/changed
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
