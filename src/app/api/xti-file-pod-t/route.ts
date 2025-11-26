import { NextResponse } from "next/server";
import oracledb from "oracledb";
import { withLogging } from "@/lib/apiWrapper";

async function postHandler(request: Request, context?: any) {
  let connection;

  try {
    const data = await request.json();

    const { fileId, ldLegId, fileTable, crtdBy, bolOcrCat } = data;

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

    await connection.execute(
      `INSERT INTO xti_pod_stamp_reqrd_t (
        file_id, BOL_OCR_CAT, CRTD_DTT, RECVR_SIGN, ARVL_DATE, CNT_RCVR, STMP_REQR, STKR_REQR, RECT_REQR, CUST_NAME, CRTD_BY, UPDT_BY, UPDT_DTT
      ) VALUES (
        :fileId, :bolOcrCat, SYSDATE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, :crtdBy, NULL, NULL
      )`,
      { fileId, bolOcrCat, crtdBy }
    );

    await connection.execute(
      `INSERT INTO xti_file_pod_t (
        file_id, ld_leg_id, file_table, crtd_dtt, stop_id, save_type, trans_dtt, note, pod_yn, erp_yn, crtd_by, file_yn, alt_ld_leg_id, parent_path, file_path, file_crtd_dtt, file_name
      ) VALUES (
        :fileId, :ldLegId, :fileTable, SYSDATE, 0, 'NA', SYSDATE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
      )`,
      { fileId, ldLegId, fileTable }
    );

    await connection.commit();
    await connection.close();

    return NextResponse.json({ message: "Records inserted successfully" });
  } catch (err) {
    if (connection) {
      try {
        await connection.execute(`ROLLBACK`, []);
        await connection.close();
      } catch (rollbackErr) {
        console.error("Error during rollback/close:", rollbackErr);
      }
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const POST = withLogging(postHandler);
