// src/app/api/templates/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";
const SECRET_KEY = process.env.JWT_SECRET as string;
const AI_SERVER_URL = process.env.AI_SERVER_URL;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { status } = body;

    const validStatuses = ["active", "inactive", "deprecated"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const templatesCollection = db.collection("templates");

    const template = await templatesCollection.findOne({
      template_id: params.id,
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const currentStatus = template.status;

    if (currentStatus === "deprecated" && status === "active") {
      return NextResponse.json(
        {
          error:
            "Cannot reactivate deprecated templates. Create a new version instead.",
        },
        { status: 403 }
      );
    }

    const updateResult = await templatesCollection.updateOne(
      { template_id: params.id },
      {
        $set: {
          status: status,
          "metadata.updated_at": new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (status === "active" && AI_SERVER_URL) {
      try {
        await fetch(`${AI_SERVER_URL}/api/templates/reload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_id: params.id,
            action: "activate",
          }),
        });
      } catch (error) {
        console.warn("Failed to notify AI server:", error);
      }
    }

    if ((status === "inactive" || status === "deprecated") && AI_SERVER_URL) {
      try {
        await fetch(`${AI_SERVER_URL}/api/templates/reload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_id: params.id,
            action: status === "deprecated" ? "deprecate" : "deactivate",
          }),
        });
      } catch (error) {
        console.warn("Failed to notify AI server:", error);
      }
    }

    return NextResponse.json({
      success: true,
      template_id: params.id,
      status: status,
      previous_status: currentStatus,
      message: `Template status changed from ${currentStatus} to ${status}`,
    });
  } catch (error) {
    console.error("Error changing template status:", error);
    return NextResponse.json(
      { error: "Failed to change template status", details: String(error) },
      { status: 500 }
    );
  }
}
