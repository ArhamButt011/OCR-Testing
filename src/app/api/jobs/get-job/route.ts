import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";

async function getJobsCollection() {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    return db.collection("jobs");
}

async function getActiveJobsHandler(
    request: Request | any, 
    context?: any
) {
    try {
        const jobsCollection = await getJobsCollection();
        const activeJobs = await jobsCollection.find({ active: true }).toArray();

        return NextResponse.json({ activeJobs }, { status: 200 });

    } catch (error) {
        console.log('Error fetching active jobs:', error);

        return NextResponse.json({ error: 'Failed to fetch active jobs.' }, { status: 500 });
    }
}

export const GET = withLogging(getActiveJobsHandler);
