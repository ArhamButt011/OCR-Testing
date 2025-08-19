import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";
import clientPromise from "@/lib/mongodb";
import oracledb from "oracledb";
import fs from "fs";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public", "file");

interface FileRow {
  FILE_ID: string;
  FILE_DATA: oracledb.Lob | null;
}

export async function GET(req: NextRequest) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    const fileTable = searchParams.get("fileTable");

    if (!fileId || !fileTable) {
      return NextResponse.json(
        { message: "Missing fileId or fileTable" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("my-next-app");
    const connectionsCollection = db.collection("db_connections");

    const userDBCredentials = await connectionsCollection.findOne(
      {},
      { sort: { _id: -1 } }
    );

    if (!userDBCredentials) {
      return NextResponse.json(
        { message: "OracleDB credentials not found" },
        { status: 404 }
      );
    }

    const { userName, password, ipAddress, portNumber, serviceName } =
      userDBCredentials;
    connection = await getOracleConnection(
      userName,
      password,
      ipAddress,
      portNumber,
      serviceName
    );
    if (!connection) {
      return NextResponse.json(
        { message: "Connection failed or skipped" },
        { status: 500 }
      );
    }

    // const tableCheckQuery = `SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME = :fileTable`;
    // const tableCheckResult = await connection.execute(tableCheckQuery, [
    //   fileTable.toUpperCase(),
    // ]);

    // if (!tableCheckResult.rows || tableCheckResult.rows.length === 0) {
    //   return NextResponse.json(
    //     { message: "Invalid fileTable name" },
    //     { status: 400 }
    //   );
    // }


    const result = await connection.execute<FileRow>(
      `SELECT FILE_ID, FILE_DATA FROM ${process.env.ORACLE_DB_USER_NAME}.${fileTable} WHERE FILE_ID = :fileId`,
      { fileId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
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
    const chunks: Buffer[] = [];

    const fileDataBase64 = await new Promise<string>((resolve, reject) => {
      lob.on("data", (chunk) => chunks.push(chunk));
      lob.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      lob.on("error", (err) => reject(err));
    });

    lob.destroy();

    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    const filePath = path.join(PUBLIC_DIR, `${fileId}.pdf`);

    fs.writeFileSync(filePath, Buffer.concat(chunks));

    return NextResponse.json({
      FILE_PATH: `/file/${fileId}.pdf`,
      FILE_NAME: `${fileId}.pdf`,
      FILE_ID: row.FILE_ID,
      FILE_DATA: fileDataBase64,
    });
  } catch (err) {
    console.error("Error retrieving file data:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
}
