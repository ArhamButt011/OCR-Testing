// src/app/api/templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

// ============== CREATE TEMPLATE ==============
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    const requiredFields = [
      "template_id",
      "template_name",
      "category",
      "identification",
      "region_config",
      "prompts",
      "field_mapping",
    ];

    const missingFields = requiredFields.filter((field) => !body[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const validCategories = ["Stamp", "Notation", "Receipt"];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        {
          error: `Invalid category. Must be one of: ${validCategories.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    const validDetectionMethods = ["yolo", "coordinates", "hybrid"];
    if (!validDetectionMethods.includes(body.region_config.detection_method)) {
      return NextResponse.json(
        {
          error: `Invalid detection_method. Must be one of: ${validDetectionMethods.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const templatesCollection = db.collection("templates");

    const existingTemplate = await templatesCollection.findOne({
      template_id: body.template_id,
    });

    if (existingTemplate) {
      return NextResponse.json(
        { error: "Template ID already exists. Use a unique identifier." },
        { status: 409 }
      );
    }

    const templateDoc = {
      template_id: body.template_id,
      template_name: body.template_name,
      category: body.category,
      version: body.version || "1.0.0",
      description: body.description || "",
      status: "inactive",
      identification: body.identification,
      region_config: body.region_config,
      prompts: body.prompts,
      field_mapping: body.field_mapping,
      post_processing_rules: body.post_processing_rules || {},
      metadata: {
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_rate: 0,
      },
    };

    const result = await templatesCollection.insertOne(templateDoc);

    if (body.draft_id) {
      await db.collection("template_drafts").deleteOne({
        draft_id: body.draft_id,
      });
    }

    return NextResponse.json(
      {
        success: true,
        template_id: body.template_id,
        _id: result.insertedId,
        version: templateDoc.version,
        status: "inactive",
        message:
          "Template created successfully. Activate it to use in OCR processing.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template", details: String(error) },
      { status: 500 }
    );
  }
}

// ============== LIST TEMPLATES ==============
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const searchQuery = searchParams.get("search") || "";

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const templatesCollection = db.collection("templates");

    const filter: any = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (searchQuery) {
      filter.$or = [
        { template_id: { $regex: searchQuery, $options: "i" } },
        { template_name: { $regex: searchQuery, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      templatesCollection
        .find(filter)
        .sort({ "metadata.created_at": -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      templatesCollection.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing templates:", error);
    return NextResponse.json(
      { error: "Failed to list templates", details: String(error) },
      { status: 500 }
    );
  }
}
