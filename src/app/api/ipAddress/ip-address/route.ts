import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";


export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db(DB_NAME);
        const collection = db.collection("settings");

        const primaryIpData = await collection.findOne({ type: "primary" }, { projection: { ip: 1, remember: 1, _id: 0 } });
        const secondaryIpData = await collection.findOne({ type: "secondary" }, { projection: { ip: 1, _id: 0 } });

        return NextResponse.json(
            {
                ip: primaryIpData?.ip || "", 
                secondaryIp: secondaryIpData?.ip || "",
                remember: primaryIpData?.remember || false
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching IPs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { ip, secondaryIp, remember } = await req.json();

        if (!ip) {
            return NextResponse.json({ error: "Primary IP address is required" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db(DB_NAME);
        const collection = db.collection("settings");

        await collection.updateOne(
            { type: "primary" },  
            { $set: { ip, remember, type: "primary" } },
            { upsert: true }
        );

        if (secondaryIp) {
            await collection.updateOne(
                { type: "secondary" },  
                { $set: { ip: secondaryIp, type: "secondary" } }, 
                { upsert: true }
            );
        }

        return NextResponse.json({ message: "IP addresses saved successfully!" }, { status: 200 });
    } catch (error) {
        console.error("Error saving IPs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}