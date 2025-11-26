import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";

async function connectionStatusHandler(
  request: Request,
  context?: any
): Promise<NextResponse> {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection("db_connections");

    const connection = await collection.findOne({});

    if (!connection) {
      return NextResponse.json(
        { success: false, message: "No connection found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { database: connection.dataBase, data: connection },
      { status: 200 }
    );
  } catch (error: any) {
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

export const GET = withLogging(connectionStatusHandler);
