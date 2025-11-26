// app/api/mock/update/route.ts
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

          let filter: Filter<Document> = { _id };
          if (ObjectId.isValid(_id)) {
            filter = { $or: [{ _id }, { _id: new ObjectId(_id) }] };
          }

          return {
            updateOne: {
              filter,
              update: { $set: { ...updatedData, updatedAt: new Date() } },
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

    const { _id, ...updatedData } = body;
    if (!_id) {
      return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
    }

    let filter: Filter<Document> = { _id };
    if (ObjectId.isValid(_id)) {
      filter = { $or: [{ _id }, { _id: new ObjectId(_id) }] };
    }

    const result = await dataCollection.updateOne(
      filter,
      { $set: { ...updatedData, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Job updated successfully", updatedData },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating job:", error);
    return NextResponse.json(
      { error: "Failed to update job" },
      { status: 500 }
    );
  }
}

export const PUT = withLogging(putHandler);
