// import { NextRequest, NextResponse } from "next/server";
// import { getOracleConnection } from "@/lib/oracle";
// import clientPromise from "@/lib/mongodb";
// import oracledb from "oracledb";
// import fs from "fs";
// import path from "path";

// const PUBLIC_DIR = path.join(process.cwd(), "public", "file");

// interface FileRow {
//   FILE_ID: string;
//   FILE_DATA: oracledb.Lob | null;
// }

// export async function GET(req: NextRequest) {
//   let connection;
//   try {
//     const { searchParams } = new URL(req.url);
//     const fileId = searchParams.get("fileId");
//     const fileTable = searchParams.get("fileTable");

//     if (!fileId || !fileTable) {
//       return NextResponse.json(
//         { message: "Missing fileId or fileTable" },
//         { status: 400 }
//       );
//     }

//     const client = await clientPromise;
//     const db = client.db("my-next-app");
//     const connectionsCollection = db.collection("db_connections");

//     const userDBCredentials = await connectionsCollection.findOne(
//       {},
//       { sort: { _id: -1 } }
//     );

//     if (!userDBCredentials) {
//       return NextResponse.json(
//         { message: "OracleDB credentials not found" },
//         { status: 404 }
//       );
//     }

//     const { userName, password, ipAddress, portNumber, serviceName } =
//       userDBCredentials;
//     connection = await getOracleConnection(
//       userName,
//       password,
//       ipAddress,
//       portNumber,
//       serviceName
//     );
//     if (!connection) {
//       return NextResponse.json(
//         { message: "Connection failed or skipped" },
//         { status: 500 }
//       );
//     }

//     // const tableCheckQuery = `SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME = :fileTable`;
//     // const tableCheckResult = await connection.execute(tableCheckQuery, [
//     //   fileTable.toUpperCase(),
//     // ]);

//     // if (!tableCheckResult.rows || tableCheckResult.rows.length === 0) {
//     //   return NextResponse.json(
//     //     { message: "Invalid fileTable name" },
//     //     { status: 400 }
//     //   );
//     // }

//     const result = await connection.execute<FileRow>(
//       `SELECT FILE_ID, FILE_DATA FROM ${process.env.ORACLE_DB_USER_NAME}.${fileTable} WHERE FILE_ID = :fileId`,
//       { fileId },
//       { outFormat: oracledb.OUT_FORMAT_OBJECT }
//     );

//     const row = result.rows?.[0] as FileRow | undefined;

//     if (!row) {
//       return NextResponse.json({ message: "No file found" }, { status: 404 });
//     }

//     if (!row.FILE_DATA) {
//       return NextResponse.json(
//         { message: "File data is empty" },
//         { status: 404 }
//       );
//     }

//     const lob = row.FILE_DATA;
//     const chunks: Buffer[] = [];

//     const fileDataBase64 = await new Promise<string>((resolve, reject) => {
//       lob.on("data", (chunk) => chunks.push(chunk));
//       lob.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
//       lob.on("error", (err) => reject(err));
//     });

//     lob.destroy();

//     if (!fs.existsSync(PUBLIC_DIR)) {
//       fs.mkdirSync(PUBLIC_DIR, { recursive: true });
//     }

//     const filePath = path.join(PUBLIC_DIR, `${fileId}.pdf`);

//     fs.writeFileSync(filePath, Buffer.concat(chunks));

//     return NextResponse.json({
//       FILE_PATH: `/file/${fileId}.pdf`,
//       FILE_NAME: `${fileId}.pdf`,
//       FILE_ID: row.FILE_ID,
//       FILE_DATA: fileDataBase64,
//     });
//   } catch (err) {
//     console.error("Error retrieving file data:", err);
//     return NextResponse.json(
//       { error: err instanceof Error ? err.message : "Unknown error" },
//       { status: 500 }
//     );
//   } finally {
//     if (connection) {
//       try {
//         await connection.close();
//       } catch (err) {
//         console.error("Error closing connection:", err);
//       }
//     }
//   }
// }

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
  let fileId: string | null = null;
  
  try {
    const { searchParams } = new URL(req.url);
    fileId = searchParams.get("fileId");
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

    // Execute query to get file data
    const result = await connection.execute<FileRow>(
      `SELECT FILE_ID, FILE_DATA FROM ${process.env.ORACLE_DB_USER_NAME}.${fileTable} WHERE FILE_ID = :fileId`,
      { fileId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const row = result.rows?.[0] as FileRow | undefined;

    if (!row) {
      return NextResponse.json(
        { message: "No file found" },
        { status: 404 }
      );
    }

    if (!row.FILE_DATA) {
      return NextResponse.json(
        { message: "File data is empty" },
        { status: 404 }
      );
    }

    const lob = row.FILE_DATA;
    const chunks: Buffer[] = [];

    // Read LOB data with timeout protection
    const LOB_READ_TIMEOUT = 30000; // 30 seconds
    
    const fileDataBuffer = await Promise.race([
      new Promise<Buffer>((resolve, reject) => {
        lob.on("data", (chunk) => {
          chunks.push(chunk);
        });
        
        lob.on("end", () => {
          const buffer = Buffer.concat(chunks);
          
          // Validate buffer is not empty
          if (buffer.length === 0) {
            console.error(`Empty buffer received for file: ${fileId}`);
            reject(new Error("LOB data is empty"));
            return;
          }
          
          // Validate PDF signature (first 4 bytes should be "%PDF")
          const signature = buffer.slice(0, 4).toString();
          if (signature !== "%PDF") {
            console.error(
              `Invalid PDF signature for ${fileId}: ${signature} (hex: ${buffer.slice(0, 10).toString("hex")})`
            );
            reject(new Error(`Invalid PDF format - signature is "${signature}" instead of "%PDF"`));
            return;
          }
          
          console.log(
            `✓ Successfully read ${fileId}: ${buffer.length} bytes, valid PDF signature`
          );
          resolve(buffer);
        });
        
        lob.on("error", (err) => {
          console.error(`LOB read error for ${fileId}:`, err);
          reject(err);
        });
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          reject(new Error(`LOB read timeout after ${LOB_READ_TIMEOUT}ms`));
        }, LOB_READ_TIMEOUT)
      ),
    ]);

    // Destroy the LOB after reading
    lob.destroy();

    // Convert to base64 using the same buffer
    const fileDataBase64 = fileDataBuffer.toString("base64");

    // Ensure public directory exists
    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
      console.log(`Created directory: ${PUBLIC_DIR}`);
    }

    const filePath = path.join(PUBLIC_DIR, `${fileId}.pdf`);

    // Check if file already exists and is valid
    if (fs.existsSync(filePath)) {
      try {
        const existingStats = fs.statSync(filePath);
        const existingBuffer = fs.readFileSync(filePath);
        
        // If existing file is valid and matches, skip write
        if (
          existingStats.size === fileDataBuffer.length &&
          existingBuffer.equals(fileDataBuffer)
        ) {
          console.log(
            `File ${fileId}.pdf already exists and is valid (${existingStats.size} bytes), skipping write`
          );
          
          return NextResponse.json({
            FILE_PATH: `/file/${fileId}.pdf`,
            FILE_NAME: `${fileId}.pdf`,
            FILE_ID: row.FILE_ID,
            FILE_DATA: fileDataBase64,
          });
        } else {
          console.log(
            `File ${fileId}.pdf exists but differs, overwriting...`
          );
        }
      } catch (readErr) {
        console.warn(`Error reading existing file ${fileId}.pdf:`, readErr);
      }
    }

    // Write the buffer to file
    fs.writeFileSync(filePath, fileDataBuffer);

    // Verify the file was written correctly
    const stats = fs.statSync(filePath);
    if (stats.size !== fileDataBuffer.length) {
      console.error(
        `Write verification failed for ${fileId}: expected ${fileDataBuffer.length} bytes, got ${stats.size} bytes`
      );
      
      // Clean up corrupted file
      fs.unlinkSync(filePath);
      
      throw new Error(
        `File write verification failed: size mismatch (${stats.size} !== ${fileDataBuffer.length})`
      );
    }

    // Double-check the written file is still a valid PDF
    const writtenBuffer = fs.readFileSync(filePath);
    const writtenSignature = writtenBuffer.slice(0, 4).toString();
    
    if (writtenSignature !== "%PDF") {
      console.error(
        `Written file ${fileId}.pdf has invalid signature: ${writtenSignature}`
      );
      
      // Clean up corrupted file
      fs.unlinkSync(filePath);
      
      throw new Error(
        `Written file has invalid PDF signature: ${writtenSignature}`
      );
    }

    console.log(
      `✓ Successfully saved ${fileId}.pdf: ${stats.size} bytes, verified valid PDF`
    );

    return NextResponse.json({
      FILE_PATH: `/file/${fileId}.pdf`,
      FILE_NAME: `${fileId}.pdf`,
      FILE_ID: row.FILE_ID,
      FILE_DATA: fileDataBase64,
    });
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error retrieving file data for ${fileId || "unknown"}:`, err);
    
    return NextResponse.json(
      { 
        error: errorMessage,
        fileId: fileId || "unknown"
      },
      { status: 500 }
    );
    
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing Oracle connection:", err);
      }
    }
  }
}