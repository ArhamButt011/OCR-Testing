// src/app/api/templates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import jwt from "jsonwebtoken";

const DB_NAME = process.env.DB_NAME || "my-next-app";
const SECRET_KEY = process.env.JWT_SECRET as string;

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
          "metadata.updated_by": body.userId,
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

    if (currentTemplate.status === "active") {
      const { searchParams } = new URL(req.url);
      const forceDelete = searchParams.get("force") === "true";

      if (!forceDelete) {
        return NextResponse.json(
          {
            error:
              "Cannot delete active template. Deactivate it first or use force=true query parameter.",
          },
          { status: 403 }
        );
      }
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
