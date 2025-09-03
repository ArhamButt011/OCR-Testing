import oracledb from "oracledb";
import { NextRequest, NextResponse } from "next/server";

// Helper: infer extension from mime or filename
function inferExtension(mime: string | undefined, name: string | undefined) {
  if (mime === "application/pdf") return ".pdf";
  if (name && name.includes(".")) return name.slice(name.lastIndexOf(".")).toLowerCase();
  return ""; // unknown → no extension
}

// Helper: safe Oracle string
function connString() {
  const host = process.env.ORACLE_DB_HOST || "127.0.0.1";
  const port = process.env.ORACLE_DB_PORT || "1521";
  const service = process.env.ORACLE_DB_SERVICE_NAME || "ORCLCDB";
  return `${host}:${port}/${service}`;
}

// Type for result structure
interface UploadResult {
  status: "success" | "error";
  message: string;
  fileName?: string;
  fileId?: string;
  ldLegId?: number;
  error?: string;
}

// Type for Oracle result with out binds
interface OracleResult {
  outBinds?: {
    blob: oracledb.Lob[];
  };
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let connection: oracledb.Connection | undefined;
  try {
    const formData = await req.formData();
    const entries = Array.from(formData.entries());

    // Files (all Blob values)
    const files = entries.filter(([, v]) => v instanceof Blob) as Array<[string, Blob]>;
    if (files.length === 0) {
      return NextResponse.json({ message: "No files uploaded" }, { status: 400 });
    }

    // Optional controls
    const baseLdLegId = parseInt((formData.get("baseLdLegId") as string) || "1", 10);
    const fileTable = (formData.get("fileTable") as string) || "XTI_2025_T";
    const crtdBy = (formData.get("crtdBy") as string) || "SYSTEM";
    const bolOcrCat = (formData.get("bolOcrCat") as string) || "D";

    // Oracle connection
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_DB_USER_NAME as string,
      password: process.env.ORACLE_DB_PASS as string,
      connectString: connString(),
    });

    // Ensure we manually control transactions
    await connection.execute(`ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'`);

    const results: UploadResult[] = [];

    // Process sequentially to avoid LOB concurrency headaches
    for (let i = 0; i < files.length; i++) {
      const [, blob] = files[i];
      const thisLdLegId = baseLdLegId + i;

      // Try to read filename if present
      const originalName = blob instanceof File ? blob.name : undefined;
      const mime = (blob as File).type || "application/octet-stream";
      const ext = inferExtension(mime, originalName);
      const fileName =
        originalName && originalName.trim().length > 0
          ? originalName
          : `uploaded-${Date.now()}${ext}`;

      const fileId = `POD_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // Read buffer
      const arrayBuffer = await blob.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      // Begin per-file savepoint
      const spName = `SP_${i + 1}`;
      await connection.execute(`SAVEPOINT ${spName}`);

      try {
        // 1) Insert or update FILE (XTI_2025_T)
        // Try INSERT first
        const result = await connection.execute(
          `
          INSERT INTO XTI_2025_T (FILE_ID, FILE_DATA, FILE_NAME, FILE_TYPE)
          VALUES (:id, EMPTY_BLOB(), :fileName, :fileType)
          RETURNING FILE_DATA INTO :blob
        `,
          {
            id: fileId,
            fileName,
            fileType: mime,
            blob: { dir: oracledb.BIND_OUT, type: oracledb.BLOB },
          },
          { autoCommit: false }
        ) as OracleResult;

        // If unique violation, fall back to UPDATE
        // ORA-00001: unique constraint (handle by code)
        if (!result.outBinds?.blob?.[0]) {
          // This should not happen, but guard anyway
          throw new Error("LOB locator missing after INSERT.");
        }

        // 2) Stream buffer into BLOB
        const lob: oracledb.Lob = result.outBinds.blob[0];
        await new Promise<void>((resolve, reject) => {
          lob.on("error", (e) => reject(e));
          lob.on("finish", () => resolve());
          lob.write(pdfBuffer, (err) => {
            if (err) return reject(err);
            lob.end();
          });
        });

        // 3) Companion rows

        // 3a) xti_pod_stamp_reqrd_t
        await connection.execute(
          `
          INSERT INTO xti_pod_stamp_reqrd_t (
            file_id, BOL_OCR_CAT, CRTD_DTT, RECVR_SIGN, ARVL_DATE, CNT_RCVR,
            STMP_REQR, STKR_REQR, RECT_REQR, CUST_NAME, CRTD_BY, UPDT_BY, UPDT_DTT
          ) VALUES (
            :fileId, :bolOcrCat, SYSDATE, NULL, NULL, NULL,
            NULL, NULL, NULL, NULL, :crtdBy, NULL, NULL
          )
        `,
          { fileId, bolOcrCat, crtdBy },
          { autoCommit: false }
        );

        // 3b) xti_file_pod_t
        await connection.execute(
          `
          INSERT INTO xti_file_pod_t (
            file_id, ld_leg_id, file_table, crtd_dtt, stop_id, save_type,
            trans_dtt, note, pod_yn, erp_yn, crtd_by, file_yn, alt_ld_leg_id,
            parent_path, file_path, file_crtd_dtt, file_name
          ) VALUES (
            :fileId, :ldLegId, :fileTable, SYSDATE, 0, 'NA',
            SYSDATE, NULL, NULL, NULL, :crtdBy, NULL, NULL,
            NULL, NULL, NULL, :fileName
          )
        `,
          {
            fileId,
            ldLegId: thisLdLegId,
            fileTable,
            crtdBy,
            fileName,
          },
          { autoCommit: false }
        );

        // Commit this file
        await connection.commit();

        results.push({
          status: "success",
          message: "Uploaded successfully",
          fileName,
          fileId,
          ldLegId: thisLdLegId,
        });
      } catch (fileErr) {
        // Roll back only this file
        try {
          await connection.execute(`ROLLBACK TO ${spName}`);
        } catch {
          // If savepoint rollback fails, fall back to full rollback (keeps loop resilient)
          await connection.rollback();
        }

        const errorMessage = fileErr instanceof Error ? fileErr.message : String(fileErr);
        results.push({
          status: "error",
          message: "Upload failed",
          fileName,
          fileId,
          ldLegId: thisLdLegId,
          error: errorMessage,
        });
        // continue to next file
      }
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error closing Oracle connection:", e);
      }
    }
  }
}