import { NextResponse } from "next/server";
import oracledb from "oracledb";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("my-next-app");
    const connectionsCollection = db.collection("db_connections");

    const userDBCredentials = await connectionsCollection.findOne({}, { sort: { _id: -1 } });

    if (!userDBCredentials) {
      return NextResponse.json(
        { status: "error", message: "OracleDB credentials not found" },
        { status: 404 }
      );
    }

    const { userName, password, ipAddress, portNumber, serviceName } = userDBCredentials;

    const connection = await oracledb.getConnection({
      user: userName,
      password,
      connectString: `${ipAddress}:${portNumber}/${serviceName}`,
    });

    // Perform a quick query to validate connection
    await connection.execute(`SELECT 1 FROM DUAL`);

    // Close the connection
    await connection.close();

    return NextResponse.json({ status: "online" }, { status: 200 });

  } catch (error) {
    if (error instanceof Error) {
  console.error("❌ OracleDB connection check failed:", error.message);
  return NextResponse.json({ status: "offline", error: error.message }, { status: 500 });
} else {
  console.error("❌ Unknown error:", error);
  return NextResponse.json({ status: "offline", error: "Unknown error occurred" }, { status: 500 });
}

  }
}
