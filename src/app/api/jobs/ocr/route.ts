import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

const documentId = new ObjectId("65d123456789abcd12345678");
const DB_NAME = process.env.DB_NAME || "my-next-app";

async function getOCRStatusHandler(
  request: Request | any,
  context?: any
) {
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

async function postOCRStatusHandler(
  request: Request | any,
  context?: any
) {
  try {
    const { status } = await request.json();

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

export const GET = withLogging(getOCRStatusHandler);
export const POST = withLogging(postOCRStatusHandler);
