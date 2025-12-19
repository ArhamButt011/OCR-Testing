// app/api/process-data/save-data/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";

async function postMockDataHandler(
  request: Request,
  context?: any
): Promise<NextResponse> {
  try {
    const dataArray = await request.json();
    console.log('data array-> ', dataArray);

    if (!Array.isArray(dataArray)) {
      return NextResponse.json(
        { error: "Input must be an array of objects" },
        { status: 400 }
      );
    }

    const requiredFields = [
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
      // Trim string fields
      for (const field of requiredFields) {
        if (typeof data[field] === "string") {
          data[field] = data[field].trim();
        }
      }

      // Convert numeric string fields to integers
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

      // Convert blNumber to integer if it's a numeric string
      if (typeof data.blNumber === "string" && /^\d+$/.test(data.blNumber)) {
        data.blNumber = parseInt(data.blNumber, 10);
      }

      // ✅ Handle new OCR fields
      const updateData: any = { ...data };

      // 1. Confidence (float between 0-1)
      if (data.confidence !== undefined) {
        updateData.confidence = parseFloat(data.confidence) || 0;
      }

      // 2. Processing time (integer in milliseconds)
      if (data.processing_time !== undefined) {
        updateData.processing_time = parseInt(data.processing_time) || 0;
      }

      // 3. Template ID (string or null)
      if (data.template_id !== undefined) {
        updateData.template_id = data.template_id || null;
      }

      // 4. Classification details (object)
      if (data.classification_details) {
        updateData.classification_details = {
          primary_model_prediction: data.classification_details.primary_model_prediction || "",
          primary_confidence: parseFloat(data.classification_details.primary_confidence) || 0,
          secondary_model_prediction: data.classification_details.secondary_model_prediction || "",
          secondary_confidence: parseFloat(data.classification_details.secondary_confidence) || 0,
        };
      } else {
        // Set default if not provided
        updateData.classification_details = {
          primary_model_prediction: "",
          primary_confidence: 0,
          secondary_model_prediction: "",
          secondary_confidence: 0,
        };
      }

      // 5. Suggested templates (array of objects)
      if (data.suggested_templates && Array.isArray(data.suggested_templates)) {
        updateData.suggested_templates = data.suggested_templates.map((template: any) => ({
          template_id: template.template_id || "",
          template_name: template.template_name || "",
          match_score: parseFloat(template.match_score) || 0,
          priority: parseInt(template.priority) || 0,
        }));
      } else {
        // Set empty array if not provided
        updateData.suggested_templates = [];
      }

      // If pdfUrl already exists, update it instead of inserting a new record
      if (existingMap.has(pdfUrl)) {
        bulkOps.push({
          updateOne: {
            filter: { pdfUrl },
            update: { 
              $set: { 
                ...updateData,
                updatedAt: new Date() 
              } 
            },
          },
        });
      } else {
        bulkOps.push({
          insertOne: {
            document: {
              ...updateData,
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

export const POST = withLogging(postMockDataHandler);