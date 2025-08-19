import oracledb from 'oracledb';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let connection;
  try {
    const formData = await req.formData();
    const entries = Array.from(formData.entries());

    // Filter out file fields (in case other fields are present)
    const files = entries.filter(([, value]) => value instanceof Blob);

    if (files.length === 0) {
      return NextResponse.json({ message: "No files uploaded" }, { status: 400 });
    }

    connection = await oracledb.getConnection({
      user: "numan",
      password: "numan786$",
      connectString: "192.168.0.145:1539/ORCLCDB",
    });

    const results = [];

    for (const [, file] of files) {
      const blob = file as Blob;

      const arrayBuffer = await blob.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      const fileType = blob.type || 'application/octet-stream';
      const fileName = (blob instanceof File && blob.name)
        ? blob.name
        : `uploaded-${Date.now()}.pdf`;
      const fileId = `POD_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      const check = await connection.execute<{ FILE_DATA: oracledb.Lob }>(
        `SELECT FILE_DATA FROM XTI_2025_T WHERE FILE_ID = :id FOR UPDATE`,
        { id: fileId }
      );

      let result;
      if (check.rows && check.rows.length > 0) {
        result = await connection.execute(
          `UPDATE XTI_2025_T 
           SET FILE_DATA = EMPTY_BLOB(), FILE_NAME = :fileName, FILE_TYPE = :fileType
           WHERE FILE_ID = :id 
           RETURNING FILE_DATA INTO :blob`,
          {
            id: fileId,
            fileName,
            fileType,
            blob: { dir: oracledb.BIND_OUT, type: oracledb.BLOB }
          },
          { autoCommit: false }
        );
      } else {
        result = await connection.execute(
          `INSERT INTO XTI_2025_T (FILE_ID, FILE_DATA, FILE_NAME, FILE_TYPE) 
           VALUES (:id, EMPTY_BLOB(), :fileName, :fileType) 
           RETURNING FILE_DATA INTO :blob`,
          {
            id: fileId,
            fileName,
            fileType,
            blob: { dir: oracledb.BIND_OUT, type: oracledb.BLOB }
          },
          { autoCommit: false }
        );
      }

      const outBinds = result.outBinds as { blob?: oracledb.Lob[] };
      if (!outBinds.blob || !outBinds.blob[0]) {
        throw new Error("LOB locator is missing.");
      }

      const lob = outBinds.blob[0];
      await new Promise<void>((resolve, reject) => {
        lob.write(pdfBuffer, (err) => {
          if (err) reject(new Error("Failed to write to LOB: " + err.message));
          lob.end();
          resolve();
        });
      });

      await connection.commit();

      results.push({ message: "Uploaded successfully", fileName, fileId });
    }

    return NextResponse.json({ results });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Error inserting PDF:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
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
