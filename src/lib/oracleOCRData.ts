import { NextResponse } from "next/server";
import oracledb from "oracledb";
import clientPromise from "./mongodb";
import { getOracleConnection } from "./oracle";
import { OracleRow, PodFile } from "@/type";
import { getJobsFromMongo } from "./getJobsFromMongo";
import fs from "fs";
import path from "path";

interface MongoJob {
  _id: string;
  pdfUrl: string;
}

interface MockData {
  _id: string;                 // <- string _id
  fileId: string;
  pdfUrl: string;
  blNumber: number | string | null;
  jobId: string;
  podDate: string | null;
  podSignature: string | null;
  totalQty: number | null;
  received: number | null;
  damaged: number;
  short: number;
  over: number;
  refused: number;
  customerOrderNum: string | null;
  stampExists: string | null;
  finalStatus: string | null;
  reviewStatus: string | null;
  recognitionStatus: string | null;
  breakdownReason: string | null;
  reviewedBy: string | null;
  uptd_Usr_Cd: string;
  cargoDescription: string | null;
}

const PUBLIC_DIR = path.join(process.cwd(), "public", "file");

type YearTableRow = {
  FILE_ID: string;
  FILE_NAME?: string | null;
  FILE_TYPE?: string | null;
  FILE_DATA: oracledb.Lob | null;
};

// derive file extension: prefer FILE_NAME, else FILE_TYPE, else .bin
function deriveExtension(fileName?: string | null, fileType?: string | null) {
  if (fileName && fileName.includes(".")) {
    return fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  }
  const ft = (fileType || "").toLowerCase();
  if (ft.includes("pdf")) return ".pdf";
  if (ft.includes("jpeg") || ft.includes("jpg")) return ".jpg";
  if (ft.includes("png")) return ".png";
  if (ft.includes("tiff") || ft.includes("tif")) return ".tif";
  return ".bin";
}

// read an Oracle LOB into a Buffer (base64 not needed for writing a file)
function readLobToBuffer(lob: oracledb.Lob): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    lob.on("data", (chunk) => chunks.push(chunk));
    lob.on("end", () => resolve(Buffer.concat(chunks)));
    lob.on("error", (err) => reject(err));
  });
}

// search current year table then previous year table; return first hit with FILE_DATA
async function fetchBlobFromYearTables(
  connection: oracledb.Connection,
  schema: string,
  fileId: string
): Promise<{ buffer: Buffer; ext: string; fromTable: string } | null> {
  const currentYear = new Date().getFullYear();
  const candidates = [currentYear, currentYear - 1];

  for (const year of candidates) {
    const table = `${schema}.XTI_${year}_T`;
    const sql = `
      SELECT FILE_ID, FILE_NAME, FILE_TYPE, FILE_DATA
      FROM ${table}
      WHERE FILE_ID = :fileId
    `;
    const r = await connection.execute<YearTableRow>(
      sql,
      { fileId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const row = r.rows?.[0] as YearTableRow | undefined;
    if (row && row.FILE_DATA) {
      const ext = deriveExtension(row.FILE_NAME, row.FILE_TYPE);
      const buffer = await readLobToBuffer(row.FILE_DATA);
      try { row.FILE_DATA.destroy?.(); } catch { }

      return { buffer, ext, fromTable: table };
    }
  }
  return null; // not found in either table
}

// write the buffer to public/file/<FILE_ID><ext> and return the public URL
function persistToPublic(fileId: string, buffer: Buffer, ext: string) {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  const filePath = path.join(PUBLIC_DIR, `${fileId}${ext}`);
  fs.writeFileSync(filePath, buffer);
  return `/file/${fileId}${ext}`;
}

export async function getOracleOCRData(
  url: URL,
  skip: number,
  limit: number,
  page: number
) {
  let connection: oracledb.Connection | null = null;

  try {
    const client = await clientPromise;
    const db = client.db("my-next-app");
    const connectionsCollection = db.collection("db_connections");
    const userDBCredentials = await connectionsCollection.findOne(
      {},
      { sort: { _id: -1 } }
    );

    const resultMongoDb = await getJobsFromMongo(url, skip, limit, page);
    const data = await resultMongoDb.json();

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
        { error: "Failed to establish OracleDB connection" },
        { status: 500 }
      );
    }

    const podSignature =
      url.searchParams.get("podDateSignature")?.trim().toLowerCase() || "";
    const bolNumber =
      url.searchParams.get("bolNumber")?.trim().toLowerCase() || "";
    const createdDate = url.searchParams.get("createdDate") || "";
    const updatedDate = url.searchParams.get("updatedDate") || "";
    const uptd_Usr_Cd = url.searchParams.get("uptd_Usr_Cd") || "";
    const podDate = url.searchParams.get("podDate") || "";
    const fileId = url.searchParams.get("fileId")?.trim().toLowerCase() || "";
    const fileName =
      url.searchParams.get("fileName")?.trim().toLowerCase() || "";

    const isOCR = uptd_Usr_Cd.toLowerCase() === "ocr";
    if (!isOCR) {
      const fileName =
        url.searchParams.get("fileName")?.trim().toLowerCase() || "";
      const fileId = url.searchParams.get("fileId")?.trim().toLowerCase() || "";
      const baseQuery = `
    SELECT 
      A.FILE_ID AS FILE_ID,
      A.FILE_NAME AS FILE_NAME,
      A.CRTD_DTT AS CRTD_DTT,
      ROW_NUMBER() OVER (ORDER BY A.CRTD_DTT DESC) AS rn
    FROM 
      ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_T A
    JOIN 
      ${process.env.ORACLE_DB_USER_NAME}.XTI_POD_STAMP_REQRD_T B 
      ON A.FILE_ID = B.FILE_ID
    LEFT JOIN 
      ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_OCR_T C 
      ON A.FILE_ID = C.FILE_ID
    WHERE 
      (C.FILE_ID IS NULL OR C.UPTD_DTT IS NULL)
      ${createdDate
          ? "AND TO_CHAR(B.CRTD_DTT, 'YYYYMMDD') = TO_CHAR(TO_DATE(:createdDate, 'YYYY-MM-DD'), 'YYYYMMDD')"
          : ""
        }
      ${fileName ? "AND LOWER(A.FILE_NAME) LIKE :fileName" : ""}
          ${fileId ? "AND LOWER(A.FILE_ID) LIKE :fileId" : ""}

  `;

      const paginatedQuery = `
    SELECT * FROM (${baseQuery})
    WHERE rn > :offset AND rn <= :maxRow
  `;

      const bindParams = {
        ...(createdDate ? { createdDate } : {}),
        ...(fileName ? { fileName: `%${fileName}%` } : {}),
        ...(fileId ? { fileId: `%${fileId}%` } : {}),

        offset: skip,
        maxRow: skip + limit,
      };

      const result = await connection.execute(paginatedQuery, bindParams, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });

      const countQuery = `
    SELECT COUNT(*) AS TOTAL FROM (
      SELECT A.FILE_ID
      FROM ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_T A
      JOIN ${process.env.ORACLE_DB_USER_NAME}.XTI_POD_STAMP_REQRD_T B 
        ON A.FILE_ID = B.FILE_ID
      LEFT JOIN ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_OCR_T C 
        ON A.FILE_ID = C.FILE_ID
      WHERE 
        (C.FILE_ID IS NULL OR C.UPTD_DTT IS NULL)
        ${createdDate
          ? "AND TO_CHAR(B.CRTD_DTT, 'YYYYMMDD') = TO_CHAR(TO_DATE(:createdDate, 'YYYY-MM-DD'), 'YYYYMMDD')"
          : ""
        }
        ${fileName ? "AND LOWER(A.FILE_NAME) LIKE :fileName" : ""}
        ${fileId ? "AND LOWER(A.FILE_ID) LIKE :fileId" : ""}

    )
  `;
      const countBindParams: Record<string, string | number | Date> = {};
      if (createdDate) countBindParams.createdDate = createdDate;
      if (fileName) countBindParams.fileName = `%${fileName}%`;
      if (fileId) countBindParams.fileId = `%${fileId}%`;

      const countResult = await connection.execute(
        countQuery,
        countBindParams,
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );

      const filteredData = (result?.rows ?? []) as PodFile[];
      const totalJobs =
        (countResult.rows?.[0] as { TOTAL: number })?.TOTAL || 0;

      // const jobs = filteredData.map((row: PodFile) => ({
      //   fileName: row.FILE_NAME,
      //   _id: row.FILE_ID,
      // }));

      const schema = process.env.ORACLE_DB_USER_NAME as string;

      const jobs = await Promise.all(
        (filteredData as PodFile[]).map(async (row) => {
          const fileId = row.FILE_ID;
          let fileUrl: string | null = null;

          if (!connection) {
            throw new Error("No Oracle connection established");
          }

          try {
            const found = await fetchBlobFromYearTables(connection, schema, fileId);
            if (found) {
              fileUrl = persistToPublic(fileId, found.buffer, found.ext);
            }
          } catch (e) {
            console.error(`Failed to fetch/persist blob for ${fileId}:`, e);
          }

          return {
            fileName: row.FILE_NAME,
            _id: fileId,
            fileUrl,
            fileNameFromUrl: fileUrl ? path.basename(fileUrl) : null,
          };
        })
      );


      try {
        const mockCol = db.collection<MockData>("mockData");

        const docs: MockData[] = jobs.map((j) => ({
          _id: j._id,                         // string id
          fileId: j._id,
          pdfUrl: j.fileNameFromUrl ?? "",
          blNumber: null,
          jobId: "",
          podDate: null,
          podSignature: null,
          totalQty: null,
          received: null,
          damaged: 0,
          short: 0,
          over: 0,
          refused: 0,
          customerOrderNum: null,
          stampExists: null,
          finalStatus: null,
          reviewStatus: null,
          recognitionStatus: null,
          breakdownReason: null,
          reviewedBy: null,
          uptd_Usr_Cd: uptd_Usr_Cd || "",
          cargoDescription: null,
        }));

        // 2) Avoid duplicate inserts by skipping fileIds already present
        const fileIds = docs.map((d) => d.fileId);
        const existing = await mockCol
          .find({ fileId: { $in: fileIds } })
          .project({ _id: 0, fileId: 1 })
          .toArray();
        const existingSet = new Set(existing.map((e) => e.fileId));

        const newDocs = docs.filter((d) => !existingSet.has(d.fileId));

        // 3) Insert only new docs
        if (newDocs.length) {
          await mockCol.insertMany(newDocs, { ordered: false });
        }
      } catch (e) {
        console.error("mockData insert failed:", e);
      }


      return NextResponse.json(
        {
          jobs,
          totalJobs,
          page,
          totalPages: Math.ceil(totalJobs / limit),
        },
        { status: 200 }
      );
    }

    // const tableName = `${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_OCR_T`;
    const whereClauses: string[] = [];
    const filterBinds: Record<string, string | Date | number> = {};

    if (uptd_Usr_Cd) {
      whereClauses.push(`LOWER(ocr.UPTD_USR_CD) = :uptd_Usr_Cd`);
      filterBinds.uptd_Usr_Cd = uptd_Usr_Cd.toLowerCase();
    }
    if (createdDate) {
      whereClauses.push(
        `TRUNC(ocr.CRTD_DTT) = TO_DATE(:createdDate, 'YYYY-MM-DD')`
      );
      filterBinds.createdDate = createdDate;
    }

    if (updatedDate) {
      whereClauses.push(
        `TRUNC(ocr.UPTD_DTT) = TO_DATE(:updatedDate, 'YYYY-MM-DD')`
      );
      filterBinds.updatedDate = updatedDate;
    }

    if (podSignature) {
      whereClauses.push(`LOWER(ocr.OCR_STMP_SIGN) LIKE :podSignature`);
      filterBinds.podSignature = `%${podSignature}%`;
    }

    if (bolNumber) {
      whereClauses.push(`LOWER(ocr.OCR_BOLNO) LIKE :bolNumber`);
      filterBinds.bolNumber = `%${bolNumber}%`;
    }
    if (fileId) {
      whereClauses.push(`LOWER(ocr.FILE_ID) LIKE :fileId`);
      filterBinds.fileId = `%${fileId}%`;
    }

    if (podDate) {
      whereClauses.push(
        `TO_DATE(ocr.OCR_STMP_POD_DTT, 'MM/DD/YY') = TO_DATE(:podDate, 'YYYY-MM-DD')`
      );
      filterBinds.podDate = podDate;
    }

    if (fileName) {
      whereClauses.push(`LOWER(pod.FILE_NAME) LIKE :fileName`);
      filterBinds.fileName = `%${fileName}%`;
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const sql = `
      SELECT * FROM (
        SELECT ocr.*, pod.FILE_NAME, ROW_NUMBER() OVER (ORDER BY ocr.CRTD_DTT DESC) AS rn
        FROM ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_OCR_T ocr
        INNER JOIN ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_T pod
        ON ocr.FILE_ID = pod.FILE_ID
        ${whereSQL}
      )
      WHERE rn > :offset AND rn <= :maxRow
    `;

    const resultBinds = {
      ...filterBinds,
      offset: skip,
      maxRow: skip + limit,
    };

    const result = await connection.execute<OracleRow>(sql, resultBinds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    // const countSQL = `SELECT COUNT(*) AS TOTAL FROM ${tableName} ocr ${whereSQL}`;
    const countSQL = `
  SELECT COUNT(*) AS TOTAL
  FROM ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_OCR_T ocr
  INNER JOIN ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_T pod
  ON ocr.FILE_ID = pod.FILE_ID
  ${whereSQL}
`;

    const countResult = await connection.execute(countSQL, filterBinds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    const totalJobs = (countResult.rows?.[0] as { TOTAL: number })?.TOTAL || 0;
    const rows = result.rows as OracleRow[];

    const jobs = rows.map((row: OracleRow) => {
      const matchedMongoJob = (data.jobs as MongoJob[]).find((job) => {
        const cleanFileName = job.pdfUrl.substring(
          0,
          job.pdfUrl.lastIndexOf(".")
        );
        return cleanFileName === row.FILE_ID;
      });

      return {
        _id: matchedMongoJob?._id || `${row.FILE_ID}`,
        fileName: row.FILE_NAME || "",
        blNumber: row.OCR_BOLNO,
        fileId: row.FILE_ID,
        podSignature: row.OCR_STMP_SIGN,
        totalQty: row.OCR_ISSQTY,
        received: row.OCR_RCVQTY,
        damaged: row.OCR_SYMT_DAMG === "Y" ? 1 : 0,
        short: row.OCR_SYMT_SHRT === "Y" ? 1 : 0,
        over: row.OCR_SYMT_ORVG === "Y" ? 1 : 0,
        refused: row.OCR_SYMT_REFS === "Y" ? 1 : 0,
        podDate: row.OCR_STMP_POD_DTT,
        createdAt: row.CRTD_DTT,
        sealIntact: row.OCR_SYMT_SEAL,
        reviewedBy: row.UPTD_USR_CD,
      };
    });

    return NextResponse.json(
      { jobs, totalJobs, page, totalPages: Math.ceil(totalJobs / limit) },
      { status: 200 }
    );
  } catch (err) {
    console.error("Oracle DB error:", err);
    return NextResponse.json({ error: "Oracle DB error" }, { status: 500 });
  } finally {
    if (connection) await connection.close();
  }
}
