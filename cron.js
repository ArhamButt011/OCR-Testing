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

let baseURL = "https://h0palyajms52cn-8080.proxy.runpod.net/api";

console.log("OCR Cron Job Script Initialized");

// --- scheduler state ---
const scheduledTasks = new Map(); // jobId -> cron task
let isInitialLoad = true;
let currentJobsHash = "[]"; // JSON string of job configs
const jobRunning = new Map(); // jobId -> boolean (avoid overlapping runs)

// --- helpers: hashing & comparison ---
function jobConfigOf(job) {
  return {
    id: job._id,
    everyTime: job.everyTime,
    selectedDays: Array.isArray(job.selectedDays)
      ? [...job.selectedDays].sort()
      : [],
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

  const added = [];
  const removed = [];
  const changed = [];
  const kept = [];

  const newById = new Map(newJobs.map((j) => [j._id, j]));
  const scheduledIds = new Set(scheduledMap.keys());

  // check removals (scheduled but no longer present)
  for (const id of scheduledIds) {
    if (!newById.has(id)) removed.push(id);
  }

  // classify new/changed/kept
  for (const job of newJobs) {
    const cfg = jobConfigOf(job);
    const had = prevById.get(cfg.id);
    if (!had) {
      added.push(job);
    } else {
      const same = JSON.stringify(had) === JSON.stringify(cfg);
      if (same) kept.push(job);
      else changed.push(job);
    }
  }

  return { added, removed, changed, kept };
}

// --- clean up ---
function clearScheduledJobs() {
  for (const [jobId, task] of scheduledTasks.entries()) {
    try {
      task.stop();
      task.destroy?.();
    } catch {}
    scheduledTasks.delete(jobId);
  }
}

function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

// --- retry helpers & URL preflight ---
async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function postJsonWithRetry(
  url,
  jsonBody,
  { tries = 3, timeout = 200000 } = {}
) {
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
        console.error(
          `OCR HTTP ${res.status} ${res.statusText}: ${text.slice(0, 1000)}`
        );
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
      const backoff = 1000 * i;
      console.warn(
        `postJsonWithRetry attempt ${i} failed: ${e.message}. Retrying in ${backoff}ms...`
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}

async function isUrlOk(u) {
  try {
    // HEAD can be blocked; GET a byte instead
    const res = await fetchWithTimeout(
      u,
      { headers: { Range: "bytes=0-0" } },
      5000
    );
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

async function processBatch(
  batch,
  job,
  ocrUrl,
  base_url,
  wmsUrl,
  userName,
  passWord
) {
  try {
    const payload = [];
    const fileMetaDataMap = new Map();

    await Promise.all(
      batch.map(async (item) => {
        const fileId = item.FILE_ID || item.file_id;
        const fileTable = item.FILE_TABLE || item.file_table;
        const fileRes = await fetchWithTimeout(
          `${base_url}/pod/file?fileId=${fileId}&fileTable=${fileTable}`,
          {},
          5000
        );
        if (!fileRes.ok) return;

        const fileData = await fileRes.json();
        fileMetaDataMap.set(fileId, fileData);

        await fetchWithTimeout(
          `${base_url}/pod/store`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: fileData.FILE_ID }),
          },
          5000
        );

        const filePath = `${base_url}/access-file?filename=${encodeURIComponent(
          fileData.FILE_NAME
        )}`;
        payload.push({ _id: fileId, file_url_or_path: filePath });
      })
    );

    if (payload.length === 0) return;

    // Preflight each file URL to avoid poisoning whole batch
    const verifiedPayload = [];
    for (const rec of payload) {
      const ok = await isUrlOk(rec.file_url_or_path);
      if (!ok) {
        console.warn(
          `Skipping file ${rec._id}: URL not accessible -> ${rec.file_url_or_path}`
        );
        continue;
      }
      verifiedPayload.push(rec);
    }
    if (verifiedPayload.length === 0) {
      console.warn("No valid files to OCR in this batch.");
      return;
    }

    // Try batch OCR with retries
    let ocrData;
    try {
      ocrData = await postJsonWithRetry(ocrUrl, verifiedPayload, {
        tries: 3,
        timeout: 200000,
      });
    } catch (e) {
      console.warn(
        `Batch OCR failed (${e.message}). Falling back to single-file processing...`
      );
      ocrData = [];
      for (const rec of verifiedPayload) {
        try {
          const single = await postJsonWithRetry(ocrUrl, [rec], {
            tries: 2,
            timeout: 200000,
          });
          if (Array.isArray(single)) ocrData.push(...single);
        } catch (e2) {
          console.error(`Single OCR failed for ${rec._id}: ${e2.message}`);
        }
      }
    }

    if (!Array.isArray(ocrData)) return;

    const processedBatch = [];

    await Promise.all(
      ocrData.map(async (d) => {
        const fileId = d._id;
        const fileData = fileMetaDataMap.get(fileId);
        if (!fileData) return;

        const filePath = `${base_url}/access-file?filename=${encodeURIComponent(
          fileData.FILE_NAME
        )}`;
        const processed = {
          _id: fileId,
          jobId: job._id,
          fileId: fileId,
          pdfUrl: decodeURIComponent(
            new URL(filePath).searchParams.get("filename") || ""
          ),
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
          recognitionStatus:
            {
              failed: "failure",
              valid: "valid",
              "partially valid": "partiallyValid",
            }[d?.Status] || "null",
          breakdownReason: "none",
          reviewedBy: "OCR Engine",
          uptd_Usr_Cd: "OCR",
          cargoDescription: "Processed from OCR API.",
          none: "N",
          sealIntact: d?.Seal_Intact === "yes" ? "Y" : "N",
        };

        processedBatch.push(processed);
      })
    );

    const confirmRes = await fetchWithTimeout(
      `${base_url}/settings/auto-confirmation`,
      {},
      5000
    );
    const confirmJson = await confirmRes.json();

    if (confirmJson.isAutoConfirmationOpen && processedBatch.length > 0) {
      await fetchWithTimeout(
        `${base_url}/pod/update`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ocrDataList: processedBatch }),
        },
        5000
      );
    }

    if (processedBatch.length > 0) {
      await fetchWithTimeout(
        `${base_url}/process-data/save-data`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(processedBatch),
        },
        5000
      );

      for (const entry of processedBatch) {
        console.log(`File ${entry.fileId} processed.`);
      }
    }
  } catch (err) {
    console.error("Batch processing error:", err);
  }
}

async function runOcrForJob(
  job,
  ocrUrl,
  base_url,
  wmsUrl,
  userName,
  passWord,
  dayOffset,
  fetchLimit
) {
  console.log(`ocr script started for job ${job._id}`);
  const dbConnectionType = getDBConnectionType();
  console.log("db connection-> ", dbConnectionType);
  try {
    const retrieveRes = await fetchWithTimeout(
      `${base_url}/pod/retrieve?dayOffset=${dayOffset}&fetchLimit=${fetchLimit}`,
      {},
      5000
    );
    const fileList = await retrieveRes.json();

    const batchSize = Number(process.env.OCR_BATCH_SIZE || 2); // tuned down for stability
    const queue = new PQueue({ concurrency: 1 });

    for (let i = 0; i < fileList.length; i += batchSize) {
      const batch = fileList.slice(i, i + batchSize);
      queue.add(() =>
        processBatch(batch, job, ocrUrl, base_url, wmsUrl, userName, passWord)
      );
    }

    await queue.onIdle();
    console.log(`All batches processed for job: ${job._id}`);
  } catch (err) {
    console.error("OCR job error:", err.message);
  }
}

function getCronExpressionFromTime(timeStr) {
  const [hours, minutes] = String(timeStr).split(":").map(Number);

  if (hours === 0 && minutes > 0) return `*/${minutes} * * * *`;
  if (minutes === 0 && hours > 0) return `0 */${hours} * * *`;
  if (hours > 0 && minutes > 0) return `${minutes} */${hours} * * *`;
  return "* * * * *";
}

function scheduleOne(job, ocrUrl, base_url, wmsUrl, userName, passWord) {
  const cronExp = getCronExpressionFromTime(job.everyTime);
  if (!cron.validate(cronExp)) {
    console.error(`Invalid cron expression for job ${job._id}: ${cronExp}`);
    return;
  }

  const task = cron.schedule(cronExp, async () => {
    try {
      // Prevent overlapping runs for this job
      if (jobRunning.get(job._id)) {
        console.log(`↺ Skip run: previous run still active for job ${job._id}`);
        return;
      }
      jobRunning.set(job._id, true);

      const now = new Date();
      const currentDay = now.toLocaleString("en-US", { weekday: "long" });
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      const fromTime = new Date(job.pdfCriteria.fromTime);
      const toTime = new Date(job.pdfCriteria.toTime);
      const fromTimeStr = `${String(fromTime.getUTCHours()).padStart(
        2,
        "0"
      )}:${String(fromTime.getUTCMinutes()).padStart(2, "0")}`;
      const toTimeStr = `${String(toTime.getUTCHours()).padStart(
        2,
        "0"
      )}:${String(toTime.getUTCMinutes()).padStart(2, "0")}`;

      const isDaySelected = job.selectedDays.includes(currentDay);
      const inWindow =
        (currentTime >= fromTimeStr && currentTime <= toTimeStr) ||
        (fromTimeStr > toTimeStr &&
          (currentTime >= fromTimeStr || currentTime <= toTimeStr)); // cross-midnight

      if (isDaySelected && inWindow) {
        console.log(`✓ Running OCR Job: ${job._id}`);
        await runOcrForJob(
          job,
          ocrUrl,
          base_url,
          wmsUrl,
          userName,
          passWord,
          job.dayOffset,
          job.fetchLimit
        );
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
    const dbResponse = await fetchWithTimeout(
      `${baseURL}/auth/public-db`,
      {},
      5000
    );
    const dbData = await dbResponse.json();
    if (dbData?.database !== "remote") {
      console.log("Database is not remote. Skipping job scheduling.");
      return false;
    }

    const ipRes = await fetchWithTimeout(
      `${baseURL}/ipAddress/ip-address`,
      {},
      5000
    );
    await ipRes.json(); // not used directly below

    const base_url = `https://h0palyajms52cn-8080.proxy.runpod.net/api`;
    const ocrUrl = `https://w70nd5g17ekhdj-8080.proxy.runpod.net/run-ocr`;

    const wmsRes = await fetchWithTimeout(`${base_url}/save-wms-url`, {}, 5000);
    const {
      wmsUrl,
      username: userName,
      password: passWord,
    } = await wmsRes.json();

    const jobRes = await fetchWithTimeout(`${base_url}/jobs/get-job`, {}, 5000);
    const jobJson = await jobRes.json();
    const jobs = jobJson.activeJobs || [];

    const newHash = makeJobsHash(jobs);

    if (isInitialLoad) {
      console.log(`Initial load: scheduling ${jobs.length} jobs`);
      for (const job of jobs) {
        scheduleOne(job, ocrUrl, base_url, wmsUrl, userName, passWord);
      }
      currentJobsHash = newHash;
      isInitialLoad = false;
      return true;
    }

    // incremental update
    const { added, removed, changed, kept } = compareJobs(
      jobs,
      scheduledTasks,
      currentJobsHash
    );

    // remove deleted/changed
    for (const id of removed) {
      const task = scheduledTasks.get(id);
      if (task) {
        try {
          task.stop();
          task.destroy?.();
        } catch {}
        scheduledTasks.delete(id);
        console.log(`✗ Removed job ${id}`);
      }
    }
    for (const job of changed) {
      const task = scheduledTasks.get(job._id);
      if (task) {
        try {
          task.stop();
          task.destroy?.();
        } catch {}
        scheduledTasks.delete(job._id);
        console.log(`↻ Will reschedule changed job ${job._id}`);
      }
    }

    // add new/changed
    for (const job of [...added, ...changed]) {
      scheduleOne(job, ocrUrl, base_url, wmsUrl, userName, passWord);
    }

    // kept jobs remain untouched (no duplicate scheduling)
    console.log(
      `Update summary → added: ${added.length}, changed: ${changed.length}, removed: ${removed.length}, kept: ${kept.length}`
    );

    currentJobsHash = newHash;
    return added.length + changed.length + removed.length > 0;
  } catch (err) {
    console.error("Scheduling failed:", err.message);
    return false;
  }
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function waitForAPI(retries = 10, interval = 2000) {
  const url = `${baseURL}/auth/public-db`;
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
    } catch {}
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

// start
waitForAPI();

// periodic incremental check
const jobCheckInterval = setInterval(async () => {
  console.log("⏰ Checking for updated jobs...");
  const changed = await scheduleJobs();
  if (changed) console.log("✓ Job set updated");
  else console.log("No changes; schedules intact.");
}, 150000);

process.on("exit", () => clearInterval(jobCheckInterval));
