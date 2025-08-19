import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection("db_connections");

    // Fetch the first document only (you have one record)
    const connection = await collection.findOne({});

    if (!connection) {
      return NextResponse.json(
        { success: false, message: "No connection found" },
        { status: 404 }
      );
    }

    // Return only the dataBase field
    return NextResponse.json(
      { database: connection.dataBase, data: connection },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Error",
        error: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
