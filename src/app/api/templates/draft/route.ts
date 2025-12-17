// src/app/api/templates/draft/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { v4 as uuidv4 } from "uuid";
import { withLogging } from "@/lib/apiWrapper";
import { ObjectId } from "mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

// ============== SAVE/UPDATE DRAFT ==============
async function createDraftHandler(
  req: NextRequest | Request
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { step_number, partial_data } = body;

    // Validation
    if (!step_number || step_number < 1 || step_number > 7) {
      return NextResponse.json(
        { error: "step_number is required and must be between 1 and 7" },
        { status: 400 }
      );
    }

    if (!partial_data) {
      return NextResponse.json(
        { error: "partial_data is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const draftsCollection = db.collection("template_drafts");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const newDraftId = uuidv4();
    const draftDoc = {
      draft_id: newDraftId,
      step_number: step_number,
      partial_data: partial_data,
      metadata: {
        created_at: now,
        last_saved_at: now,
        expires_at: expiresAt,
      },
    };

    const insertResult = await draftsCollection.insertOne(draftDoc);

    return NextResponse.json(
      {
        success: true,
        _id: insertResult.insertedId.toString(),
        draft_id: newDraftId,
        step_number: step_number,
        message: "Draft created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating draft:", error);
    return NextResponse.json(
      { error: "Failed to create draft", details: String(error) },
      { status: 500 }
    );
  }
}

// ============== GET USER DRAFTS ==============
async function getDraftHandlerGET(
  req: NextRequest | Request
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const draft_id = searchParams.get("draft_id");

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const draftsCollection = db.collection("template_drafts");

    // Delete expired drafts
    await draftsCollection.deleteMany({
      "metadata.expires_at": { $lt: new Date() },
    });

    // If draft_id is provided, return specific draft
    if (draft_id) {
      if (!ObjectId.isValid(draft_id)) {
        return NextResponse.json(
          { error: "Invalid draft ID." },
          { status: 400 }
        );
      }

      const draft = await draftsCollection.findOne({
        _id: ObjectId.createFromHexString(draft_id),
      });

      if (!draft) {
        return NextResponse.json(
          { error: "Draft not found or unauthorized" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        draft,
      });
    }

    // Otherwise, return paginated list of drafts
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const searchQuery = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "metadata.last_saved_at";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    const filter: any = {};

    // Search by template_id or template_name
    if (searchQuery) {
      filter.$or = [
        { template_id: { $regex: searchQuery, $options: "i" } },
        { template_name: { $regex: searchQuery, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Sort options
    const sortOptions: any = { [sortBy]: sortOrder };

    const [drafts, total] = await Promise.all([
      draftsCollection
        .find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .toArray(),
      draftsCollection.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      drafts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        search: searchQuery,
        sortBy,
        sortOrder: sortOrder === 1 ? "asc" : "desc",
      },
    });
  } catch (error) {
    console.error("Error fetching drafts:", error);
    return NextResponse.json(
      { error: "Failed to fetch drafts", details: String(error) },
      { status: 500 }
    );
  }
}

// ============== DELETE DRAFT ==============
async function deleteDraftHandlerDELETE(
  req: NextRequest | Request
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const draft_id = searchParams.get("draft_id");

    if (!draft_id || !ObjectId.isValid(draft_id)) {
      return NextResponse.json(
        { error: "Invalid or missing ID." },
        { status: 400 }
      );
    }

    if (!draft_id) {
      return NextResponse.json(
        { error: "draft_id is required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const draftsCollection = db.collection("template_drafts");

    const deleteResult = await draftsCollection.deleteOne({
      _id: ObjectId.createFromHexString(draft_id),
    });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json(
        { error: "Draft not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      draft_id: draft_id,
      message: "Draft deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting draft:", error);
    return NextResponse.json(
      { error: "Failed to delete draft", details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/drafts/[draft_id] - Update existing draft
async function updateDraftHandler(
  req: NextRequest | Request,
  { params }: any
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const draft_id = searchParams.get("draft_id");

    const body = await req.json();
    const { step_number, partial_data } = body;

    if (!draft_id || !ObjectId.isValid(draft_id)) {
      return NextResponse.json(
        { error: "Invalid or missing ID." },
        { status: 400 }
      );
    }

    // Validation
    if (step_number && (step_number < 1 || step_number > 7)) {
      return NextResponse.json(
        { error: "step_number must be between 1 and 7" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const draftsCollection = db.collection("template_drafts");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Build update object
    const updateFields: any = {
      "metadata.last_saved_at": now,
      "metadata.expires_at": expiresAt,
    };

    if (step_number !== undefined) {
      updateFields.step_number = step_number;
    }

    if (partial_data !== undefined) {
      updateFields.partial_data = partial_data;
    }

    const updateResult = await draftsCollection.updateOne(
      { _id: ObjectId.createFromHexString(draft_id) },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      draft_id: draft_id,
      step_number: step_number,
      message: "Draft updated successfully",
    });
  } catch (error) {
    console.error("Error updating draft:", error);
    return NextResponse.json(
      { error: "Failed to update draft", details: String(error) },
      { status: 500 }
    );
  }
}

// Export wrapped handlers
export const POST = withLogging(createDraftHandler);
export const GET = withLogging(getDraftHandlerGET);
export const DELETE = withLogging(deleteDraftHandlerDELETE);
export const PATCH = withLogging(updateDraftHandler);
