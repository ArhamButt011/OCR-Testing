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

function detectFileType(
  buffer: Buffer
): { type: string; extension: string; mimeType: string } | null {
  if (buffer.slice(0, 4).toString() === "%PDF") {
    return { type: "PDF", extension: "pdf", mimeType: "application/pdf" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { type: "JPEG", extension: "jpg", mimeType: "image/jpeg" };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { type: "PNG", extension: "png", mimeType: "image/png" };
  }
  if (
    buffer[0] === 0x49 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x2a &&
    buffer[3] === 0x00
  ) {
    return { type: "TIFF", extension: "tiff", mimeType: "image/tiff" };
  }
  if (
    buffer[0] === 0x4d &&
    buffer[1] === 0x4d &&
    buffer[2] === 0x00 &&
    buffer[3] === 0x2a
  ) {
    return { type: "TIFF", extension: "tiff", mimeType: "image/tiff" };
  }
  return null;
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
    const LOB_READ_TIMEOUT = 30000; 

    const fileDataBuffer = await Promise.race([
      new Promise<Buffer>((resolve, reject) => {
        lob.on("data", (chunk) => {
          chunks.push(chunk);
        });

        lob.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length === 0) {
            console.error(`Empty buffer received for file: ${fileId}`);
            reject(new Error("LOB data is empty"));
            return;
          }
          const fileType = detectFileType(buffer);
          if (!fileType) {
            console.error(
              `Unknown file format for ${fileId}: (hex: ${buffer
                .slice(0, 20)
                .toString("hex")})`
            );
            reject(
              new Error(
                `Unsupported file format - unable to detect valid PDF, JPEG, PNG, or TIFF signature`
              )
            );
            return;
          }

          console.log(
            `Successfully read ${fileId}: ${buffer.length} bytes, detected as ${fileType.type} (${fileType.extension})`
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

    lob.destroy();
    const detectedType = detectFileType(fileDataBuffer);

    if (!detectedType) {
      throw new Error("Unable to detect file type after reading buffer");
    }

    const fileExtension = detectedType.extension;
    const mimeType = detectedType.mimeType;
    const fileDataBase64 = fileDataBuffer.toString("base64");
    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
      console.log(`Created directory: ${PUBLIC_DIR}`);
    }

    const filePath = path.join(PUBLIC_DIR, `${fileId}.${fileExtension}`);
    if (fs.existsSync(filePath)) {
      try {
        const existingStats = fs.statSync(filePath);
        const existingBuffer = fs.readFileSync(filePath);
        if (
          existingStats.size === fileDataBuffer.length &&
          existingBuffer.equals(fileDataBuffer)
        ) {
          console.log(
            `File ${fileId}.${fileExtension} already exists and is valid (${existingStats.size} bytes), skipping write`
          );

          return NextResponse.json({
            FILE_PATH: `/file/${fileId}.${fileExtension}`,
            FILE_NAME: `${fileId}.${fileExtension}`,
            FILE_ID: row.FILE_ID,
            FILE_DATA: fileDataBase64,
            FILE_TYPE: detectedType.type,
            MIME_TYPE: mimeType,
          });
        } else {
          console.log(
            `File ${fileId}.${fileExtension} exists but differs, overwriting...`
          );
        }
      } catch (readErr) {
        console.warn(
          `Error reading existing file ${fileId}.${fileExtension}:`,
          readErr
        );
      }
    }
    fs.writeFileSync(filePath, fileDataBuffer);
    const stats = fs.statSync(filePath);
    if (stats.size !== fileDataBuffer.length) {
      console.error(
        `Write verification failed for ${fileId}: expected ${fileDataBuffer.length} bytes, got ${stats.size} bytes`
      );
      fs.unlinkSync(filePath);

      throw new Error(
        `File write verification failed: size mismatch (${stats.size} !== ${fileDataBuffer.length})`
      );
    }
    const writtenBuffer = fs.readFileSync(filePath);
    const writtenFileType = detectFileType(writtenBuffer);

    if (!writtenFileType || writtenFileType.extension !== fileExtension) {
      console.error(
        `Written file ${fileId}.${fileExtension} has invalid or changed signature`
      );
      fs.unlinkSync(filePath);

      throw new Error(
        `Written file has invalid signature (expected ${fileExtension}, got ${
          writtenFileType?.extension || "unknown"
        })`
      );
    }

    console.log(
      `Successfully saved ${fileId}.${fileExtension}: ${stats.size} bytes, verified as ${detectedType.type}`
    );

    return NextResponse.json({
      FILE_PATH: `/file/${fileId}.${fileExtension}`,
      FILE_NAME: `${fileId}.${fileExtension}`,
      FILE_ID: row.FILE_ID,
      FILE_DATA: fileDataBase64,
      FILE_TYPE: detectedType.type,
      MIME_TYPE: mimeType,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `Error retrieving file data for ${fileId || "unknown"}:`,
      err
    );

    return NextResponse.json(
      {
        error: errorMessage,
        fileId: fileId || "unknown",
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
