// src/app/api/templates/validate/route.ts
import { NextRequest, NextResponse } from "next/server";

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

    const errors: string[] = [];

    requiredFields.forEach((field) => {
      if (!body[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    const validCategories = ["Stamp", "Notation", "Receipt"];
    if (body.category && !validCategories.includes(body.category)) {
      errors.push(
        `Invalid category. Must be one of: ${validCategories.join(", ")}`
      );
    }

    const validDetectionMethods = ["yolo", "coordinates", "hybrid"];
    if (
      body.region_config &&
      !validDetectionMethods.includes(body.region_config.detection_method)
    ) {
      errors.push(
        `Invalid detection_method. Must be one of: ${validDetectionMethods.join(
          ", "
        )}`
      );
    }

    if (body.identification) {
      if (
        !body.identification.text_patterns ||
        body.identification.text_patterns.length === 0
      ) {
        errors.push("At least one text pattern is required in identification");
      }
    }

    if (body.region_config) {
      const method = body.region_config.detection_method;

      if (
        method === "coordinates" &&
        (!body.region_config.coordinate_regions ||
          body.region_config.coordinate_regions.length === 0)
      ) {
        errors.push(
          "coordinate_regions is required when detection_method is 'coordinates'"
        );
      }

      if (method === "yolo" && !body.region_config.yolo_config) {
        errors.push("yolo_config is required when detection_method is 'yolo'");
      }

      if (method === "hybrid") {
        if (
          !body.region_config.coordinate_regions &&
          !body.region_config.yolo_config
        ) {
          errors.push(
            "Both coordinate_regions and yolo_config are required for hybrid method"
          );
        }
        if (!body.region_config.hybrid_config) {
          errors.push(
            "hybrid_config is required when detection_method is 'hybrid'"
          );
        }
      }
    }

    if (body.prompts && Object.keys(body.prompts).length === 0) {
      errors.push("At least one prompt is required");
    }

    if (body.field_mapping && Object.keys(body.field_mapping).length === 0) {
      errors.push("At least one field mapping is required");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          valid: false,
          errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: "Template validation successful",
    });
  } catch (error) {
    console.error("Error validating template:", error);
    return NextResponse.json(
      { error: "Failed to validate template", details: String(error) },
      { status: 500 }
    );
  }
}
