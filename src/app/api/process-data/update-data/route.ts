import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";


export async function PUT(req: Request) {
    try {
        const client = await clientPromise;
        const db = client.db(DB_NAME);
        const dataCollection = db.collection("mockData");

        const body = await req.json();
        const { _id, ...updatedData } = body;

        if (!_id || !ObjectId.isValid(_id)) {
            return NextResponse.json(
                { error: "Invalid or missing job ID" },
                { status: 400 }
            );
        }

        const result = await dataCollection.updateOne(
            { _id: new ObjectId(_id) },
            { $set: { ...updatedData, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { error: "Job not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { message: "Job updated successfully", updatedData },
            { status: 200 }
        );
    } catch (error) {
        console.log("Error updating job:", error);
        return NextResponse.json(
            { error: "Failed to update job" },
            { status: 500 }
        );
    }
}
