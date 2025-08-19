import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";
import clientPromise from "@/lib/mongodb";
import oracledb from "oracledb";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: NextRequest) {
  let connection;
  try {
    const client = await clientPromise;
    const db = client.db("my-next-app");
    const connectionsCollection = db.collection("db_connections");
    const url = new URL(req.url);
    const dayOffsetParam = url.searchParams.get("dayOffset");
    const dayOffset = parseInt(dayOffsetParam || "0", 10);
    const fetchLimitParam = url.searchParams.get("fetchLimit");
    const fetchLimit = parseInt(fetchLimitParam || "5000", 10);
    console.log("fetch limit-> ", fetchLimit, dayOffset);

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
    oracledb.fetchAsString = [oracledb.CLOB];

    const result = await connection.execute(
      `SELECT A.FILE_ID AS FILE_ID, A.FILE_TABLE AS FILE_TABLE, A.FILE_NAME AS FILE_NAME, A.CRTD_DTT AS CRTD_DTT 
   FROM ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_T A
   JOIN ${process.env.ORACLE_DB_USER_NAME}.XTI_POD_STAMP_REQRD_T B 
     ON A.FILE_ID = B.FILE_ID
   LEFT JOIN ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_OCR_T C 
     ON A.FILE_ID = C.FILE_ID
   WHERE TO_CHAR(B.CRTD_DTT, 'YYYYMMDD') = TO_CHAR(SYSDATE + :dayOffset, 'YYYYMMDD')
     AND (C.FILE_ID IS NULL OR C.UPTD_DTT IS NULL)
       AND ROWNUM <= :fetchLimit ORDER BY FILE_ID ASC`,
      { dayOffset, fetchLimit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const formattedResult = result.rows ?? [];
    return NextResponse.json(formattedResult);
  } catch (err) {
    console.error("Error retrieving data from OracleDB:", err);
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
