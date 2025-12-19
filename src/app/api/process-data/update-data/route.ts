// app/api/process-data/update-data/route.ts
import { NextResponse } from "next/server";
import { ObjectId, AnyBulkWriteOperation, Document, Filter } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper"; 

const DB_NAME = process.env.DB_NAME || "my-next-app";

async function putHandler(req: Request, context?: any) {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const dataCollection = db.collection("mockData");

    const body = await req.json();

    console.log("Update body:", body);

    if (Array.isArray(body)) {
      const bulkOps: AnyBulkWriteOperation<Document>[] = body
        .map((doc) => {
          const { _id, ...updatedData } = doc;
          if (!_id) return null; 

          // ✅ Process new OCR fields
          const processedData: any = { ...updatedData };

          // 1. Confidence (float between 0-1)
          if (updatedData.confidence !== undefined) {
            processedData.confidence = parseFloat(updatedData.confidence) || 0;
          }

          // 2. Processing time (integer in milliseconds)
          if (updatedData.processing_time !== undefined) {
            processedData.processing_time = parseInt(updatedData.processing_time) || 0;
          }

          // 3. Template ID (string or null)
          if (updatedData.template_id !== undefined) {
            processedData.template_id = updatedData.template_id || null;
          }

          // 4. Classification details (object)
          if (updatedData.classification_details) {
            processedData.classification_details = {
              primary_model_prediction: updatedData.classification_details.primary_model_prediction || "",
              primary_confidence: parseFloat(updatedData.classification_details.primary_confidence) || 0,
              secondary_model_prediction: updatedData.classification_details.secondary_model_prediction || "",
              secondary_confidence: parseFloat(updatedData.classification_details.secondary_confidence) || 0,
            };
          }

          // 5. Suggested templates (array of objects)
          if (updatedData.suggested_templates && Array.isArray(updatedData.suggested_templates)) {
            processedData.suggested_templates = updatedData.suggested_templates.map((template: any) => ({
              template_id: template.template_id || "",
              template_name: template.template_name || "",
              match_score: parseFloat(template.match_score) || 0,
              priority: parseInt(template.priority) || 0,
            }));
          }

          // Convert numeric string fields to integers if needed
          const intFields = ["totalQty", "received", "damaged", "short", "over", "refused"];
          for (const field of intFields) {
            if (processedData[field] !== undefined) {
              const value = processedData[field];
              if (typeof value === "string" && /^\d+$/.test(value)) {
                processedData[field] = parseInt(value, 10);
              }
            }
          }

          // Convert blNumber to integer if it's a numeric string
          if (processedData.blNumber !== undefined) {
            if (typeof processedData.blNumber === "string" && /^\d+$/.test(processedData.blNumber)) {
              processedData.blNumber = parseInt(processedData.blNumber, 10);
            }
          }

          let filter: Filter<Document> = { _id };
          if (ObjectId.isValid(_id)) {
            filter = { $or: [{ _id }, { _id: new ObjectId(_id) }] };
          }

          return {
            updateOne: {
              filter,
              update: { $set: { ...processedData, updatedAt: new Date() } },
            },
          } as AnyBulkWriteOperation<Document>;
        })
        .filter(
          (op): op is AnyBulkWriteOperation<Document> => op !== null
        );

      if (bulkOps.length === 0) {
        return NextResponse.json(
          { error: "No valid updates" },
          { status: 400 }
        );
      }

      const result = await dataCollection.bulkWrite(bulkOps, { ordered: false });
      return NextResponse.json(
        { message: "Bulk update complete", result },
        { status: 200 }
      );
    }

    // Single document update
    const { _id, ...updatedData } = body;
    if (!_id) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
    }

    // ✅ Process new OCR fields for single update
    const processedData: any = { ...updatedData };

    // 1. Confidence
    if (updatedData.confidence !== undefined) {
      processedData.confidence = parseFloat(updatedData.confidence) || 0;
    }

    // 2. Processing time
    if (updatedData.processing_time !== undefined) {
      processedData.processing_time = parseInt(updatedData.processing_time) || 0;
    }

    // 3. Template ID
    if (updatedData.template_id !== undefined) {
      processedData.template_id = updatedData.template_id || null;
    }

    // 4. Classification details
    if (updatedData.classification_details) {
      processedData.classification_details = {
        primary_model_prediction: updatedData.classification_details.primary_model_prediction || "",
        primary_confidence: parseFloat(updatedData.classification_details.primary_confidence) || 0,
        secondary_model_prediction: updatedData.classification_details.secondary_model_prediction || "",
        secondary_confidence: parseFloat(updatedData.classification_details.secondary_confidence) || 0,
      };
    }

    // 5. Suggested templates
    if (updatedData.suggested_templates && Array.isArray(updatedData.suggested_templates)) {
      processedData.suggested_templates = updatedData.suggested_templates.map((template: any) => ({
        template_id: template.template_id || "",
        template_name: template.template_name || "",
        match_score: parseFloat(template.match_score) || 0,
        priority: parseInt(template.priority) || 0,
      }));
    }

    // Convert numeric fields
    const intFields = ["totalQty", "received", "damaged", "short", "over", "refused"];
    for (const field of intFields) {
      if (processedData[field] !== undefined) {
        const value = processedData[field];
        if (typeof value === "string" && /^\d+$/.test(value)) {
          processedData[field] = parseInt(value, 10);
        }
      }
    }

    // Convert blNumber
    if (processedData.blNumber !== undefined) {
      if (typeof processedData.blNumber === "string" && /^\d+$/.test(processedData.blNumber)) {
        processedData.blNumber = parseInt(processedData.blNumber, 10);
      }
    }

    let filter: Filter<Document> = { _id };
    if (ObjectId.isValid(_id)) {
      filter = { $or: [{ _id }, { _id: new ObjectId(_id) }] };
    }

    const result = await dataCollection.updateOne(
      filter,
      { $set: { ...processedData, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Document updated successfully", updatedData: processedData },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

export const PUT = withLogging(putHandler);