// src/app/api/templates/reference-images/[imageId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";
const UPLOAD_DIR = path.join(process.cwd(), "public", "templates", "images");

export async function deleteImageHandler(
  req: NextRequest | Request,
  { params }: any
): Promise<NextResponse> {
  try {
    console.log("🗑️ Delete request for image:", params.imageId);

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const imagesCollection = db.collection("reference_images");
    const templatesCollection = db.collection("templates");
    const templateDraftsCollection = db.collection("template_drafts");

    // Step 1: Find the image document
    const image = await imagesCollection.findOne({
      image_id: params.imageId,
    });

    if (!image) {
      console.log("❌ Image not found:", params.imageId);
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Step 2: Check where this image is being used (optional - for logging)
    const templatesUsingImage = await templatesCollection.countDocuments({
      "identification.reference_images.image_id": params.imageId,
    });
    const draftsUsingImage = await templateDraftsCollection.countDocuments({
      "partial_data.identification.reference_images.image_id": params.imageId,
    });

    console.log(`📊 Image usage: ${templatesUsingImage} templates, ${draftsUsingImage} drafts`);

    // Step 3: Remove references from templates collection
    const templatesUpdateResult = await templatesCollection.updateMany(
      { "identification.reference_images.image_id": params.imageId },
      { 
        $pull: { 
          "identification.reference_images": { 
            image_id: params.imageId 
          } 
        } as any
      }
    );

    console.log(`✅ Removed from ${templatesUpdateResult.modifiedCount} templates`);

    // Step 4: Remove references from template_drafts collection
    const draftsUpdateResult = await templateDraftsCollection.updateMany(
      { "partial_data.identification.reference_images.image_id": params.imageId },
      { 
        $pull: { 
          "partial_data.identification.reference_images": { 
            image_id: params.imageId 
          } 
        } as any
      }
    );

    console.log(`✅ Removed from ${draftsUpdateResult.modifiedCount} drafts`);

    // Step 5: Delete the physical file from disk
    const filename = path.basename(image.file_path);
    const filepath = path.join(UPLOAD_DIR, filename);

    console.log("Attempting to delete file:", filepath);

    if (existsSync(filepath)) {
      await unlink(filepath);
      console.log("✅ File deleted from disk");
    } else {
      console.log("⚠️ File not found on disk:", filepath);
    }

    // Step 6: Delete the image document from reference_images
    await imagesCollection.deleteOne({
      image_id: params.imageId,
    });

    console.log("✅ Image deleted from database");

    // Return detailed response
    return NextResponse.json({
      success: true,
      image_id: params.imageId,
      message: "Image and all references deleted successfully",
      details: {
        templates_affected: templatesUpdateResult.modifiedCount,
        drafts_affected: draftsUpdateResult.modifiedCount,
        file_deleted: existsSync(filepath) ? false : true,
      }
    });
  } catch (error) {
    console.error("❌ Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete image", details: String(error) },
      { status: 500 }
    );
  }
}

export const DELETE = withLogging(deleteImageHandler);