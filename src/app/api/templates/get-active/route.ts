// src/app/api/templates/active/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";

/**
 * GET /api/templates/active
 * Returns all active templates with minimal fields (template_id, _id, template_name)
 */
async function getActiveTemplatesHandler(
  req: NextRequest | Request
): Promise<NextResponse> {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const templatesCollection = db.collection("templates");

    // Fetch only active templates with specific fields
    const activeTemplates = await templatesCollection
      .find(
        { status: "active" },
        {
          projection: {
            _id: 1,
            template_id: 1,
            template_name: 1,
          },
        }
      )
      .sort({ template_name: 1 }) // Sort alphabetically by name
      .toArray();

    // Transform _id to string for frontend consumption
    const formattedTemplates = activeTemplates.map((template) => ({
      _id: template._id.toString(),
      template_id: template.template_id,
      template_name: template.template_name,
    }));

    return NextResponse.json({
      success: true,
      templates: formattedTemplates,
      count: formattedTemplates.length,
    });
  } catch (error) {
    console.error("Error fetching active templates:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch active templates", 
        details: String(error) 
      },
      { status: 500 }
    );
  }
}

export const GET = withLogging(getActiveTemplatesHandler);