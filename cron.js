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
const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://fzi6t0m8gas6eb-8080.proxy.runpod.net/api";
const OCR_URL =
  process.env.OCR_URL || "https://dp0d3cgxkrz317-8080.proxy.runpod.net/run-ocr";
const PROXY_DEADLINE_MS = Number(process.env.PROXY_DEADLINE_MS || 120000);
const BATCH_SIZE = Number(process.env.OCR_BATCH_SIZE || 3); // primary pass batch size
const FALLBACK_BATCH_SIZE = Number(process.env.FALLBACK_BATCH_SIZE || 2);
const PRIMARY_CONCURRENCY = Number(process.env.PRIMARY_CONCURRENCY || 1);
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 130000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 60000);
const OCR_RETRIES = Number(process.env.OCR_RETRIES || 3);
const OCR_RETRY_BASE_BACKOFF = Number(
  process.env.OCR_RETRY_BASE_BACKOFF || 1000
);
const PREFLIGHT_URL_CHECK =
  (process.env.PREFLIGHT_URL_CHECK || "true") === "true";
const SAVE_CHUNK_SIZE = Number(process.env.SAVE_CHUNK_SIZE || 50);

const OCR_COOLDOWN_MS = Number(process.env.OCR_COOLDOWN_MS || 10000);
const OCR_GC_URL = process.env.OCR_GC_URL || "";

console.log("OCR Cron Job Script Initialized (deferred-fallback mode)");
function normalizeQuantity(value) {
  // Handle null, undefined, or empty string
  if (value === null || value === undefined || value === "") {
    return null;
  }

  // Convert to string and trim whitespace
  const strValue = String(value).trim().toLowerCase();

  // Check for explicit "null" string or empty after trim
  if (strValue === "" || strValue === "null") {
    return null;
  }

  // Remove commas and spaces, then parse
  const cleanedValue = strValue.replace(/[, ]/g, "");
  const numValue = parseInt(cleanedValue, 10);

  // Check if parsing was successful and if value is 0
  if (!Number.isFinite(numValue) || numValue === 0) {
    return null;
  }

  // Return the valid non-zero integer
  return numValue;
}
const scheduledTasks = new Map();
const jobRunning = new Map();
const jobTimeouts = new Map(); // Track timeout handlers
const jobAbortControllers = new Map(); // Track abort controllers for cancellation
let isInitialLoad = true;
let currentJobsHash = "[]";

// Job timeout configuration (3 hours default)
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS || 3 * 60 * 60 * 1000);

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

async function postJsonWithRetry(
  url,
  jsonBody,
  { tries = OCR_RETRIES, timeout = OCR_TIMEOUT_MS } = {}
) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const requestTimeout = Math.min(timeout, PROXY_DEADLINE_MS);
console.log('jsonBody-> ', jsonBody?.map(x => x.file_url_or_path));
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Connection: "close" },
          body: JSON.stringify(jsonBody),
        },
        requestTimeout
      );
      const text = await res.text();
      if (!res.ok) {
        console.log('ocr response not ok-> ', res)
        console.error(
          `OCR HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`
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
      const backoff = OCR_RETRY_BASE_BACKOFF * i;
      console.warn(
        `postJsonWithRetry attempt ${i} failed: ${e.message}. Backing off ${backoff}ms...`
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}

async function isUrlOk(u) {
  if (!PREFLIGHT_URL_CHECK) return true;
  try {
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

async function validatePdfStructure(fileUrl) {
  try {
    const res = await fetchWithTimeout(
      fileUrl,
      { headers: { Range: "bytes=0-1023" } },
      5000
    );

    if (!res.ok) {
      console.warn(`PDF validation failed: HTTP ${res.status} for ${fileUrl}`);
      return { valid: false, reason: 'HTTP_ERROR', details: `Status ${res.status}` };
    }

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const pdfHeader = String.fromCharCode(...bytes.slice(0, 5));
    if (!pdfHeader.startsWith('%PDF-')) {
      console.warn(`Invalid PDF header: ${pdfHeader} for ${fileUrl}`);
      return { valid: false, reason: 'INVALID_PDF_HEADER', details: `Header: ${pdfHeader}` };
    }

    const versionMatch = String.fromCharCode(...bytes.slice(0, 20)).match(/%PDF-(\d+\.\d+)/);
    const pdfVersion = versionMatch ? parseFloat(versionMatch[1]) : 0;

    if (pdfVersion >= 2.0) {
      console.warn(`PDF version ${pdfVersion} may have compatibility issues: ${fileUrl}`);
      return { valid: false, reason: 'UNSUPPORTED_PDF_VERSION', details: `Version ${pdfVersion}` };
    }

    const headerText = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    if (headerText.includes('/Encrypt')) {
      console.warn(`Encrypted PDF detected: ${fileUrl}`);
      return { valid: false, reason: 'ENCRYPTED_PDF', details: 'Password protected' };
    }

    return { valid: true, version: pdfVersion };
  } catch (err) {
    console.error(`PDF validation exception for ${fileUrl}: ${err.message}`);
    return { valid: false, reason: 'VALIDATION_ERROR', details: err.message };
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

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// Error categorization function for better telemetry
function categorizeOCRError(errorMessage) {
  if (!errorMessage) return 'UNKNOWN';

  const msg = String(errorMessage).toLowerCase();

  // PDFium errors
  if (msg.includes('pdfium') || msg.includes('data format error')) {
    return 'PDF_FORMAT_ERROR';
  }
  if (msg.includes('failed to load page')) {
    return 'PDF_PAGE_ERROR';
  }

  // Network/Protocol errors
  if (msg.includes('missing') && (msg.includes('http://') || msg.includes('https://'))) {
    return 'MISSING_PROTOCOL';
  }
  if (msg.includes('request url') || msg.includes('protocol')) {
    return 'URL_ERROR';
  }

  // HTTP errors
  if (msg.includes('http_5')) {
    return 'HTTP_500_ERROR';
  }
  if (msg.includes('http_4')) {
    return 'HTTP_400_ERROR';
  }

  // Timeout errors
  if (msg.includes('timeout') || msg.includes('aborted')) {
    return 'TIMEOUT';
  }

  // Network errors
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'NETWORK_ERROR';
  }

  return 'UNKNOWN';
}

async function cooldownAndGc() {
  if (OCR_GC_URL) {
    try {
      await fetchWithTimeout(
        OCR_GC_URL,
        { method: "POST", headers: { Connection: "close" } },
        5000
      );
      console.log("• Invoked OCR GC endpoint.");
    } catch (e) {
      console.warn("OCR GC endpoint failed:", e.message);
    }
  }
  if (OCR_COOLDOWN_MS > 0) {
    await sleep(OCR_COOLDOWN_MS);
  }
}

async function performSapCheck(processed, wmsUrl, userName, passWord) {
  console.log('wmsURL-> ', wmsUrl);
  try {
    // Fix: Validate wmsUrl is an absolute URL
    if (!wmsUrl || (!wmsUrl.startsWith('http://') && !wmsUrl.startsWith('https://'))) {
      console.warn(`Invalid WMS URL (not absolute): ${wmsUrl}. Skipping SAP check for BL: ${processed.blNumber}`);
      return processed;
    }

    const basicAuth = Buffer.from(`${userName}:${passWord}`).toString("base64");
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
      10000
    ); // 10 second timeout for SAP API

    if (!response.ok) {
      console.warn(
        `SAP API HTTP ${response.status} for BL: ${processed.blNumber}`
      );
      return processed; // Return original if SAP call fails
    }

    const sapData = await response.json();

    // Update recognition status based on SAP validation
    if (Array.isArray(sapData) && sapData.length > 0) {
      processed.recognitionStatus =
        sapData[0]?.BOLNo?.trim() === processed.blNumber.trim()
          ? "valid"
          : "failure";
      console.log(
        `SAP validation for ${processed.blNumber}: ${processed.recognitionStatus}`
      );
    }

    return processed;
  } catch (err) {
    console.error(`SAP check error for ${processed.blNumber}:`, err.message);
    return processed; // Return original record if SAP check fails
  }
}

// ======== FIELD NORMALIZATION (prevents nulls) ========
function firstOf(obj, aliases, def = "") {
  for (const key of aliases) {
    if (
      obj &&
      obj[key] !== undefined &&
      obj[key] !== null &&
      String(obj[key]).trim() !== ""
    ) {
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
  const s = String(val || "")
    .trim()
    .toLowerCase();
  if (["y", "yes", "true", "1"].includes(s)) return "Y";
  if (["n", "no", "false", "0"].includes(s)) return "N";
  return "N";
}

function toProcessedRecord(d, fileId, job, fileData, base_url) {
  if (!fileData || !fileData.FILE_NAME) return null;

  // Fix: Validate and sanitize FILE_NAME to prevent missing protocol errors
  const fileName = fileData.FILE_NAME || "";
  if (!fileName) {
    console.warn(`Missing FILE_NAME for fileId: ${fileId}`);
    return null;
  }

  // Ensure fileName is just the filename, not a path with slashes
  const safeFileName = fileName.replace(/^.*[\\\/]/, '');

  // Validate base_url has proper protocol
  let validBaseUrl = base_url;
  if (!validBaseUrl.startsWith('http://') && !validBaseUrl.startsWith('https://')) {
    validBaseUrl = `http://${validBaseUrl}`;
  }

  const filePath = `${base_url}/access-file?filename=${encodeURIComponent(safeFileName)}`;

  const blNumber = String(
    firstOf(
      d,
      ["B_L_Number", "BL_Number", "BOLNo", "BOL_No", "B_LNo", "B_L"],
      ""
    )
  );
  const podDate = firstOf(
    d,
    ["POD_Date", "PODDate", "Proof_Of_Delivery_Date", "Delivery_Date"],
    ""
  );
  const podSignature = firstOf(
    d,
    ["Signature_Exists", "Signature", "Sign_Exists"],
    "unknown"
  );

  const issuedQty = toInt(
    firstOf(d, ["Issued_Qty", "IssuedQty", "Shipped_Qty", "Total_Issued"], 0)
  );
  const receivedQty = normalizeQuantity(
    firstOf(
      d,
      [
        "Received_Qty",
        "ReceivedQty",
        "Total_Received",
        "TOTAL_CARTONS_RECEIVED",
      ],
      null
    )
  );
  const damageQty = toInt(
    firstOf(d, ["Damage_Qty", "Damaged_Qty", "DamageQty"], 0)
  );
  const shortQty = toInt(firstOf(d, ["Short_Qty", "ShortQty"], 0));
  const overQty = toInt(firstOf(d, ["Over_Qty", "OverQty"], 0));
  const refusedQty = toInt(firstOf(d, ["Refused_Qty", "RefusedQty"], 0));

  const customerOrderNum = firstOf(
    d,
    ["Customer_Order_Num", "CustomerOrderNum", "Order_No"],
    ""
  );
  const stampExists = firstOf(d, ["Stamp_Exists", "StampExists"], "");
  const statusRaw = firstOf(d, ["Status", "OCR_Status"], "");
  const statusMap = {
    failed: "failure",
    valid: "valid",
    "partially valid": "partiallyValid",
    partial: "partiallyValid",
  };
  const recognitionStatus =
    statusMap[String(statusRaw).toLowerCase()] || "null";
  const sealIntact = toYesNoY(
    firstOf(d, ["Seal_Intact", "SealIntact", "Seal_Status"], "no")
  );

  return {
    _id: fileId,
    jobId: job._id,
    fileId: fileId,
    pdfUrl: decodeURIComponent(
      new URL(filePath).searchParams.get("filename") || ""
    ),
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
  const prev = JSON.parse(prevHash);
  const prevById = new Map(prev.map((j) => [j.id, j]));
  const added = [],
    removed = [],
    changed = [],
    kept = [];
  const newById = new Map(newJobs.map((j) => [String(j._id), j]));
  const scheduledIds = new Set(scheduledMap.keys());
  for (const id of scheduledIds) if (!newById.has(id)) removed.push(id);
  for (const job of newJobs) {
    const cfg = jobConfigOf(job);
    const had = prevById.get(cfg.id);
    if (!had) added.push(job);
    else
      (JSON.stringify(had) === JSON.stringify(cfg) ? kept : changed).push(job);
  }
  return { added, removed, changed, kept };
}

function clearScheduledJobs() {
  for (const [jobId, task] of scheduledTasks.entries()) {
    try {
      task.stop();
      task.destroy?.();
    } catch {}
    scheduledTasks.delete(jobId);
  }
}

// Helper function to cancel all currently running jobs
function cancelAllRunningJobs(excludeJobId = null) {
  const cancelledJobs = [];

  for (const [jobId, promise] of jobRunning.entries()) {
    // Skip the job we want to keep running (if any)
    if (excludeJobId && jobId === excludeJobId) {
      continue;
    }

    console.log(`⚠ Cancelling running job: ${jobId}`);

    // Abort the job
    const abortController = jobAbortControllers.get(jobId);
    if (abortController) {
      abortController.abort();
      cancelledJobs.push(jobId);
    }

    // Clear timeout
    const timeoutId = jobTimeouts.get(jobId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      jobTimeouts.delete(jobId);
    }

    // Remove from tracking maps
    jobRunning.delete(jobId);
    jobAbortControllers.delete(jobId);
  }

  if (cancelledJobs.length > 0) {
    console.log(`✓ Cancelled ${cancelledJobs.length} running job(s): ${cancelledJobs.join(', ')}`);
  }

  return cancelledJobs;
}

// ======== PRIMARY PASS (no per-file fallback here) ========
async function processPrimaryBatch(
  ocrUrl,
  batch,
  job,
  base_url,
  wmsUrl,
  userName,
  passWord
) {
  const payload = [];
  const fileMetaDataMap = new Map();
  const forFallback = []; // minimal records to retry later

  await Promise.all(
    batch.map(async (item) => {
      const fileId = item.FILE_ID || item.file_id;
      const fileTable = item.FILE_TABLE || item.file_table;
      try {
        const fileRes = await fetchWithTimeout(
          `${BASE_URL}/pod/file?fileId=${fileId}&fileTable=${fileTable}`
        );
        if (!fileRes.ok)
          throw new Error(`file meta ${fileId} HTTP_${fileRes.status}`);
        const fileData = await fileRes.json();
        fileMetaDataMap.set(fileId, fileData);

        await fetchWithTimeout(`${BASE_URL}/pod/store`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: fileData.FILE_ID }),
        });

        // Fix: Validate and sanitize FILE_NAME to prevent missing protocol errors
        const fileName = fileData.FILE_NAME || "";
        if (!fileName) {
          throw new Error(`Missing FILE_NAME for ${fileId}`);
        }

        // Ensure fileName is just the filename, not a path
        const safeFileName = fileName.replace(/^.*[\\\/]/, '');

        // Validate base_url has proper protocol
        let validBaseUrl = base_url;
        if (!validBaseUrl.startsWith('http://') && !validBaseUrl.startsWith('https://')) {
          validBaseUrl = `http://${validBaseUrl}`;
        }

        const filePath = `${base_url}/access-file?filename=${encodeURIComponent(safeFileName)}`;

        // Pre-flight URL check
        const urlOk = await isUrlOk(filePath);
        if (!urlOk) {
          console.warn(`Preflight URL check failed; defer to fallback: ${fileId}`);
          forFallback.push({
            _id: fileId,
            file_url_or_path: filePath,
            FILE_TABLE: fileTable,
            errorCategory: 'URL_CHECK_FAILED'
          });
        } else {
          // PDF validation check
          const pdfValidation = await validatePdfStructure(filePath);
          if (!pdfValidation.valid) {
            console.warn(`PDF validation failed for ${fileId}: ${pdfValidation.reason} - ${pdfValidation.details}`);
            forFallback.push({
              _id: fileId,
              file_url_or_path: filePath,
              FILE_TABLE: fileTable,
              errorCategory: pdfValidation.reason,
              errorDetails: pdfValidation.details
            });
          } else {
            payload.push({
              _id: fileId,
              file_url_or_path: filePath,
              FILE_TABLE: fileTable,
            });
          }
        }
      } catch (e) {
        const errorCategory = categorizeOCRError(e.message);
        console.error(
          `[${errorCategory}] Meta/store failed; defer to fallback: ${fileId} (${e.message})`
        );
        forFallback.push({
          _id: fileId,
          file_url_or_path: "",
          FILE_TABLE: fileTable,
          errorCategory,
          errorMessage: e.message
        });
      }
    })
  );

  if (payload.length === 0) {
    return {
      processed: [],
      failedForFallback: forFallback.length
        ? forFallback
        : batch.map((it) => ({
            _id: it.FILE_ID || it.file_id,
            FILE_TABLE: it.FILE_TABLE || it.file_table,
          })),
    };
  }

  // one OCR call for the batch
  let ocrData;
  try {
    ocrData = await postJsonWithRetry(ocrUrl, payload, {
      tries: OCR_RETRIES,
      timeout: OCR_TIMEOUT_MS,
    });
  } catch (e) {
    const errorCategory = categorizeOCRError(e.message);
    console.error(
      `[${errorCategory}] Primary OCR failed for batch (${e.message}); deferring entire payload to fallback.`
    );
    // Tag failed items with error category for better tracking
    const taggedPayload = payload.map(item => ({
      ...item,
      errorCategory,
      errorMessage: e.message
    }));
    return { processed: [], failedForFallback: [...forFallback, ...taggedPayload] };
  }

  if (!Array.isArray(ocrData)) {
    console.warn(`OCR returned non-array; deferring payload to fallback.`);
    return { processed: [], failedForFallback: [...forFallback, ...payload] };
  }

  console.log(`OCR returned ${ocrData.length} item(s) for this batch`);

  const byId = new Map(ocrData.map((x) => [x._id, x]));
  const processed = [];
  const failedForFallback = [...forFallback];

  // Process each OCR result and perform SAP validation
  for (const rec of payload) {
    const d = byId.get(rec._id);
    const fileData = fileMetaDataMap.get(rec._id);
    if (d && fileData && fileData.FILE_NAME) {
      const pr = toProcessedRecord(d, rec._id, job, fileData, base_url);
      if (pr) {
        // ======== NEW: SAP API VALIDATION ========
        const validatedRecord = await performSapCheck(
          pr,
          wmsUrl,
          userName,
          passWord
        );
        processed.push(validatedRecord);
      } else {
        failedForFallback.push(rec); // keep for fallback if mapping failed
      }
    } else {
      failedForFallback.push(rec);
    }
  }

  return { processed, failedForFallback };
}

// Helper function to process a fallback group
async function processFallbackGroup(group, ocrData, job, base_url, wmsUrl, userName, passWord, processed, stillFailed) {
  if (!Array.isArray(ocrData)) {
    console.warn(`OCR returned non-array. Marking group failed.`);
    stillFailed.push(...group);
    return;
  }

  const fileMetaDataMap = new Map();
  await Promise.all(
    group.map(async (rec) => {
      try {
        const fileRes = await fetchWithTimeout(
          `${BASE_URL}/pod/file?fileId=${rec._id}&fileTable=${
            rec.FILE_TABLE || "XTI_FILE_POD_T"
          }`
        );
        if (!fileRes.ok)
          throw new Error(`file meta ${rec._id} HTTP_${fileRes.status}`);
        const fileData = await fileRes.json();
        fileMetaDataMap.set(rec._id, fileData);
      } catch (e) {
        console.warn(
          `Fallback meta fetch failed for ${rec._id}: ${e.message}`
        );
      }
    })
  );

  const byId = new Map(ocrData.map((x) => [x._id, x]));
  for (const rec of group) {
    const d = byId.get(rec._id);
    const fileData = fileMetaDataMap.get(rec._id);
    if (d && fileData && fileData.FILE_NAME) {
      const pr = toProcessedRecord(d, rec._id, job, fileData, base_url);
      if (pr) {
        const validatedRecord = await performSapCheck(
          pr,
          wmsUrl,
          userName,
          passWord
        );
        processed.push(validatedRecord);
      } else {
        stillFailed.push(rec);
      }
    } else {
      stillFailed.push(rec);
    }
  }
}

// ======== FALLBACK PASS (after all primary batches complete) ========
async function processFallbackBatches(
  ocrUrl,
  failedList,
  job,
  base_url,
  wmsUrl,
  userName,
  passWord
) {
  const processed = [];
  const stillFailed = [];

  // Separate failures by error category for targeted recovery
  const categorizedFailures = {
    pdfErrors: [],
    urlErrors: [],
    networkErrors: [],
    other: []
  };

  for (const item of failedList) {
    const category = item.errorCategory || 'UNKNOWN';
    if (category.includes('PDF') || category === 'ENCRYPTED_PDF' || category === 'INVALID_PDF_HEADER') {
      categorizedFailures.pdfErrors.push(item);
    } else if (category.includes('URL') || category === 'MISSING_PROTOCOL') {
      categorizedFailures.urlErrors.push(item);
    } else if (category.includes('NETWORK') || category === 'TIMEOUT') {
      categorizedFailures.networkErrors.push(item);
    } else {
      categorizedFailures.other.push(item);
    }
  }

  console.log(`Fallback categorization: PDF errors=${categorizedFailures.pdfErrors.length}, URL errors=${categorizedFailures.urlErrors.length}, Network errors=${categorizedFailures.networkErrors.length}, Other=${categorizedFailures.other.length}`);

  // Strategy 1: Retry network/timeout errors with increased timeout
  if (categorizedFailures.networkErrors.length > 0) {
    console.log(`Fallback Strategy 1: Retrying ${categorizedFailures.networkErrors.length} network/timeout errors with extended timeout`);
    const groups = chunk(categorizedFailures.networkErrors, FALLBACK_BATCH_SIZE);

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      let ocrData;
      try {
        // Extended timeout for network issues (2.5x normal)
        ocrData = await postJsonWithRetry(ocrUrl, group, {
          tries: OCR_RETRIES,
          timeout: Math.floor(OCR_TIMEOUT_MS * 2.5),
        });
      } catch (e) {
        const errorCategory = categorizeOCRError(e.message);
        console.warn(
          `[${errorCategory}] Fallback Strategy 1 failed for group ${gi + 1}/${groups.length}: ${e.message}`
        );
        stillFailed.push(...group.map(item => ({
          ...item,
          errorCategory,
          errorMessage: e.message
        })));
        await cooldownAndGc();
        continue;
      }

      await processFallbackGroup(group, ocrData, job, base_url, wmsUrl, userName, passWord, processed, stillFailed);
      await cooldownAndGc();
    }
  }

  // Strategy 2: Retry URL errors (these might succeed now with fixed URL construction)
  if (categorizedFailures.urlErrors.length > 0) {
    console.log(`Fallback Strategy 2: Retrying ${categorizedFailures.urlErrors.length} URL errors`);
    const groups = chunk(categorizedFailures.urlErrors, FALLBACK_BATCH_SIZE);

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      let ocrData;
      try {
        ocrData = await postJsonWithRetry(ocrUrl, group, {
          tries: OCR_RETRIES,
          timeout: OCR_TIMEOUT_MS,
        });
      } catch (e) {
        const errorCategory = categorizeOCRError(e.message);
        console.warn(
          `[${errorCategory}] Fallback Strategy 2 failed for group ${gi + 1}/${groups.length}: ${e.message}`
        );
        stillFailed.push(...group.map(item => ({
          ...item,
          errorCategory,
          errorMessage: e.message
        })));
        await cooldownAndGc();
        continue;
      }

      await processFallbackGroup(group, ocrData, job, base_url, wmsUrl, userName, passWord, processed, stillFailed);
      await cooldownAndGc();
    }
  }

  // Strategy 3: Try "other" errors with standard retry
  if (categorizedFailures.other.length > 0) {
    console.log(`Fallback Strategy 3: Retrying ${categorizedFailures.other.length} other errors`);
    const groups = chunk(categorizedFailures.other, FALLBACK_BATCH_SIZE);

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];

      // Retry OCR for this group
      let ocrData;
      try {
        ocrData = await postJsonWithRetry(ocrUrl, group, {
          tries: OCR_RETRIES,
          timeout: OCR_TIMEOUT_MS,
        });
      } catch (e) {
        const errorCategory = categorizeOCRError(e.message);
        console.warn(
          `[${errorCategory}] Fallback Strategy 3 failed for group ${gi + 1}/${groups.length}: ${e.message}`
        );
        stillFailed.push(...group.map(item => ({
          ...item,
          errorCategory,
          errorMessage: e.message
        })));
        await cooldownAndGc();
        continue;
      }

      await processFallbackGroup(group, ocrData, job, base_url, wmsUrl, userName, passWord, processed, stillFailed);
      await cooldownAndGc();
    }
  }

  // Strategy 4: Skip PDF errors (these are deterministic failures)
  // Log them as permanently failed - no retry
  if (categorizedFailures.pdfErrors.length > 0) {
    console.log(`Fallback Strategy 4: Skipping ${categorizedFailures.pdfErrors.length} PDF format errors (deterministic failures - no retry)`);
    stillFailed.push(...categorizedFailures.pdfErrors);
  }

  return { processed, stillFailed };
}

// ======== SAVE HELPERS ========
async function saveProcessedRecords(base_url, records) {
  if (!records.length) return;

  try {
    const confirmRes = await fetchWithTimeout(
      `${BASE_URL}/settings/auto-confirmation`
    );
    const confirmJson = await confirmRes.json().catch(() => ({}));
    if (confirmJson?.isAutoConfirmationOpen) {
      for (const part of chunk(records, SAVE_CHUNK_SIZE)) {
        const res = await fetchWithTimeout(`${BASE_URL}/pod/update`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ocrDataList: part }),
        });
        const text = await res.text();
        if (!res.ok)
          console.error(
            `/pod/update HTTP_${res.status}: ${text.slice(0, 300)}`
          );
      }
    }
  } catch (e) {
    console.warn(`Auto-confirmation step failed: ${e.message}`);
  }

  // 2) Persist processed data
  for (const part of chunk(records, SAVE_CHUNK_SIZE)) {
    const res = await fetchWithTimeout(`${BASE_URL}/process-data/save-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(part),
    });
    const text = await res.text();
    if (!res.ok)
      console.error(
        `/process-data/save-data HTTP_${res.status}: ${text.slice(0, 300)}`
      );
    for (const entry of part)
      console.log(`File ${entry.fileId} processed (saved).`);
  }
}

// ======== JOB RUNNER ========
async function runOcrForJob(ocrUrl, job, base_url, wmsUrl, userName, passWord, abortSignal) {
  console.log(`OCR script started for job ${job._id}`);
  const dbConnectionType = getDBConnectionType();
  console.log("db connection ->", dbConnectionType);

  try {
    // Check if job was aborted before starting
    if (abortSignal?.aborted) {
      console.log(`Job ${job._id} was aborted before starting`);
      return;
    }
    
    const retrieveRes = await fetchWithTimeout(
      `${BASE_URL}/pod/retrieve?dayOffset=${job.dayOffset}&fetchLimit=${job.fetchLimit}`
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
    console.log(
      `Chunked into ${batches.length} batches, last batch size = ${
        batches[batches.length - 1]?.length || 0
      }`
    );
    const primaryQueue = new PQueue({ concurrency: PRIMARY_CONCURRENCY });

    let totalProcessed = 0;
    let totalDeferred = 0;
    const fallbackBucket = [];

    // STREAM-SAVE PER BATCH
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      primaryQueue.add(async () => {
        try {
          // Check if job was aborted
          if (abortSignal?.aborted) {
            console.log(`Job ${job._id} aborted during batch ${i + 1}/${batches.length}`);
            return; // Exit gracefully instead of throwing
          }

          console.log(
            `Primary batch ${i + 1}/${batches.length} (size=${batch.length})`
          );

          const { processed, failedForFallback } = await processPrimaryBatch(
            ocrUrl,
            batch,
            job,
            base_url,
            wmsUrl,
            userName,
            passWord
          );

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
            `Progress so far → processed=${totalProcessed}, deferred=${totalDeferred}, batch=${
              i + 1
            }/${batches.length}`
          );

          // --- added: let OCR server free GPU memory between batches ---
          await cooldownAndGc();
        } catch (error) {
          // Handle errors within the queue task to prevent unhandled rejections
          if (abortSignal?.aborted || error.message === 'Job aborted') {
            console.log(`Batch ${i + 1}/${batches.length} aborted for job ${job._id}`);
          } else {
            console.error(`Error in batch ${i + 1}/${batches.length}:`, error.message);
          }
        }
      });
    }

    // Wait until ALL primary batches finish
    await primaryQueue.onIdle();
    console.log(
      `Primary pass complete. Processed (saved): ${totalProcessed}, Deferred: ${fallbackBucket.length}`
    );

    // Fallback pass on accumulated failures
    if (fallbackBucket.length > 0) {
      // Check if job was aborted before fallback
      if (abortSignal?.aborted) {
        console.log(`Job ${job._id} aborted before fallback pass`);
        return;
      }

      console.log(
        `Starting fallback pass for ${fallbackBucket.length} file(s)...`
      );
      const { processed: fbProcessed, stillFailed } =
        await processFallbackBatches(
          ocrUrl,
          fallbackBucket,
          job,
          base_url,
          wmsUrl,
          userName,
          passWord
        );
      console.log(
        `Fallback complete. Recovered: ${fbProcessed.length}, Still failed: ${stillFailed.length}`
      );

      // Save fallback recoveries
      if (fbProcessed.length) await saveProcessedRecords(base_url, fbProcessed);

      // Persist failed files with error details
      if (stillFailed.length) {
        console.warn(
          `Unrecoverable after fallback: ${stillFailed
            .map((x) => x._id)
            .join(", ")}`
        );

        // Generate failure report with categorized errors
        const failureReport = {
          timestamp: new Date().toISOString(),
          jobId: job._id,
          totalFailed: stillFailed.length,
          errors: stillFailed.map(item => ({
            fileId: item._id,
            errorCategory: item.errorCategory || 'UNKNOWN',
            errorMessage: item.errorMessage || 'No error message',
            errorDetails: item.errorDetails || '',
            fileTable: item.FILE_TABLE
          })),
          errorSummary: stillFailed.reduce((acc, item) => {
            const category = item.errorCategory || 'UNKNOWN';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {})
        };

        console.log('Failure Report Summary:', JSON.stringify(failureReport.errorSummary, null, 2));

        // Save failure report
        try {
          const reportRes = await fetchWithTimeout(`${BASE_URL}/process-data/save-failures`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(failureReport),
          });
          if (reportRes.ok) {
            console.log('Failure report saved successfully');
          } else {
            console.warn(`Failed to save failure report: HTTP ${reportRes.status}`);
          }
        } catch (err) {
          console.error(`Error saving failure report: ${err.message}`);
        }
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

function scheduleOne(ocrUrl, job, base_url, wmsUrl, userName, passWord) {
  const cronExp = getCronExpressionFromTime(job.everyTime);
  if (!cron.validate(cronExp)) {
    console.error(`Invalid cron expression for job ${job._id}: ${cronExp}`);
    return;
  }

  const key = String(job._id);

  const task = cron.schedule(cronExp, async () => {
    // Cancel ALL other running jobs before starting this one
    const runningJobsCount = jobRunning.size;
    if (runningJobsCount > 0) {
      console.log(`⚠ ${runningJobsCount} job(s) currently running. Cancelling all before starting job ${key}...`);

      // Cancel all running jobs (no exclusions - stop everything)
      cancelAllRunningJobs();

      // Wait a moment for cleanup
      await sleep(1000);
      console.log(`✓ All previous jobs cancelled. Starting job ${key}`);
    }

    // Create new abort controller for this job run
    const abortController = new AbortController();
    jobAbortControllers.set(key, abortController);

    // Setup timeout handler
    const timeoutId = setTimeout(() => {
      console.error(`[TIMEOUT] Job ${key} exceeded timeout of ${JOB_TIMEOUT_MS}ms (${JOB_TIMEOUT_MS / 60000} minutes), force-stopping`);
      abortController.abort();
      jobRunning.delete(key);
      jobTimeouts.delete(key);
      jobAbortControllers.delete(key);
    }, JOB_TIMEOUT_MS);

    jobTimeouts.set(key, timeoutId);

    const runPromise = (async () => {
      const startTime = Date.now();
      try {
        const now = new Date();
        const currentDay = now.toLocaleString("en-US", { weekday: "long" });
        const currentTime = `${String(now.getHours()).padStart(
          2,
          "0"
        )}:${String(now.getMinutes()).padStart(2, "0")}`;

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
          console.log(`✓ Running OCR Job: ${key} at ${currentTime}`);
          await runOcrForJob(ocrUrl, job, base_url, wmsUrl, userName, passWord, abortController.signal);
          const duration = Date.now() - startTime;
          console.log(`✓ Job ${key} completed successfully in ${Math.round(duration / 60000)} minutes`);
        } else {
          console.log(`⏳ Job ${key} skipped (day/time window not matched).`);
        }
      } catch (e) {
        const duration = Date.now() - startTime;
        if (e.message === 'Job aborted' || abortController.signal.aborted) {
          console.log(`Job ${key} was cancelled after ${Math.round(duration / 60000)} minutes`);
        } else {
          console.error(`Error running job ${key}:`, e.message);
          console.error(`Job ${key} failed after ${Math.round(duration / 60000)} minutes`);
        }
      } finally {
        // Clear timeout
        const timeoutId = jobTimeouts.get(key);
        if (timeoutId) {
          clearTimeout(timeoutId);
          jobTimeouts.delete(key);
        }
        jobRunning.delete(key);
        jobAbortControllers.delete(key);
      }
    })();

    jobRunning.set(key, runPromise);
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

    const ipRes = await fetchWithTimeout(
      `${BASE_URL}/ipAddress/ip-address`
    ).catch(() => null);
    const ipData = await ipRes.json();
    const ocrUrl = OCR_URL;

    let base_url = BASE_URL;

    
    console.log("Using base_url:", base_url);
    const wmsRes = await fetchWithTimeout(`${BASE_URL}/save-wms-url`);
    const {
      wmsUrl,
      username: userName,
      password: passWord,
    } = await wmsRes.json().catch(() => ({}));

    const jobRes = await fetchWithTimeout(`${BASE_URL}/jobs/get-job`);
    const jobJson = await jobRes.json();
    const jobs = jobJson.activeJobs || [];

    const newHash = makeJobsHash(jobs);

    if (isInitialLoad) {
      console.log(`Initial load: scheduling ${jobs.length} jobs`);
      for (const job of jobs)
        scheduleOne(ocrUrl, job, base_url, wmsUrl, userName, passWord);
      currentJobsHash = newHash;
      isInitialLoad = false;
      return true;
    }

    const { added, removed, changed, kept } = compareJobs(
      jobs,
      scheduledTasks,
      currentJobsHash
    );

    for (const id of removed) {
      const task = scheduledTasks.get(id);
      if (task) {
        try {
          task.stop();
          task.destroy?.();
        } catch {}
      }
      scheduledTasks.delete(id);
      console.log(`✗ Removed job ${id}`);
    }
    for (const job of changed) {
      const id = String(job._id);
      const task = scheduledTasks.get(id);
      if (task) {
        try {
          task.stop();
          task.destroy?.();
        } catch {}
      }
      scheduledTasks.delete(id);
      console.log(`↻ Will reschedule changed job ${id}`);
    }
    for (const job of [...added, ...changed])
      scheduleOne(ocrUrl, job, base_url, wmsUrl, userName, passWord);

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

// start + periodic diffing
waitForAPI();
const jobCheckInterval = setInterval(async () => {
  console.log("⏰ Checking for updated jobs...");
  const changed = await scheduleJobs();
  if (changed) console.log("✓ Job set updated");
  else console.log("No changes; schedules intact.");
}, 150000);

process.on("exit", () => clearInterval(jobCheckInterval));
