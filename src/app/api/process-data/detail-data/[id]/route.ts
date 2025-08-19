// import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
// import { getOracleConnection } from "@/lib/oracle";
// import oracledb from "oracledb";
import { getFileExtension } from "@/lib/getMimeType";
import { NextResponse } from "next/server";
import oracledb from "oracledb";
import { getOracleConnection } from "@/lib/oracle";
import { getDBConnectionType } from "@/lib/JsonDBConfig/getDBConnectionType";
interface FileRow {
  FILE_ID: string;
  FILE_NAME?: string;
  FILE_TYPE?: string;
  FILE_DATA: oracledb.Lob | null;
}

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
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    const dbType = getDBConnectionType();
    if (!id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }
  

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    let job;
    let mimeType;
    let base64Data;
    const dataCollection = db.collection<Job>("mockData");
    if (dbType !== "remote") {
      job = await dataCollection.findOne({ _id: new ObjectId(id) });
    } else {
      const client = await clientPromise;
      const db = client.db(DB_NAME);
      const connectionsCollection = db.collection("db_connections");

      const userDBCredentials = await connectionsCollection.findOne(
        {},
        { sort: { _id: -1 } }
      );

      if (!userDBCredentials) {
        return NextResponse.json(
          { error: "No DB credentials found" },
          { status: 500 }
        );
      }

      const { userName, password, ipAddress, portNumber, serviceName } =
        userDBCredentials;

      const connection = await getOracleConnection(
        userName,
        password,
        ipAddress,
        portNumber,
        serviceName
      );

      if (!connection) {
        return NextResponse.json(
          { error: "Failed to establish Oracle DB connection" },
          { status: 500 }
        );
      }

      const sqlQuerry = await connection.execute(
        `SELECT FILE_TABLE, FILE_NAME FROM ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_T WHERE FILE_ID = :id`,
        { id },
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );

      const fileTableRow = sqlQuerry.rows?.[0] as
        | { FILE_TABLE?: string; FILE_NAME?: string }
        | undefined;
      const fileTable = fileTableRow?.FILE_TABLE;
      const fileName = fileTableRow?.FILE_NAME;

      if (!fileTable || !fileName) {
        return NextResponse.json(
          { error: "File table or fileName not found" },
          { status: 404 }
        );
      }

      const result = await connection.execute(
        `
        SELECT FILE_DATA
        FROM ${process.env.ORACLE_DB_USER_NAME}.${fileTable}
        WHERE FILE_ID = :id
        `,
        { id },
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );
      const row = result.rows?.[0] as FileRow | undefined;

      if (!row) {
        return NextResponse.json({ message: "No file found" }, { status: 404 });
      }

      if (!row.FILE_DATA) {
        return NextResponse.json(
          { message: "File data is empty" },
          { status: 404 }
        );
      }
      const lob = row.FILE_DATA;
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        lob.on("data", (chunk) => chunks.push(chunk));
        lob.on("end", () => resolve(Buffer.concat(chunks)));
        lob.on("error", reject);
      });

      mimeType = getFileExtension(fileName);
      base64Data = buffer.toString("base64");

      job = await dataCollection.findOne({ fileId: id });
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    console.log("connection2-> ", dbType);
    return NextResponse.json(
      {
        job,
        mimeType,
        base64Data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error fetching job by ID:", error);
    return NextResponse.json(
      { error: "Failed to fetch job." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    const dbType = url.searchParams.get("dbType");

    if (!id) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    const updatedJobData = await req.json();

    const intFields = [
      "blNumber",
      "totalQty",
      "received",
      "damaged",
      "short",
      "over",
      "refused",
    ];
    for (const field of intFields) {
      const value = updatedJobData[field];
      if (typeof value === "string" && /^\d+$/.test(value)) {
        updatedJobData[field] = parseInt(value, 10);
      }
    }
    const headers = req.headers;
    const changedBy = headers.get("x-user-name") || "Unknown User";

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const dataCollection = db.collection("mockData");
    const historyCollection = db.collection("jobHistory");
    let existingJob;
    if (dbType !== "remote") {
      existingJob = await dataCollection.findOne({ _id: new ObjectId(id) });
    } else {
      existingJob = await dataCollection.findOne({ fileId: id });
    }

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const historyEntries = [];
    if (dbType !== "remote") {
      for (const [key, newValue] of Object.entries(updatedJobData)) {
        const oldValue = existingJob[key];
        if (oldValue != newValue) {
          historyEntries.push({
            jobId: new ObjectId(id),
            field: key,
            oldValue: oldValue,
            newValue: newValue,
            changedBy: changedBy,
            changedOn: new Date(),
          });
        }
      }
    } else {
      for (const [key, newValue] of Object.entries(updatedJobData)) {
        const oldValue = existingJob[key];
        if (oldValue != newValue) {
          historyEntries.push({
            jobId: id,
            field: key,
            oldValue: oldValue,
            newValue: newValue,
            changedBy: changedBy,
            changedOn: new Date(),
          });
        }
      }
    }

    if (historyEntries.length === 0) {
      return NextResponse.json(
        { message: "No changes detected." },
        { status: 200 }
      );
    }

    updatedJobData.updatedAt = new Date();
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) }
      : { fileId: id }; // fallback when ID is not ObjectId
    const result = await dataCollection.updateOne(filter, {
      $set: updatedJobData,
    });

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: "No changes made" }, { status: 400 });
    }

    if (historyEntries.length > 0) {
      await historyCollection.insertMany(historyEntries);
    }

    return NextResponse.json(
      { message: "Job updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error updating job:", error);
    return NextResponse.json(
      { error: "Failed to update job." },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-user-name",
    },
  });
}
