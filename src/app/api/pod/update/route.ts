import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";
import clientPromise from "@/lib/mongodb";
// import oracledb from "oracledb";

export async function PUT(req: Request) {
  try {
    const { ocrDataList } = await req.json();
    console.log("Received OCR data list:", ocrDataList);

    if (!Array.isArray(ocrDataList) || ocrDataList.length === 0) {
      return NextResponse.json(
        { error: "ocrDataList must be a non-empty array" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("my-next-app");
    const connectionsCollection = db.collection("db_connections");

    const userDBCredentials = await connectionsCollection.findOne({}, { sort: { _id: -1 } });

    if (!userDBCredentials) {
      return NextResponse.json({ message: "OracleDB credentials not found" }, { status: 404 });
    }

    const { userName, password, ipAddress, portNumber, serviceName } = userDBCredentials;
    const connection = await getOracleConnection(userName, password, ipAddress, portNumber, serviceName);

    if (!connection) {
      return NextResponse.json({ message: "Connection failed or skipped" }, { status: 500 });
    }

    for (const ocrData of ocrDataList) {
      const fileId = ocrData.fileId;
      if (!fileId) continue;

      console.log("Updating fileId:", fileId);

      await connection.execute(
        `UPDATE ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_OCR_T
         SET OCR_BOLNO = :bolNo, 
             OCR_ISSQTY = :issQty, 
             OCR_RCVQTY = :rcvQty,
             OCR_STMP_POD_DTT = :podDate, 
             OCR_STMP_SIGN = :sign, 
             OCR_SYMT_DAMG = :symtDamg, 
             OCR_SYMT_SHRT = :symtShrt, 
             OCR_SYMT_ORVG = :symtOrvg, 
             OCR_SYMT_REFS = :symtRefs, 
             OCR_SYMT_SEAL = :symtSeal,
             RECV_DATA_DTT = SYSDATE,
             UPTD_USR_CD = 'OCR',
             UPTD_DTT = SYSDATE
         WHERE FILE_ID = :fileId`,
        {
          bolNo: ocrData.blNumber,
          issQty: ocrData.totalQty,
          rcvQty: ocrData.received,
          podDate: ocrData.podDate,
          sign: ocrData.podSignature === "yes" ? "Y" : "N",
          symtDamg: ocrData.damaged,
          symtShrt: ocrData.short,
          symtOrvg: ocrData.over,
          symtRefs: ocrData.refused,
          symtSeal: ocrData.sealIntact,
          fileId: fileId,
        }
      );
    }

    await connection.commit();
    await connection.close();

    return NextResponse.json({ message: "OCR data updated successfully for all entries" });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Error updating OCR data:", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "An unknown error occurred" },
      { status: 500 }
    );
  }
}
