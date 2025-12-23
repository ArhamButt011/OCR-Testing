// src/app/api/templates/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";
import {ObjectId} from "mongodb"

const DB_NAME = process.env.DB_NAME || "my-next-app";
const SECRET_KEY = process.env.JWT_SECRET as string;
const AI_SERVER_URL = process.env.AI_SERVER_URL || "https://4lrl8vwxpqp35t-19123-8080.proxy.runpod.net";

type RouteContext = {
  params: Promise<Record<string, string | string[]>>;
};

async function statusChangeHandler(
  req: NextRequest | Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const id = params.id as string;
    
    const body = await req.json();
    const { status } = body;

    if (!id || !ObjectId.isValid(id)) {
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
      _id: ObjectId.createFromHexString(id),
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const currentStatus = template.status;

    if (currentStatus === "deprecated") {
      return NextResponse.json(
        {
          error:
            "Deprecated templates cannot be changed. Once deprecated, a template remains deprecated permanently. Create a new template instead.",
        },
        { status: 403 }
      );
    }

    if (currentStatus === "active" && status === "deprecated") {
      return NextResponse.json(
        {
          error:
            "Cannot deprecate an active template. Set template to inactive first, then deprecate.",
        },
        { status: 403 }
      );
    }

    const updateResult = await templatesCollection.updateOne(
      { _id: ObjectId.createFromHexString(id) },
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

    try {
      let aiServerPayload: any;

      // If status is active, send full template data
      if (status === "active") {
        const fullTemplate = await templatesCollection.findOne({
          _id: ObjectId.createFromHexString(id),
        });

        if (fullTemplate) {
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
        aiServerPayload = {
          template_id: id,
          status: "remove",
        };
      }

      console.log('AI server payload:', aiServerPayload);

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
      template_id: id,
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