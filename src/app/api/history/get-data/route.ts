import { NextResponse } from "next/server";
import { Filter, ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

interface Job {
    _id: ObjectId;
    blNumber: string;
    jobName: string;
    podDate: string;
    deliveryDate: Date;
    podSignature: string;
    totalQty: number;
    received: number;
    damaged: number;
    short: number;
    over: number;
    refused: number;
    noOfPages: number;
    stampExists: string;
    finalStatus: string;
    reviewStatus: string;
    recognitionStatus: string;
    breakdownReason: string;
    reviewedBy: string;
    cargoDescription: string;
    createdAt: string;
    updatedAt?: string;
}

const DB_NAME = process.env.DB_NAME || "my-next-app";


export async function GET(req: Request) {
    try {
        const client = await clientPromise;
        const db = client.db(DB_NAME);
        const dataCollection = db.collection<Job>("mockData");
        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const limit = parseInt(url.searchParams.get("limit") || "10", 10);
        const skip = (page - 1) * limit;

        const searchQuery = url.searchParams.get("search") || "";
        const selectedRowsParam = url.searchParams.get("selectedRows") || "";

        let filter: Filter<Job> = {};

        if (selectedRowsParam) {
            const selectedRows = JSON.parse(selectedRowsParam);
            filter = {
                $and: [
                    {
                        _id: { $in: selectedRows.map((id: string) => new ObjectId(id)) },
                    },
                    {
                        $or: [
                            { updatedAt: { $exists: true } },
                            { $expr: { $gt: ["$updatedAt", "$createdAt"] } },
                        ],
                    },
                ],
            };
        } else {
            filter = {
                $or: [
                    { updatedAt: { $exists: true } },
                    { $expr: { $gt: ["$updatedAt", "$createdAt"] } },
                ],
            };
        }


        // const filter: Filter<Job> = {
        //     $or: [
        //         { updatedAt: { $exists: true } },
        //         { $expr: { $gt: ["$updatedAt", "$createdAt"] } },
        //     ],
        // };
        if (searchQuery) {
            const searchRegex = { $regex: searchQuery, $options: "i" };
            filter.$and = [
                ...(filter.$and || []),
                {
                    $or: [
                        { blNumber: searchRegex },
                        { recognitionStatus: searchRegex }
                    ]
                }
            ];
        }

        const totalJobs = await dataCollection.countDocuments(filter);

        const jobs = await dataCollection.find(filter).skip(skip).limit(limit).toArray();

        return NextResponse.json(
            { jobs, totalJobs, page, totalPages: Math.ceil(totalJobs / limit) },
            { status: 200 }
        );
    } catch (error) {
        console.log("Error fetching jobs:", error);
        return NextResponse.json({ error: "Failed to fetch jobs." }, { status: 500 });
    }
}

export async function OPTIONS() {
    return NextResponse.json({ allowedMethods: ["GET"] });
}
