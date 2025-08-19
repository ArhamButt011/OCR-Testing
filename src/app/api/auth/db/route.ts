import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import oracledb from "oracledb";
import clientPromise from "@/lib/mongodb";
import { jsonDBConnectionHandler } from "@/lib/JsonDBConfig/jsonDBConnectionHandler";

const SECRET_KEY = process.env.JWT_SECRET as string;
const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function POST(req: NextRequest) {
  let connection;
  let logMessage = "";

  try {
    const token = req.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: userId } = jwt.verify(token, SECRET_KEY) as { id: string };

    const {
      systemID,
      userName,
      password,
      ipAddress,
      portNumber,
      serviceName,
      dataBase,
      checkbox,
    } = await req.json();

    const missingFields = [];
    if (!systemID) missingFields.push("systemID");
    if (!userName) missingFields.push("userName");
    if (!password) missingFields.push("password");
    if (!ipAddress) missingFields.push("ipAddress");
    if (!portNumber) missingFields.push("portNumber");
    if (!serviceName) missingFields.push("serviceName");
    if (!dataBase) missingFields.push("dataBase");

    if (missingFields.length > 0) {
      return NextResponse.json(
        { message: `Missing fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const connectionsCollection = db.collection("db_connections");
    await jsonDBConnectionHandler(dataBase);
    const userObjId = new ObjectId(userId);
    let oracleMessage = "Unknown status";

    if (dataBase !== "local" && checkbox === true) {
      try {
        connection = await oracledb.getConnection({
          user: userName,
          password,
          connectString: `${ipAddress}:${portNumber}/${serviceName}`,
        });

        const result = await connection.execute(
          "SELECT 'Connected' AS status FROM dual",
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (!result.rows || result.rows.length === 0) {
          throw new Error(
            "OracleDB connection test failed: No response from database."
          );
        }

        const rows = result.rows as { status: string }[] | undefined;
        oracleMessage = rows?.length ? rows[0].status : "No data";
        logMessage = "Successfully connected to OracleDB.";
      } catch (oracleError: unknown) {
        console.error("Error connecting to OracleDB:", oracleError);
        const errorMessage =
          oracleError instanceof Error
            ? oracleError.message
            : "An unknown error occurred";

        oracleMessage = "Failed to connect to OracleDB";
        logMessage = `Failed to connect to OracleDB: ${errorMessage}`;

        await connectionsCollection.updateOne(
          { userId: userObjId },
          {
            $set: {
              systemID,
              userName,
              password,
              ipAddress,
              portNumber,
              serviceName,
              dataBase,
              checkbox,
              logMessage,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );

        return NextResponse.json(
          {
            success: false,
            message: "Failed to connect to OracleDB. Please check credentials.",
            error: errorMessage,
          },
          { status: 500 }
        );
      }
    } else {
      oracleMessage = "Skipped OracleDB connection for local database";
      logMessage = "OracleDB connection skipped (local database selected).";
    }

    const result = await connectionsCollection.updateOne(
      { userId: userObjId },
      {
        $set: {
          systemID,
          userName,
          password,
          ipAddress,
          portNumber,
          serviceName,
          dataBase,
          checkbox,
          logMessage,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: result.upsertedCount
        ? "Database connection saved & verified!"
        : "Database connection updated & verified!",
      oracleConnectionStatus: oracleMessage,
    });
  } catch (error) {
    console.error("Error processing DB connection:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing OracleDB connection:", err);
      }
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: userId } = jwt.verify(token, SECRET_KEY) as { id: string };
    console.log("Decoded userId:", userId);

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const connectionsCollection = db.collection("db_connections");

    const connection = await connectionsCollection.findOne({
      userId: new ObjectId(userId),
    });

    if (!connection) {
      console.log("No DB connection found for this user");

      const usersCollection = db.collection("users");
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

      return NextResponse.json(
        {
          success: true,
          firstTimeLogin: true,
          data: {
            role: user?.role || "user",
          },
        },
        { status: 200 }
      );
    }

    const { password, ...connectionWithoutPassword } = connection ?? {};
    void password; // Mark as intentionally unused

    return NextResponse.json(
      { success: true, data: connectionWithoutPassword },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching connection:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while processing your request.",
        error: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
