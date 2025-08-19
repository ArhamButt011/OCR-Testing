import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";


export async function PATCH(req: Request) {
  try {
    const { id, field, value, reviewedBy } = await req.json();

    console.log(reviewedBy);


    if (!id || !field || value === undefined || !reviewedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const dataCollection = db.collection("mockData");
    const historyCollection = db.collection("jobHistory");

    // Fetch existing job to get old value
    const existingJob = await dataCollection.findOne({ _id: new ObjectId(id) });

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const oldValue = existingJob[field];

    const updatedAt = new Date();


    const result = await dataCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          [field]: value,
          "reviewedBy": reviewedBy,
          updatedAt: updatedAt
        }
      }
    );




    // Store the change in job history
    const historyEntry = {
      jobId: new ObjectId(id),
      field: field,
      oldValue: oldValue,
      newValue: value,
      changedBy: reviewedBy,
      changedOn: new Date(),
    };

    await historyCollection.insertOne(historyEntry);

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Field updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update the field" },
      { status: 500 }
    );
  }
}
