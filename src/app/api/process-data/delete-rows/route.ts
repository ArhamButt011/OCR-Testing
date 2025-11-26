import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import fs from "fs/promises";
import path from "path";
import oracledb from "oracledb";
import { withLogging } from "@/lib/apiWrapper";

interface FileTableRow {
  FILE_TABLE: string;
}

interface DeleteResult {
  fileId: string;
  deletedFrom: string[] | "none";
  reason?: string;
}

async function getOracleConnection(
  user: string,
  password: string,
  ip: string,
  port: string,
  service: string
) {
  return await oracledb.getConnection({
    user,
    password,
    connectString: `${ip}:${port}/${service}`,
  });
}

const DB_NAME = process.env.DB_NAME || "my-next-app";
const ORACLE_DB_USER = process.env.ORACLE_DB_USER_NAME || "YOUR_SCHEMA";

async function postDeleteHandler(
  req: Request,
  context?: any
) {
  try {
    const { ids = [] } = await req.json();
    console.log("Received IDs for deletion:", ids);
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No valid IDs provided for deletion" },
        { status: 400 }
      );
    }

    const origin = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const connectionStatusRes = await fetch(
      `${origin}/api/oracle/connection-status`
    );
    const connectionStatus = await connectionStatusRes.json();

    if (connectionStatus.dataBase === "local") {
      // ========== DELETE FROM MONGO ==========
      const client = await clientPromise;
      const db = client.db(DB_NAME);
      const jobCollection = db.collection("mockData");
      const historyCollection = db.collection("jobHistory");

      // Separate ObjectIds and string IDs
      const objectIds: ObjectId[] = [];
      const stringIds: string[] = [];

      ids.forEach((id: string) => {
        if (ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id)) {
          objectIds.push(new ObjectId(id));
        } else {
          stringIds.push(id);
        }
      });

      console.log("ObjectIds:", objectIds);
      console.log("String IDs:", stringIds);

      const allIds: (ObjectId | string)[] = [...objectIds, ...stringIds];
      const query = allIds.length > 0 
        ? { _id: { $in: allIds as unknown as ObjectId[] } } 
        : { _id: { $in: [] } };

      const jobsToDelete = await jobCollection.find(query).toArray();
      const filePaths = jobsToDelete.map((job) =>
        job.pdfUrl ? path.join(process.cwd(), "public", job.pdfUrl) : null
      );

      const jobDeleteResult = await jobCollection.deleteMany(query);

      const historyQuery = allIds.length > 0
        ? { jobId: { $in: allIds as unknown as ObjectId[] } }
        : { jobId: { $in: [] } };

      const historyDeleteResult = await historyCollection.deleteMany(historyQuery);

      for (const filePath of filePaths) {
        if (filePath) {
          try {
            await fs.unlink(filePath);
          } catch (err) {
            console.warn(`Failed to delete file: ${filePath}`, err);
          }
        }
      }

      return NextResponse.json(
        {
          message: "MongoDB jobs deleted",
          deletedJobs: jobDeleteResult.deletedCount,
          deletedHistory: historyDeleteResult.deletedCount,
          processedObjectIds: objectIds.length,
          processedStringIds: stringIds.length,
        },
        { status: 200 }
      );
    } else {
      // ========== DELETE FROM ORACLE ==========
      const client = await clientPromise;
      const db = client.db(DB_NAME);
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
      const connection = await getOracleConnection(
        userName,
        password,
        ipAddress,
        portNumber,
        serviceName
      );

      const deleteSummary: DeleteResult[] = [];
      
      for (const fileId of ids) {
        const lookupQuery = `
    SELECT pod.FILE_TABLE
    FROM ${ORACLE_DB_USER}.XTI_FILE_POD_T pod
    JOIN ${ORACLE_DB_USER}.XTI_FILE_POD_OCR_T ocr ON pod.FILE_ID = ocr.FILE_ID
    JOIN ${ORACLE_DB_USER}.XTI_POD_STAMP_REQRD_T stamp ON pod.FILE_ID = stamp.FILE_ID
    WHERE pod.FILE_ID = :fileId
  `;

        const result = await connection.execute(lookupQuery, [fileId], {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });

        const row = result.rows?.[0] as FileTableRow | undefined;
        const fileTable = row?.FILE_TABLE;
        console.log("File Table:", fileTable);

        if (!fileTable) {
          deleteSummary.push({
            fileId,
            deletedFrom: "none",
            reason: "Missing in one of base tables or FILE_TABLE undefined",
          });
          continue;
        }

        await connection.execute(
          `DELETE FROM ${ORACLE_DB_USER}.XTI_FILE_POD_OCR_T WHERE FILE_ID = :fileId`,
          [fileId]
        );
        await connection.execute(
          `DELETE FROM ${ORACLE_DB_USER}.XTI_FILE_POD_T WHERE FILE_ID = :fileId`,
          [fileId]
        );
        await connection.execute(
          `DELETE FROM ${ORACLE_DB_USER}.XTI_POD_STAMP_REQRD_T WHERE FILE_ID = :fileId`,
          [fileId]
        );
        await connection.execute(
          `DELETE FROM ${ORACLE_DB_USER}.${fileTable} WHERE FILE_ID = :fileId`,
          [fileId]
        );

        deleteSummary.push({
          fileId,
          deletedFrom: ["base tables", fileTable],
        });
      }

      await connection.commit();
      await connection.close();

      return NextResponse.json(
        {
          message: "Oracle records deleted",
          summary: deleteSummary,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error deleting jobs:", error);
    return NextResponse.json(
      { error: "Deletion failed", details: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withLogging(postDeleteHandler);
