import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

interface JobHistory {
    _id: ObjectId;
    jobId: ObjectId;
    field: string;
    oldValue: string;
    newValue: string;
    changedBy: string;
    changedOn: Date;
}

const DB_NAME = process.env.DB_NAME || "my-next-app";


export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.pathname.split("/").pop();

        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid or missing job ID." }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db(DB_NAME);

        const historyCollection = db.collection<JobHistory>("jobHistory");

        const jobHistory = await historyCollection
            .find({ jobId: new ObjectId(id) })
            .sort({ changedOn: -1 }) 
            .toArray();

        return NextResponse.json(jobHistory, { status: 200 });
    } catch (error) {
        console.log("Error fetching job history:", error);
        return NextResponse.json({ error: "Failed to fetch job history." }, { status: 500 });
    }
}
