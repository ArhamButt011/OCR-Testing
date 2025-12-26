// src/app/api/cv-logs-path/route.ts
export const runtime = 'nodejs';
import { NextResponse, NextRequest } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";


async function saveCVLogsPathHandler(request: NextRequest | Request): Promise<NextResponse> {
  const req = request as Request;

  try {
    const { basePath, sources } = await req.json();

    if (!basePath) {
      return NextResponse.json(
        { message: "Base path is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const result = await db.collection("cv_logs_config").updateOne(
      { configType: "cv_logs_path" },
      {
        $set: {
          basePath,
          sources: sources || ['all'],
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        }
      },
      { upsert: true } 
    );

    return NextResponse.json(
      { 
        message: "CV logs path saved successfully", 
        data: { basePath, sources },
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Save CV logs path error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}


async function getCVLogsPathHandler(request: NextRequest | Request): Promise<NextResponse> {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const config = await db.collection("cv_logs_config").findOne({
      configType: "cv_logs_path"
    });

    if (!config) {
      return NextResponse.json(
        { 
          message: "No configuration found",
          data: null
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        message: "Configuration retrieved successfully",
        data: {
          basePath: config.basePath,
          sources: config.sources || ['all'],
          updatedAt: config.updatedAt
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get CV logs path error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export const POST = withLogging(saveCVLogsPathHandler);
export const GET = withLogging(getCVLogsPathHandler);
