import clientPromise from "@/lib/mongodb";
import { getOracleConnection } from "@/lib/oracle";
import { NextResponse } from "next/server";
import oracledb from "oracledb";

interface TotalRow {
  TOTAL: number;
}

export async function GET(req: Request) {
  try {
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
      return NextResponse.json({ error: "Failed to establish OracleDB connection" }, { status: 500 });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const offset = (page - 1) * limit;

    // Extract all query parameters as filters
    const filters: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key !== "page" && key !== "limit" && value !== "") {
        filters[key] = value;
      }
    });

    console.log("✅ Received Filters:", filters);

    // Define which fields are DATE in the Oracle table
   const dateFields = new Set([
  "crtd_dtt",
  "sent_file_dtt",
  "recv_data_dtt",
  "uptd_dtt",
  "ocr_stmp_pod_dtt"  // <-- Add this line
]);


    // Build WHERE clause and binds
    const whereClauses: string[] = [];
const binds: Record<string, string | number> = {};

for (const [key, value] of Object.entries(filters)) {
  if (key === "ocr_stmp_pod_dtt") {
    const jsDate = new Date(value);
    const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
    const dd = String(jsDate.getDate()).padStart(2, '0');
    const yy = String(jsDate.getFullYear()).slice(-2);
    const formatted = `${mm}/${dd}/${yy}`; // 07/01/25

    whereClauses.push(`${key} = :${key}`);
    binds[key] = formatted;
  }
  else if (dateFields.has(key)) {
    whereClauses.push(`TRUNC(${key}) = TO_DATE(:${key}, 'YYYY-MM-DD')`);
    binds[key] = value;
  } else {
    whereClauses.push(`UPPER(${key}) LIKE :${key}`);
    binds[key] = `%${value.toUpperCase()}%`;
  }
}


    const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    // Total count
    const totalResult = await connection.execute<TotalRow>(
      `SELECT COUNT(*) AS TOTAL FROM ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_OCR_T ${whereClause}`,
      binds,
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const totalRows = totalResult.rows?.[0]?.TOTAL ?? 0;

    // Fetch paginated data
    const result = await connection.execute(
      `
      SELECT * FROM (
        SELECT a.*, ROWNUM rnum FROM (
          SELECT * 
          FROM ${process.env.ORACLE_DB_USER_NAME}.XTI_FILE_POD_OCR_T 
          ${whereClause}
          ORDER BY CRTD_DTT DESC
        ) a
        WHERE ROWNUM <= :maxRow
      )
      WHERE rnum > :offset
      `,
      {
        ...binds,
        maxRow: offset + limit,
        offset
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    await connection.close();

    return NextResponse.json({
      data: result.rows || [],
      total: totalRows,
      page,
      totalPages: Math.ceil(totalRows / limit)
    });

  } catch (error) {
    console.error("❌ Error fetching Oracle logs:", error);
    return NextResponse.json({ error: "Failed to fetch Oracle logs." }, { status: 500 });
  }
}
