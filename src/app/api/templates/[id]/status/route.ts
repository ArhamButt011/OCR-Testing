// src/app/api/templates/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";
import { ObjectId } from "mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";
const SECRET_KEY = process.env.JWT_SECRET as string;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const STATIC_AI_SERVER_URL = process.env.AI_SERVER_URL || "https://h86md9lnjv592j-19123-8080.proxy.runpod.net";
const USE_DYNAMIC_IP = process.env.USE_DYNAMIC_IP === "true";

type RouteContext = {
  params: Promise<Record<string, string | string[]>>;
};

// Helper function to fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Helper function to get AI server URL dynamically (for isolated environment)
async function getAIServerURL(): Promise<string | null> {
  try {
    console.log("Fetching dynamic IP from:", `${BASE_URL}/api/ipAddress/ip-address`);
    
    const ipRes = await fetchWithTimeout(
      `${BASE_URL}/api/ipAddress/ip-address`
    ).catch(() => null);

    if (!ipRes || !ipRes.ok) {
      console.error("Failed to fetch IP address configuration");
      return null;
    }

    const ipData = await ipRes.json();
    console.log("IP Data received:", JSON.stringify(ipData, null, 2));

    if (!ipData || !ipData.ip || !ipData.secondaryIp) {
      console.error("Invalid IP data received:", ipData);
      console.error("Expected format: { ip: '...', secondaryIp: '...' }");
      return null;
    }

    // Construct the AI server URL with the fetched IP
    const aiServerUrl = `http://${ipData.ip}:8080`;
    console.log("AI Server URL constructed (dynamic):", aiServerUrl);
    
    return aiServerUrl;
  } catch (error) {
    console.error("Error fetching IP address:", error);
    return null;
  }
}

// Helper function to resolve AI server URL based on environment
async function resolveAIServerURL(): Promise<string | null> {
  if (USE_DYNAMIC_IP) {
    console.log("🔄 Using dynamic IP fetching for isolated environment");
    return await getAIServerURL();
  } else {
    console.log("📌 Using static AI server URL for live environment:", STATIC_AI_SERVER_URL);
    return STATIC_AI_SERVER_URL;
  }
}

async function statusChangeHandler(
  req: NextRequest | Request,
  context: RouteContext
): Promise<NextResponse> {
  console.log("\n=== STATUS CHANGE REQUEST STARTED ===");
  
  try {
    const params = await context.params;
    const id = params.id as string;
    
    const body = await req.json();
    const { status } = body;

    console.log("Request Details:", {
      templateId: id,
      requestedStatus: status,
      timestamp: new Date().toISOString()
    });

    if (!id || !ObjectId.isValid(id)) {
      console.error("❌ Invalid or missing ID:", id);
      return NextResponse.json(
        { error: "Invalid or missing ID." },
        { status: 400 }
      );
    }

    const validStatuses = ["active", "inactive", "deprecated"];
    if (!status || !validStatuses.includes(status)) {
      console.error("❌ Invalid status:", status);
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

    console.log("Fetching template from MongoDB...");
    const template = await templatesCollection.findOne({
      _id: ObjectId.createFromHexString(id),
    });

    if (!template) {
      console.error("❌ Template not found:", id);
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    console.log("Template Found:", {
      id: template._id.toString(),
      currentStatus: template.status,
      name: template.name || "Unnamed Template"
    });

    const currentStatus = template.status;

    if (currentStatus === "deprecated") {
      console.warn("⚠️ Attempted to modify deprecated template");
      return NextResponse.json(
        {
          error:
            "Deprecated templates cannot be changed. Once deprecated, a template remains deprecated permanently. Create a new template instead.",
        },
        { status: 403 }
      );
    }

    if (currentStatus === "active" && status === "deprecated") {
      console.warn("⚠️ Attempted to deprecate active template");
      return NextResponse.json(
        {
          error:
            "Cannot deprecate an active template. Set template to inactive first, then deprecate.",
        },
        { status: 403 }
      );
    }

    console.log(`Updating template status: ${currentStatus} → ${status}`);
    const updateResult = await templatesCollection.updateOne(
      { _id: ObjectId.createFromHexString(id) },
      {
        $set: {
          status: status,
          "metadata.updated_at": new Date(),
        },
      }
    );

    console.log("MongoDB Update Result:", {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount
    });

    if (updateResult.matchedCount === 0) {
      console.error("❌ Template not found during update");
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Sync with AI server
    try {
      console.log("\n=== AI SERVER SYNC STARTED ===");
      console.log("Environment Configuration:", {
        USE_DYNAMIC_IP,
        BASE_URL,
        STATIC_AI_SERVER_URL
      });

      // Get AI server URL based on environment
      const AI_SERVER_URL = await resolveAIServerURL();
      
      console.log("Resolved AI Server URL:", AI_SERVER_URL);
      
      if (!AI_SERVER_URL) {
        console.warn("⚠️ Could not resolve AI server URL, skipping sync");
        return NextResponse.json({
          success: true,
          template_id: id,
          status: status,
          previous_status: currentStatus,
          message: `Template status changed from ${currentStatus} to ${status}`,
          warning: "AI server sync skipped - could not resolve server URL"
        });
      }

      let aiServerPayload: any;

      // If status is active, send full template data
      if (status === "active") {
        console.log("Status is 'active' - preparing full template data for sync");
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
          console.log("Payload action: ADD");
        }
      } else {
        console.log(`Status is '${status}' - sending remove action`);
        aiServerPayload = {
          template_id: id,
          action: "remove",
        };
        console.log("Payload action: REMOVE");
      }

      console.log('🚀 Sending request to AI Server:', {
        url: `${AI_SERVER_URL}/api/templates/sync`,
        method: 'POST',
        action: aiServerPayload.action,
        template_id: aiServerPayload.template_id || aiServerPayload.template?._id
      });
      console.log('Full Payload:', JSON.stringify(aiServerPayload, null, 2));

      const aiServerResponse = await fetch(`${AI_SERVER_URL}/api/templates/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiServerPayload),
      });

      console.log("AI Server Response Status:", aiServerResponse.status);
      console.log("AI Server Response OK:", aiServerResponse.ok);

      if (!aiServerResponse.ok) {
        const errorText = await aiServerResponse.text();
        console.error("❌ AI server sync failed:");
        console.error("Status:", aiServerResponse.status);
        console.error("Response:", errorText);
      } else {
        const aiResponseData = await aiServerResponse.json();
        console.log("✅ AI server sync successful!");
        console.log("Response Data:", JSON.stringify(aiResponseData, null, 2));
      }
      
      console.log("=== AI SERVER SYNC COMPLETED ===\n");
    } catch (error) {
      console.error("❌ Failed to sync with AI server:");
      console.error("Error:", error);
      if (error instanceof Error) {
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
      }
    }

    console.log("=== STATUS CHANGE REQUEST COMPLETED SUCCESSFULLY ===\n");

    return NextResponse.json({
      success: true,
      template_id: id,
      status: status,
      previous_status: currentStatus,
      message: `Template status changed from ${currentStatus} to ${status}`,
    });
  } catch (error) {
    console.error("\n❌ ERROR IN STATUS CHANGE HANDLER:");
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Error Message:", error.message);
      console.error("Error Stack:", error.stack);
    }
    console.error("=== STATUS CHANGE REQUEST FAILED ===\n");
    
    return NextResponse.json(
      { error: "Failed to change template status", details: String(error) },
      { status: 500 }
    );
  }
}

export const PATCH = withLogging(statusChangeHandler);