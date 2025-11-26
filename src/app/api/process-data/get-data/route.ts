// src/app/api/process-data/get-data/route.ts
import { NextResponse } from "next/server";
import { getJobsFromMongo } from "@/lib/getJobsFromMongo";
import { getOracleOCRData } from "@/lib/oracleOCRData";
import { withLogging } from "@/lib/apiWrapper";

async function handler(req: Request, context: { params: Record<string, string | string[]> }) {
  try {
    const origin = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const connectionStatusRes = await fetch(
      `${origin}/api/oracle/connection-status`
    );
    const connectionStatus = await connectionStatusRes.json();

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const skip = (page - 1) * limit;

    if (connectionStatus.dataBase === "local") {
      return await getJobsFromMongo(url, skip, limit, page);
    } else {
      return await getOracleOCRData(url, skip, limit, page);
    }
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs." },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);

async function optionsHandler(req: Request, context: { params: Record<string, string | string[]> }) {
  return NextResponse.json({ allowedMethods: ["GET"] });
}

export const OPTIONS = withLogging(optionsHandler);