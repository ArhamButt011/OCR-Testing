import oracledb from "oracledb";
import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/apiWrapper";

async function checkOracleConnection(
  req: NextRequest | Request,
  context?: any
): Promise<NextResponse> {
  const dbConfig = {
    user: `${process.env.ORACLE_DB_USER_NAME}`,
    password: `${process.env.ORACLE_DB_PASS}`,
    connectString: `${process.env.ORACLE_DB_HOST}:${process.env.ORACLE_DB_PORT}/${process.env.ORACLE_DB_SERVICE_NAME}`,
  };

  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "SELECT 'Connected' AS status FROM dual",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows as { status: string }[] | undefined;
    const message = rows?.length ? rows[0].status : "No data";

    return NextResponse.json({ success: true, message });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
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

export const POST = withLogging(checkOracleConnection);
