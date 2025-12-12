// src/app/api/templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";
import { ObjectId } from "mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

// FR-004: Validation functions
function validateRegionConfig(regionConfig: any): string[] {
  const errors: string[] = [];

  const validMethods = ["yolo", "coordinates", "hybrid"];
  if (!validMethods.includes(regionConfig.detection_method)) {
    errors.push(
      `Invalid detection_method. Must be one of: ${validMethods.join(", ")}`
    );
    return errors;
  }

  // YOLO validation
  if (
    regionConfig.detection_method === "yolo" ||
    regionConfig.detection_method === "hybrid"
  ) {
    if (!regionConfig.yolo_config) {
      errors.push("yolo_config is required for yolo/hybrid method");
    } else {
      // if (!regionConfig.yolo_config.model_path) {
      //   errors.push("yolo_config.model_path is required");
      // }
      if (
        regionConfig.yolo_config.confidence_threshold === undefined ||
        regionConfig.yolo_config.confidence_threshold < 0 ||
        regionConfig.yolo_config.confidence_threshold > 1
      ) {
        errors.push("yolo_config.confidence_threshold must be between 0 and 1");
      }
      if (
        !regionConfig.yolo_config.classes ||
        regionConfig.yolo_config.classes.length === 0
      ) {
        errors.push("yolo_config.classes must contain at least one class");
      } else {
        regionConfig.yolo_config.classes.forEach((cls: any, idx: number) => {
          if (!cls.class_id)
            errors.push(`yolo_config.classes[${idx}].class_id is required`);
          if (!cls.region_name)
            errors.push(`yolo_config.classes[${idx}].region_name is required`);
          if (
            cls.confidence_threshold !== undefined &&
            (cls.confidence_threshold < 0 || cls.confidence_threshold > 1)
          ) {
            errors.push(
              `yolo_config.classes[${idx}].confidence_threshold must be between 0 and 1`
            );
          }
        });
      }
    }
  }

  // Coordinates validation
  if (
    regionConfig.detection_method === "coordinates" ||
    regionConfig.detection_method === "hybrid"
  ) {
    if (
      !regionConfig.coordinate_regions ||
      regionConfig.coordinate_regions.length === 0
    ) {
      errors.push(
        "At least one coordinate region is required for coordinates/hybrid method"
      );
    } else {
      regionConfig.coordinate_regions.forEach((region: any, idx: number) => {
        if (!region.region_name)
          errors.push(`coordinate_regions[${idx}].region_name is required`);

        // Validate ratios
        const ratioFields = ["x1_ratio", "y1_ratio", "x2_ratio", "y2_ratio"];
        ratioFields.forEach((field) => {
          const value = region[field];
          if (value === undefined || value === null) {
            errors.push(`coordinate_regions[${idx}].${field} is required`);
          } else if (value < 0 || value > 1) {
            errors.push(
              `coordinate_regions[${idx}].${field} must be between 0 and 1`
            );
          }
        });

        // Logical validation
        if (region.x2_ratio <= region.x1_ratio) {
          errors.push(
            `coordinate_regions[${idx}].x2_ratio must be greater than x1_ratio`
          );
        }
        if (region.y2_ratio <= region.y1_ratio) {
          errors.push(
            `coordinate_regions[${idx}].y2_ratio must be greater than y1_ratio`
          );
        }

        // Validate confidence if present
        if (
          region.confidence_threshold !== undefined &&
          (region.confidence_threshold < 0 || region.confidence_threshold > 1)
        ) {
          errors.push(
            `coordinate_regions[${idx}].confidence_threshold must be between 0 and 1`
          );
        }
      });
    }
  }

  // Hybrid requires hybrid_config
  if (
    regionConfig.detection_method === "hybrid" &&
    !regionConfig.hybrid_config
  ) {
    errors.push("hybrid_config is required for hybrid method");
  }

  return errors;
}

// ============== CREATE TEMPLATE ==============
async function createTemplateHandler(
  req: NextRequest | Request
): Promise<NextResponse> {
  try {
    const body = await req.json();

    if (body.draft_id && !ObjectId.isValid(body.draft_id)) {
      return NextResponse.json(
        { error: "Invalid or missing ID." },
        { status: 400 }
      );
    }

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

    // Validate region_config
    const validationErrors = validateRegionConfig(body.region_config);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Region configuration validation failed",
          details: validationErrors,
        },
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
        _id: ObjectId.createFromHexString(body.draft_id),
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
async function listTemplatesHandler(
  req: NextRequest | Request
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status"); // active/inactive/deprecated
    const category = searchParams.get("category"); // Stamp/Notation/Receipt
    const searchQuery = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "metadata.created_at";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const templatesCollection = db.collection("templates");

    const filter: any = {};

    // Filter by status
    if (status) {
      filter.status = status;
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Search by template ID or name
    if (searchQuery) {
      filter.$or = [
        { template_id: { $regex: searchQuery, $options: "i" } },
        { template_name: { $regex: searchQuery, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // ✅ Use MongoDB aggregation pipeline for efficient join
    const templatesWithUsageCount = await templatesCollection
      .aggregate([
        // Stage 1: Match filters (status, category, search)
        { $match: filter },

        // Stage 2: Sort
        { $sort: { [sortBy]: sortOrder } },

        // Stage 3: Pagination
        { $skip: skip },
        { $limit: limit },

        // Stage 4: Convert _id to string for lookup
        {
          $addFields: {
            template_id_string: { $toString: "$_id" },
          },
        },

        // Stage 5: Lookup usage count from mockData
        {
          $lookup: {
            from: "mockData",
            let: { templateId: "$template_id_string" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$template_id", "$$templateId"] },
                },
              },
              { $count: "count" },
            ],
            as: "usage_data",
          },
        },

        // Stage 6: Extract usage count and add to metadata
        {
          $addFields: {
            "metadata.usage_count": {
              $ifNull: [{ $arrayElemAt: ["$usage_data.count", 0] }, 0],
            },
          },
        },

        // Stage 7: Remove temporary fields
        {
          $project: {
            template_id_string: 0,
            usage_data: 0,
          },
        },
      ])
      .toArray();

    // Get total count (separate query)
    const total = await templatesCollection.countDocuments(filter);

    return NextResponse.json({
      success: true,
      templates: templatesWithUsageCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        status,
        category,
        search: searchQuery,
        sortBy,
        sortOrder: sortOrder === 1 ? "asc" : "desc",
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

// Export wrapped handlers
export const POST = withLogging(createTemplateHandler);
export const GET = withLogging(listTemplatesHandler);
