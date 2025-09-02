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
const scheduledTasks = new Map();

function clearScheduledJobs() {
  for (const [jobId, task] of scheduledTasks.entries()) {
    task.stop();
    scheduledTasks.delete(jobId);
  }
}

function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(id));
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
    console.log("batch is-> ", batch);
    await Promise.all(
      batch.map(async (item) => {
        const fileId = item.FILE_ID || item.file_id;
        const fileTable = item.FILE_TABLE || item.file_table;
        console.log("fileId is-> ", fileId, "fileTable is-> ", fileTable);
        const fileRes = await fetchWithTimeout(
          `${base_url}/pod/file?fileId=${fileId}&fileTable=${fileTable}`,
          {},
          5000
        );
        console.log("fileRes is-> ", fileRes);
        if (!fileRes.ok) return;

        const fileData = await fileRes.json();
        fileMetaDataMap.set(fileId, fileData);
        // console.log("fileData is-> ", fileData);
        await fetchWithTimeout(
          `${base_url}/pod/store`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: fileData.FILE_ID }),
          },
          5000
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

    const ocrRes = await fetchWithTimeout(
      ocrUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      200000
    );
    console.log("ocr response is-> ", ocrRes);
    if (!ocrRes.ok) {
      const errJson = await ocrRes.json().catch(() => null);
      throw new Error(errJson?.error || "OCR Failed");
    }

    const ocrData = await ocrRes.json();
    console.log("ocrData is-> ", ocrData);
    if (!Array.isArray(ocrData)) return;
    const processedBatch = [];

    await Promise.all(
      ocrData.map(async (d) => {
        const fileId = d._id;
        const fileData = fileMetaDataMap.get(fileId);
        // console.log("filedata is-> ", fileData);
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

        // try {
        //   const basicAuth = Buffer.from(`${userName}:${passWord}`).toString(
        //     "base64"
        //   );
        //   const response = await fetchWithTimeout(
        //     wmsUrl,
        //     {
        //       method: "POST",
        //       headers: {
        //         Authorization: `Basic ${basicAuth}`,
        //         Accept: "application/json",
        //         "Content-Type": "application/json",
        //       },
        //       body: JSON.stringify({ BOLNo: [processed.blNumber] }),
        //     },
        //     15000
        //   );

        //   const sapData = await response.json();
        //   processed.recognitionStatus =
        //     sapData[0]?.BOLNo?.trim() === processed.blNumber.trim()
        //       ? "valid"
        //       : "failure";
        // } catch (err) {
        //   console.error("SAP check error:", err.message);
        // }

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
  console.log("ocr script started.");
  const dbConnectionType = getDBConnectionType();
  console.log("db connection-> ", dbConnectionType);
  try {
    const retrieveRes = await fetchWithTimeout(
      `${base_url}/pod/retrieve?dayOffset=${dayOffset}&fetchLimit=${fetchLimit}`,
      {},
      5000
    );
    const fileList = await retrieveRes.json();
    console.log("file list-> ", fileList);

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
  } catch (err) {
    console.error("OCR job error:", err.message);
  }
}

function getCronExpressionFromTime(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);

  if (hours === 0 && minutes > 0) {
    return `*/${minutes} * * * *`;
  }

  if (minutes === 0 && hours > 0) {
    return `0 */${hours} * * *`;
  }

  if (hours > 0 && minutes > 0) {
    return `${minutes} */${hours} * * *`;
  }

  return "* * * * *";
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
      return;
    }

    const ipRes = await fetchWithTimeout(
      `${baseURL}/ipAddress/ip-address`,
      {},
      5000
    );
    const ipData = await ipRes.json();
    // const baseUrl = `http://${ipData.secondaryIp}:3000`;
    const base_url = `https://h0palyajms52cn-8080.proxy.runpod.net/api`;

    // const ocrUrl = `http://${ipData.ip}:8080/run-ocr`;
    const ocrUrl = `https://zydfs3qh4hkuh9-8080.proxy.runpod.net/run-ocr`;

    const wmsRes = await fetchWithTimeout(`${base_url}/save-wms-url`, {}, 5000);
    const {
      wmsUrl,
      username: userName,
      password: passWord,
    } = await wmsRes.json();

    const jobRes = await fetchWithTimeout(`${base_url}/jobs/get-job`, {}, 5000);
    const jobJson = await jobRes.json();
    const jobs = jobJson.activeJobs;

    clearScheduledJobs();

    for (const job of jobs) {
      const intervalStr = job.everyTime;
      const cronExp = getCronExpressionFromTime(intervalStr);

      const task = cron.schedule(cronExp, async () => {
        const now = new Date();
        const currentDay = now.toLocaleString("en-US", { weekday: "long" });
        const currentTimeStr = `${String(now.getHours()).padStart(
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
          runOcrForJob(
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

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function waitForAPI(retries = 10, interval = 2000) {
  const url = `${baseURL}/auth/public-db`;
  while (retries--) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        console.log("API is up, starting scheduler...");
        await scheduleJobs();
        return;
      }
    } catch (err) {
      console.log("Waiting for API to be ready...");
      await delay(interval);
    }
  }
  console.error("API failed to respond after multiple retries.");
}

waitForAPI();

setInterval(() => {
  console.log("Checking for updated jobs...");
  scheduleJobs();
}, 60000);
