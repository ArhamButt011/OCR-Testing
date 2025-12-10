// src/app/api/templates/check-id/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function checkIdHandler(
  req: NextRequest | Request
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { template_id } = body;

    if (!template_id) {
      return NextResponse.json(
        { error: "template_id is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const templatesCollection = db.collection("templates");

    const existingTemplate = await templatesCollection.findOne({
      template_id: template_id,
    });

    if (existingTemplate) {
      return NextResponse.json(
        {
          available: false,
          message: "Template ID already exists",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        available: true,
        message: "Template ID is available",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking template ID:", error);
    return NextResponse.json(
      { error: "Failed to check template ID", details: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withLogging(checkIdHandler);
