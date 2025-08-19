import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function POST(req: Request) {
  try {
    const { isAutoConfirmationOpen } = await req.json();

    if (typeof isAutoConfirmationOpen !== "boolean") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const settingsCollection = db.collection("autoConfirmation");

    await settingsCollection.updateOne(
      { _id: new ObjectId("65e9f3c2a9b3b3b6d6a7b9c5") },
      { $set: { isAutoConfirmationOpen } },
      { upsert: true }
    );
    return NextResponse.json({ success: true, status: isAutoConfirmationOpen ? "ON" : "OFF" });
  } catch (error) {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const settingsCollection = db.collection("autoConfirmation");
    const setting = await settingsCollection.findOne(
      { _id: new ObjectId("65e9f3c2a9b3b3b6d6a7b9c5") }
    );
    return NextResponse.json({ isAutoConfirmationOpen: setting?.isAutoConfirmationOpen ?? false });
  } catch (error) {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
