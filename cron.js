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

let baseURL = "https://h0palyajms52cn-8080.proxy.runpod.net/api";

console.log("OCR Cron Job Script Initialized");

const scheduledTasks = new Map(); // jobId -> cron task
const jobRunning = new Map(); // jobId -> boolean
let lastJobsSignature = ""; // detect schedule changes only

/* ------------------------- Utilities ------------------------- */

function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

async function fetchJsonWithRetry(
  url,
  options = {},
  {
    timeout = 15000,
    retries = 2,
    backoffMs = 800,
    name = url,
    acceptable = (res) => res.ok,
  } = {}
) {
  let attempt = 0,
    lastErr;
  while (attempt <= retries) {
    const t0 = Date.now();
    try {
      const res = await fetchWithTimeout(url, options, timeout);
      if (!acceptable(res)) {
        const text = await res.text().catch(() => "");
        throw new Error(`${name} HTTP ${res.status} ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      return data;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const retryable = msg.includes("aborted") || /HTTP 5\d\d/.test(msg);
      console.error(
        `[${name}] attempt ${attempt + 1} failed after ${
          Date.now() - t0
        }ms: ${msg}`
      );
      if (!retryable || attempt === retries) break;
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
      attempt++;
    }
  }
  throw lastErr;
}

function getDBConnectionType() {
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
}

function getCronExpressionFromTime(timeStr) {
  const [hours, minutes] = String(timeStr || "0:1")
    .split(":")
    .map(Number);

  if (hours === 0 && minutes > 0) return `*/${minutes} * * * *`; // every N minutes
  if (minutes === 0 && hours > 0) return `0 */${hours} * * *`; // every N hours
  if (hours > 0 && minutes > 0) return `${minutes} */${hours} * * *`;
  return "* * * * *"; // default every minute
}

/* ------------------------- Core Processing ------------------------- */

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

    console.log("batch is-> ", batch);

    // Fetch metadata + store files
    await Promise.all(
      batch.map(async (item) => {
        const fileId = item.FILE_ID || item.file_id;
        const fileTable = item.FILE_TABLE || item.file_table;

        console.log("fileId is-> ", fileId, "fileTable is-> ", fileTable);

        // GET file metadata (allow more time than 5s)
        const fileRes = await fetchWithTimeout(
          `${base_url}/pod/file?fileId=${fileId}&fileTable=${fileTable}`,
          {},
          15000
        );
        console.log("fileRes is-> ", fileRes);
        if (!fileRes.ok) return;

        const fileData = await fileRes.json();
        fileMetaDataMap.set(fileId, fileData);

        // Store file (I/O, allow more)
        await fetchWithTimeout(
          `${base_url}/pod/store`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: fileData.FILE_ID }),
          },
          20000
        );
        console.log("file data stored successfully...");

        const filePath = `${base_url}/access-file?filename=${encodeURIComponent(
          fileData.FILE_NAME
        )}`;
        payload.push({ _id: fileId, file_url_or_path: filePath });
      })
    );

    console.log("payload is-> ", payload);
    if (payload.length === 0) return;

    // Scale OCR timeout with batch size: min 90s, 45s per file, max 5m
    const ocrTimeout = Math.min(
      Math.max(90000, payload.length * 45000),
      300000
    );

    const ocrRes = await fetchWithTimeout(
      ocrUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      ocrTimeout
    );
    console.log("ocr response is-> ", ocrRes);
    if (!ocrRes.ok) {
      const errJson = await ocrRes.json().catch(() => null);
      throw new Error(errJson?.error || `OCR Failed (HTTP ${ocrRes.status})`);
    }

    const ocrData = await ocrRes.json();
    console.log("ocrData is-> ", ocrData);
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
        console.log("filePath inside process data-> ", filePath);

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

        // Optional WMS/SAP validation (allow more time)
        try {
          const basicAuth = Buffer.from(`${userName}:${passWord}`).toString(
            "base64"
          );
          const response = await fetchWithTimeout(
            wmsUrl,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${basicAuth}`,
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ BOLNo: [processed.blNumber] }),
            },
            25000
          );

          const sapData = await response.json().catch(() => null);
          processed.recognitionStatus =
            sapData && sapData[0]?.BOLNo?.trim() === processed.blNumber.trim()
              ? "valid"
              : processed.recognitionStatus;
        } catch (err) {
          console.error("SAP check error:", err.message);
        }

        processedBatch.push(processed);
      })
    );

    // Auto-confirmation flag
    const confirmRes = await fetchWithTimeout(
      `${base_url}/settings/auto-confirmation`,
      {},
      15000
    );
    const confirmJson = await confirmRes.json().catch(() => ({}));

    if (confirmJson?.isAutoConfirmationOpen && processedBatch.length > 0) {
      await fetchWithTimeout(
        `${base_url}/pod/update`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ocrDataList: processedBatch }),
        },
        20000
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
        20000
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
  if (jobRunning.get(job._id)) {
    console.log(`Job ${job._id} is already running; skipping overlap.`);
    return;
  }
  jobRunning.set(job._id, true);

  try {
    console.log("ocr script started.");
    const dbConnectionType = getDBConnectionType();
    console.log("db connection-> ", dbConnectionType);

    const fileList = await fetchJsonWithRetry(
      `${base_url}/pod/retrieve?dayOffset=${dayOffset}&fetchLimit=${fetchLimit}`,
      {},
      { timeout: 20000, retries: 2, name: "retrieve" }
    );

    const batchSize = 4;
    const queue = new PQueue({ concurrency: 1 });

    for (let i = 0; i < fileList.length; i += batchSize) {
      const batch = fileList.slice(i, i + batchSize);
      console.log("batch-> ", batch);
      queue.add(() =>
        processBatch(batch, job, ocrUrl, base_url, wmsUrl, userName, passWord)
      );
      console.log(`Added batch to queue.`, queue);
    }

    await queue.onIdle(); // wait for all batches to finish before next run
  } catch (err) {
    console.error("OCR job error:", err.message);
  } finally {
    jobRunning.set(job._id, false);
  }
}

/* ------------------------- Scheduling ------------------------- */

function clearScheduledJobs() {
  for (const [jobId, task] of scheduledTasks.entries()) {
    try {
      task.stop();
    } catch {}
    scheduledTasks.delete(jobId);
  }
}

async function scheduleJobs() {
  try {
    // Ensure we're on the remote DB profile
    const dbData = await fetchJsonWithRetry(
      `${baseURL}/auth/public-db`,
      {},
      { timeout: 15000, name: "public-db" }
    );

    if (dbData?.database !== "remote") {
      console.log("Database is not remote. Skipping job scheduling.");
      return;
    }

    // Pin to your existing proxies
    const base_url = `${baseURL}`;
    const ocrUrl = `https://zydfs3qh4hkuh9-8080.proxy.runpod.net/run-ocr`;

    const {
      wmsUrl,
      username: userName,
      password: passWord,
    } = await fetchJsonWithRetry(
      `${base_url}/save-wms-url`,
      {},
      { timeout: 15000, name: "save-wms-url" }
    );

    const jobJson = await fetchJsonWithRetry(
      `${base_url}/jobs/get-job`,
      {},
      { timeout: 20000, name: "get-job" }
    );

    const jobs = jobJson?.activeJobs || [];

    // Build a stable signature to avoid recreating schedules each minute
    const sig = JSON.stringify(
      jobs.map((j) => ({
        id: j._id,
        everyTime: j.everyTime,
        days: j.selectedDays,
        from: j.pdfCriteria?.fromTime,
        to: j.pdfCriteria?.toTime,
        dayOffset: j.dayOffset,
        fetchLimit: j.fetchLimit,
      }))
    );

    if (sig === lastJobsSignature && scheduledTasks.size === jobs.length) {
      // No change — keep current schedules
      return;
    }
    lastJobsSignature = sig;

    // Stop tasks that no longer exist
    for (const [id, task] of scheduledTasks.entries()) {
      if (!jobs.find((j) => j._id === id)) {
        try {
          task.stop();
        } catch {}
        scheduledTasks.delete(id);
      }
    }

    // Create (or refresh) tasks
    for (const job of jobs) {
      const intervalStr = job.everyTime;
      const cronExp = getCronExpressionFromTime(intervalStr);

      // If exists, refresh it
      if (scheduledTasks.has(job._id)) {
        try {
          scheduledTasks.get(job._id).stop();
        } catch {}
        scheduledTasks.delete(job._id);
      }

      const task = cron.schedule(cronExp, async () => {
        const now = new Date();
        const currentDay = now.toLocaleString("en-US", { weekday: "long" });
        const currentTimeStr = `${String(now.getHours()).padStart(
          2,
          "0"
        )}:${String(now.getMinutes()).padStart(2, "0")}`;

        // Interpret job window as UTC (consistent with your original code)
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

        console.log("currentday-> ", currentDay);
        console.log("currentTimeStr-> ", currentTimeStr);
        console.log("fromTime-> ", fromTime);
        console.log("toTime-> ", toTime);
        console.log("fromTimeStr-> ", fromTimeStr);

        if (
          job.selectedDays.includes(currentDay) &&
          currentTimeStr >= fromTimeStr &&
          currentTimeStr <= toTimeStr
        ) {
          console.log(`Running OCR Job: ${job._id}`);
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
        }
      });

      scheduledTasks.set(job._id, task);
      console.log(`Scheduled job ${job._id} with cron: ${cronExp}`);
    }
  } catch (err) {
    console.error("Scheduling failed:", err.message);
  }
}

/* ------------------------- Boot Sequence ------------------------- */

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function waitForAPI(retries = 10, interval = 2000) {
  const url = `${baseURL}/auth/public-db`;
  while (retries--) {
    try {
      const res = await fetchWithTimeout(url, {}, 8000);
      if (res.ok) {
        console.log("API is up, starting scheduler...");
        await scheduleJobs();
        return;
      }
    } catch {
      console.log("Waiting for API to be ready...");
      await delay(interval);
    }
  }
  console.error("API failed to respond after multiple retries.");
}

waitForAPI();

// Poll for job updates; scheduleJobs() will no-op unless something changed
setInterval(() => {
  console.log("Checking for updated jobs...");
  scheduleJobs();
}, 60000);
