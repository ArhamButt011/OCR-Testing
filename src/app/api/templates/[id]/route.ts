// src/app/api/templates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

// FR-004: Validation function (same as in main route)
function validateRegionConfig(regionConfig: any): string[] {
  const errors: string[] = [];

  const validMethods = ["yolo", "coordinates", "hybrid"];
  if (!validMethods.includes(regionConfig.detection_method)) {
    errors.push(
      `Invalid detection_method. Must be one of: ${validMethods.join(", ")}`
    );
    return errors;
  }

  if (
    regionConfig.detection_method === "yolo" ||
    regionConfig.detection_method === "hybrid"
  ) {
    if (!regionConfig.yolo_config) {
      errors.push("yolo_config is required for yolo/hybrid method");
    } else {
      if (!regionConfig.yolo_config.model_path) {
        errors.push("yolo_config.model_path is required");
      }
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

  if (
    regionConfig.detection_method === "hybrid" &&
    !regionConfig.hybrid_config
  ) {
    errors.push("hybrid_config is required for hybrid method");
  }

  return errors;
}

// ============== GET SINGLE TEMPLATE ==============
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
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

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template", details: String(error) },
      { status: 500 }
    );
  }
}

// ============== UPDATE TEMPLATE ==============
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const body = await req.json();

    // FR-004: Validate region_config if provided
    if (body.region_config) {
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
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const templatesCollection = db.collection("templates");

    const currentTemplate = await templatesCollection.findOne({
      template_id: params.id,
    });

    if (!currentTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (currentTemplate.status === "active" && !body.force_update) {
      return NextResponse.json(
        {
          error:
            "Cannot edit active template. Deactivate it first or use force_update flag.",
        },
        { status: 403 }
      );
    }

    if (currentTemplate.status === "deprecated") {
      return NextResponse.json(
        {
          error:
            "Cannot edit deprecated templates. Create a new version instead.",
        },
        { status: 403 }
      );
    }

    delete body.template_id;
    delete body.status;
    delete body.metadata;
    delete body.force_update;

    const updateResult = await templatesCollection.updateOne(
      { template_id: params.id },
      {
        $set: {
          ...body,
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

    const updatedTemplate = await templatesCollection.findOne({
      template_id: params.id,
    });

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
      message: "Template updated successfully",
    });
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template", details: String(error) },
      { status: 500 }
    );
  }
}

// ============== DELETE TEMPLATE ==============
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const templatesCollection = db.collection("templates");

    const currentTemplate = await templatesCollection.findOne({
      template_id: params.id,
    });

    if (!currentTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Only allow deletion of deprecated templates
    if (currentTemplate.status !== "deprecated") {
      return NextResponse.json(
        {
          error:
            "Only deprecated templates can be deleted. Current status: " +
            currentTemplate.status,
        },
        { status: 403 }
      );
    }

    const deleteResult = await templatesCollection.deleteOne({
      template_id: params.id,
    });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template_id: params.id,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template", details: String(error) },
      { status: 500 }
    );
  }
}
