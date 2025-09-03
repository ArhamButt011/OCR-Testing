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
let currentJobsHash = null; // Track changes in jobs
let isInitialLoad = true;

function compareJobs(newJobs, existingJobIds) {
  const newJobIds = new Set(newJobs.map((job) => job._id));
  const existing = new Set(existingJobIds);

  const added = [...newJobIds].filter((id) => !existing.has(id));
  const removed = [...existing].filter((id) => !newJobIds.has(id));
  const common = [...newJobIds].filter((id) => existing.has(id));

  return { added, removed, common, newJobIds };
}

function clearScheduledJobs() {
  console.log(`Clearing ${scheduledTasks.size} scheduled jobs...`);
  for (const [jobId, task] of scheduledTasks.entries()) {
    try {
      task.destroy(); // Use destroy() instead of stop() for complete cleanup
      console.log(`Cleared job: ${jobId}`);
    } catch (err) {
      console.error(`Error clearing job ${jobId}:`, err.message);
    }
  }
  scheduledTasks.clear();
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
  console.log(`OCR script started for job: ${job._id}`);
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
      console.log(`Added batch to queue.`, queue.size);
    }

    await queue.onIdle();
    console.log(`All batches processed for job: ${job._id}`);
  } catch (err) {
    console.error("OCR job error:", err.message);
  }
}

function getCronExpressionFromTime(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);

  // Every X minutes (if hours is 0 and minutes > 0)
  if (hours === 0 && minutes > 0) {
    return `*/${minutes} * * * *`;
  }

  // Every X hours (if minutes is 0 and hours > 0)
  if (minutes === 0 && hours > 0) {
    return `0 */${hours} * * *`;
  }

  // Every X hours at Y minutes past the hour
  if (hours > 0 && minutes > 0) {
    return `${minutes} */${hours} * * *`;
  }

  // Default: every minute
  return "* * * * *";
}

function isTimeInRange(currentTime, fromTime, toTime) {
  // Handle case where time range crosses midnight
  if (fromTime > toTime) {
    return currentTime >= fromTime || currentTime <= toTime;
  }
  return currentTime >= fromTime && currentTime <= toTime;
}

function createJobHash(jobs) {
  // Create a hash of job configurations to detect changes
  const jobData = jobs.map((job) => ({
    id: job._id,
    everyTime: job.everyTime,
    selectedDays: job.selectedDays,
    fromTime: job.pdfCriteria.fromTime,
    toTime: job.pdfCriteria.toTime,
    dayOffset: job.dayOffset,
    fetchLimit: job.fetchLimit,
  }));
  return JSON.stringify(jobData);
}

async function scheduleJobs() {
  try {
    console.log("Fetching database configuration...");
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

    console.log("Fetching IP configuration...");
    const ipRes = await fetchWithTimeout(
      `${baseURL}/ipAddress/ip-address`,
      {},
      5000
    );
    const ipData = await ipRes.json();
    // const baseUrl = `http://${ipData.secondaryIp}:3000`;
    const base_url = `https://h0palyajms52cn-8080.proxy.runpod.net/api`;

    // const ocrUrl = `http://${ipData.ip}:8080/run-ocr`;
    const ocrUrl = `https://w70nd5g17ekhdj-8080.proxy.runpod.net/run-ocr`;

    console.log("Fetching WMS configuration...");
    const wmsRes = await fetchWithTimeout(`${base_url}/save-wms-url`, {}, 5000);
    const {
      wmsUrl,
      username: userName,
      password: passWord,
    } = await wmsRes.json();

    console.log("Fetching active jobs...");
    const jobRes = await fetchWithTimeout(`${base_url}/jobs/get-job`, {}, 5000);
    const jobJson = await jobRes.json();
    const jobs = jobJson.activeJobs;

    // On initial load, always schedule all jobs
    if (isInitialLoad) {
      console.log("Initial load: Scheduling all jobs...");
      clearScheduledJobs();
      currentJobsHash = createJobHash(jobs);
      isInitialLoad = false;
    } else {
      // For subsequent loads, check for changes
      const newJobsHash = createJobHash(jobs);
      if (newJobsHash === currentJobsHash) {
        console.log("No job changes detected, keeping existing schedules.");
        return false;
      }

      console.log("Job changes detected, analyzing differences...");

      // Compare jobs to see what changed
      const currentJobIds = Array.from(scheduledTasks.keys());
      const { added, removed, common } = compareJobs(jobs, currentJobIds);

      console.log(
        `Jobs added: ${added.length}, removed: ${removed.length}, unchanged: ${common.length}`
      );

      // Remove only the jobs that are no longer active
      if (removed.length > 0) {
        console.log(`Removing deleted jobs: ${removed.join(", ")}`);
        for (const jobId of removed) {
          const task = scheduledTasks.get(jobId);
          if (task) {
            try {
              task.destroy();
              scheduledTasks.delete(jobId);
              console.log(`✓ Removed job: ${jobId}`);
            } catch (err) {
              console.error(`Error removing job ${jobId}:`, err.message);
            }
          }
        }
      }

      // Check if existing jobs have configuration changes
      const jobsToReschedule = [];
      const existingJobs = jobs.filter((job) => common.includes(job._id));

      for (const job of existingJobs) {
        const existingJobHash = createJobHash([job]);
        const previousJob = currentJobsHash
          ? JSON.parse(currentJobsHash).find((j) => j.id === job._id)
          : null;

        if (
          previousJob &&
          JSON.stringify(previousJob) !==
            JSON.stringify({
              id: job._id,
              everyTime: job.everyTime,
              selectedDays: job.selectedDays,
              fromTime: job.pdfCriteria.fromTime,
              toTime: job.pdfCriteria.toTime,
              dayOffset: job.dayOffset,
              fetchLimit: job.fetchLimit,
            })
        ) {
          jobsToReschedule.push(job);
          console.log(`Job ${job._id} configuration changed, will reschedule`);
        }
      }

      // Remove jobs that need rescheduling
      for (const job of jobsToReschedule) {
        const task = scheduledTasks.get(job._id);
        if (task) {
          try {
            task.destroy();
            scheduledTasks.delete(job._id);
            console.log(`✓ Removed job for rescheduling: ${job._id}`);
          } catch (err) {
            console.error(
              `Error removing job ${job._id} for rescheduling:`,
              err.message
            );
          }
        }
      }

      // Only schedule new jobs and jobs that need rescheduling
      const jobsToSchedule = [
        ...jobs.filter((job) => added.includes(job._id)),
        ...jobsToReschedule,
      ];

      if (jobsToSchedule.length === 0) {
        console.log("No jobs need scheduling, keeping existing schedules.");
        return false;
      }

      console.log(
        `Scheduling ${jobsToSchedule.length} jobs (${added.length} new, ${jobsToReschedule.length} rescheduled)`
      );
      jobs.splice(0, jobs.length, ...jobsToSchedule); // Replace jobs array with only jobs to schedule

      currentJobsHash = newJobsHash;
    }

    let scheduledCount = 0;
    for (const job of jobs) {
      try {
        const intervalStr = job.everyTime;
        const cronExp = getCronExpressionFromTime(intervalStr);

        // Validate cron expression
        if (!cron.validate(cronExp)) {
          console.error(
            `Invalid cron expression for job ${job._id}: ${cronExp}`
          );
          continue;
        }

        const task = cron.schedule(
          cronExp,
          async () => {
            try {
              const now = new Date();
              const currentDay = now.toLocaleString("en-US", {
                weekday: "long",
              });
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

              console.log(
                `Job ${job._id} - Current: ${currentDay} ${currentTime}, Range: ${fromTimeStr}-${toTimeStr}`
              );

              const isDaySelected = job.selectedDays.includes(currentDay);
              const isTimeInWindow = isTimeInRange(
                currentTime,
                fromTimeStr,
                toTimeStr
              );

              if (isDaySelected && isTimeInWindow) {
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
                console.log(
                  `⏳ Job ${job._id} conditions not met - Day: ${isDaySelected}, Time: ${isTimeInWindow}`
                );
              }
            } catch (taskError) {
              console.error(`Error running job ${job._id}:`, taskError.message);
            }
          },
          {
            scheduled: false, // Don't start immediately
          }
        );

        // Start the task
        task.start();
        scheduledTasks.set(job._id, task);
        scheduledCount++;
        console.log(`✓ Scheduled job ${job._id} with cron: ${cronExp}`);
      } catch (jobError) {
        console.error(`Error scheduling job ${job._id}:`, jobError.message);
      }
    }

    const totalScheduled = scheduledTasks.size;
    console.log(
      `Successfully scheduled ${scheduledCount} jobs. Total active jobs: ${totalScheduled}`
    );
    return true;
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
        if (success) {
          console.log("✓ Initial scheduling completed");
        }
        return;
      }
    } catch (err) {
      console.log(`⏳ API not ready, ${retries} retries left...`);
      if (retries > 0) {
        await delay(interval);
      }
    }
  }
  console.error("❌ API failed to respond after multiple retries.");
}

// Graceful shutdown handler
process.on("SIGINT", () => {
  console.log("Received SIGINT, gracefully shutting down...");
  clearScheduledJobs();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, gracefully shutting down...");
  clearScheduledJobs();
  process.exit(0);
});

// Start the application
waitForAPI();

// Check for job updates every 2.5 minutes
const jobCheckInterval = setInterval(async () => {
  console.log("⏰ Checking for updated jobs...");
  try {
    const success = await scheduleJobs();
    if (success) {
      console.log("✓ Job check completed");
    }
  } catch (err) {
    console.error("Error during job check:", err.message);
  }
}, 150000);

// Clean up interval on exit
process.on("exit", () => {
  clearInterval(jobCheckInterval);
});
