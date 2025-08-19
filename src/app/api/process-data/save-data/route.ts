import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function POST(req: Request) {
  try {
    const dataArray = await req.json();
    console.log('data ara-> ', dataArray)

    if (!Array.isArray(dataArray)) {
      return NextResponse.json(
        { error: "Input must be an array of objects" },
        { status: 400 }
      );
    }

    const requiredFields = [
      "_id",
      "fileId",
      "blNumber",
      "jobId",
      "pdfUrl",
      "podDate",
      "podSignature",
      "totalQty",
      "received",
      "damaged",
      "short",
      "over",
      "refused",
      "customerOrderNum",
      "stampExists",
      "finalStatus",
      "reviewStatus",
      "recognitionStatus",
      "breakdownReason",
      "reviewedBy",
      "uptd_Usr_Cd",
      "cargoDescription",
    ];

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const existingRecords = await db
      .collection("mockData")
      .find({ pdfUrl: { $in: dataArray.map((d) => d.pdfUrl) } })
      .toArray();

    const existingMap = new Map(
      existingRecords.map((record) => [record.pdfUrl, record])
    );

    const bulkOps = [];

    for (const data of dataArray) {
      for (const field of requiredFields) {
        if (typeof data[field] === "string") {
          data[field] = data[field].trim();
        }
      }

      const intFields = [
        "totalQty",
        "received",
        "damaged",
        "short",
        "over",
        "refused",
      ];
      for (const field of intFields) {
        const value = data[field];
        if (typeof value === "string" && /^\d+$/.test(value)) {
          data[field] = parseInt(value, 10);
        }
      }

      const { jobId, pdfUrl } = data;

      // Ensure jobId is properly assigned
      if (!jobId || jobId.trim() === "") {
        data.jobId = "";
        data.jobName = "";
      } else {
        const job = await db
          .collection("jobs")
          .findOne({ _id: new ObjectId(jobId) });
        data.jobName = job ? job.jobName : "";
      }

      // if (typeof data.blNumber === "number") {
      //   data.blNumber = data.blNumber.toString();
      // }

      if (typeof data.blNumber === "string" && /^\d+$/.test(data.blNumber)) {
        data.blNumber = parseInt(data.blNumber, 10);
      }

      // If pdfUrl already exists, update it instead of inserting a new record
      if (existingMap.has(pdfUrl)) {
        bulkOps.push({
          updateOne: {
            filter: { pdfUrl },
            update: { $set: { ...data } },
            // update: { $set: { ...data, updatedAt: new Date() } }
          },
        });
      } else {
        bulkOps.push({
          insertOne: {
            document: {
              ...data,
              createdAt: new Date(),
            },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      const result = await db.collection("mockData").bulkWrite(bulkOps);
      return NextResponse.json(
        {
          message: "Data processed successfully",
          modifiedCount: result.modifiedCount,
          insertedCount: result.insertedCount,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: "No valid data to process" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error saving/updating mock data:", error);
    return NextResponse.json(
      { error: "Failed to save/update mock data" },
      { status: 500 }
    );
  }
}
