import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";
import clientPromise from "@/lib/mongodb";
import oracledb from "oracledb";
import fs from "fs";
import path from "path";

// Use absolute path for production server
const PUBLIC_DIR =
  process.env.NODE_ENV === "production"
    ? "/workspace/var/www/POD-OCR/public/file"
    : path.join(process.cwd(), "public", "file");

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

    // Debug logging
    console.log("PUBLIC_DIR:", PUBLIC_DIR);
    console.log("Directory exists before creation:", fs.existsSync(PUBLIC_DIR));

    // Create directory with full permissions
    if (!fs.existsSync(PUBLIC_DIR)) {
      try {
        fs.mkdirSync(PUBLIC_DIR, {
          recursive: true,
          mode: 0o755, // Ensure proper permissions
        });
        console.log("Directory created successfully");
      } catch (dirError) {
        console.error("Error creating directory:", dirError);
        throw dirError;
      }
    }

    const filePath = path.join(PUBLIC_DIR, `${fileId}.pdf`);
    console.log("Full file path:", filePath);

    try {
      // Write file with proper error handling
      fs.writeFileSync(filePath, Buffer.concat(chunks), { mode: 0o644 });
      console.log("File written successfully to:", filePath);

      // Verify file was created
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log("File size:", stats.size, "bytes");
      } else {
        console.error("File was not created despite no error");
      }
    } catch (writeError) {
      console.error("Error writing file:", writeError);
      throw writeError;
    }

    // Return the public URL path (assuming your web server serves from /workspace/var/www/POD-OCR/public)
    return NextResponse.json({
      FILE_PATH: `/file/${fileId}.pdf`,
      FILE_NAME: `${fileId}.pdf`,
      FILE_ID: row.FILE_ID,
      FILE_DATA: fileDataBase64,
      FULL_PATH: filePath, // Include full path for debugging
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
