import { NextResponse } from "next/server";
import oracledb from "oracledb";

export async function DELETE(req: Request) {
  let connection;

  try {
    const data = await req.json();
    const { fileId } = data;

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 }
      );
    }

    // Get Oracle DB connection
    connection = await oracledb.getConnection({
      user: `${process.env.ORACLE_DB_USER_NAME}`,
      password: `${process.env.ORACLE_DB_PASS}`,
      connectString: `${process.env.ORACLE_DB_HOST}:${process.env.ORACLE_DB_PORT}/${process.env.ORACLE_DB_SERVICE_NAME}`,
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    // Begin transaction
    await connection.execute(
      `DELETE FROM xti_pod_stamp_reqrd_t WHERE file_id = :fileId`,
      { fileId }
    );
    await connection.execute(
      `DELETE FROM xti_file_pod_t WHERE file_id = :fileId`,
      { fileId }
    );

    await connection.commit();
    await connection.close();

    return NextResponse.json({ message: "Records deleted successfully" });
  } catch (err) {
    if (connection) {
      try {
        await connection.execute(`ROLLBACK`);
        await connection.close();
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
