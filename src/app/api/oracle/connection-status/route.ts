// app/api/oracle/connection-status/route.ts
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("my-next-app");
    const connectionsCollection = db.collection("db_connections");

    const connection = await connectionsCollection.findOne({}, { sort: { updatedAt: -1 } });

    if (!connection) {
      return NextResponse.json({ error: "No connection data found" }, { status: 404 });
    }

    return NextResponse.json({ dataBase: connection.dataBase }, { status: 200 });
  } catch (error) {
    console.error("Error fetching connection status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
