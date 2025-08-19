import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const documentId = new ObjectId("65d123456789abcd12345678");
const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection("ocr_status");

    const ocrStatus = await collection.findOne({ _id: documentId });

    return NextResponse.json(
      { status: ocrStatus?.status || "stop" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching OCR status:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { status } = await req.json();

    if (!status || (status !== "start" && status !== "stop")) {
      return NextResponse.json(
        { message: "Invalid status. Use 'start' or 'stop'." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection("ocr_status");

    await collection.updateOne(
      { _id: documentId },
      { $set: { status, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json(
      { message: `OCR ${status}ed successfully` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating OCR status:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
