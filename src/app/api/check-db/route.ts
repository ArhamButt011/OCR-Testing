import oracledb from "oracledb";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(req: NextRequest) {
    const dbConfig = {
        user: "numan",
        password: "numan786$",
        connectString: "192.168.0.145:1539/ORCLCDB",
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
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
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
