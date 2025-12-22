// src/app/api/templates/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";
import { ObjectId } from "mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";
const SECRET_KEY = process.env.JWT_SECRET as string;
const AI_SERVER_URL = process.env.AI_SERVER_URL || "https://4lrl8vwxpqp35t-19123-8080.proxy.runpod.net";

async function statusChangeHandler(
  req: NextRequest | Request,
  { params }: any
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { status } = body;

    if (!params.id || !ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: "Invalid or missing ID." },
        { status: 400 }
      );
    }

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
      _id: ObjectId.createFromHexString(params.id),
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const currentStatus = template.status;

    // Rule 1: Deprecated templates cannot change status (final state)
    if (currentStatus === "deprecated") {
      return NextResponse.json(
        {
          error:
            "Deprecated templates cannot be changed. Once deprecated, a template remains deprecated permanently. Create a new template instead.",
        },
        { status: 403 }
      );
    }

    // Rule 2: Active templates can only become inactive (not deprecated directly)
    if (currentStatus === "active" && status === "deprecated") {
      return NextResponse.json(
        {
          error:
            "Cannot deprecate an active template. Set template to inactive first, then deprecate.",
        },
        { status: 403 }
      );
    }

    // Rule 3: Active <-> Inactive transitions are allowed (no validation needed)
    // Rule 4: Inactive -> Deprecated is allowed (no validation needed)

    const updateResult = await templatesCollection.updateOne(
      { _id: ObjectId.createFromHexString(params.id) },
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

    // Sync with AI server
    try {
      let aiServerPayload: any = {
        template_id: params.id,
        status: status,
      };

      // If status is active, fetch full template data and include it
      if (status === "active") {
        const fullTemplate = await templatesCollection.findOne({
          _id: ObjectId.createFromHexString(params.id),
        });

        if (fullTemplate) {
          // Convert MongoDB _id to string for JSON serialization
          const templateData = {
            ...fullTemplate,
            _id: fullTemplate._id.toString(),
          };

          aiServerPayload = {
            action: "add",
            template: templateData,
          };
        }
      } else {
        // For inactive or deprecated, only send template_id and status
        aiServerPayload = {
          template_id: params.id,
          status: status,
        };
      }

      const aiServerResponse = await fetch(`${AI_SERVER_URL}/api/templates/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiServerPayload),
      });

      if (!aiServerResponse.ok) {
        const errorText = await aiServerResponse.text();
        console.warn("AI server sync failed:", errorText);
      } else {
        const aiResponseData = await aiServerResponse.json();
        console.log("AI server sync successful:", aiResponseData);
      }
    } catch (error) {
      console.warn("Failed to sync with AI server:", error);
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

export const PATCH = withLogging(statusChangeHandler);