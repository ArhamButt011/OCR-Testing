// app/api/unregistered-documents/route.ts

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const mockDataCollection = db.collection('mockData');
    const templatesCollection = db.collection('templates');

    // Build filter for unregistered documents
    const filter: any = {
      $or: [
        { template_id: null },
        { template_id: { $exists: false } },
        { template_id: '' }
      ]
    };

    // Search filter
    if (search) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { blNumber: { $regex: search, $options: 'i' } },
            { fileId: { $regex: search, $options: 'i' } },
            { pdfUrl: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }

    // Category filter (if suggested templates have this category)
    if (category) {
      filter['suggested_templates.category'] = category;
    }

    const skip = (page - 1) * limit;

    // Get unregistered documents
    const [docs, total] = await Promise.all([
      mockDataCollection
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .toArray(),
      mockDataCollection.countDocuments(filter)
    ]);

    // Get all unique template IDs from suggested templates
    const templateIds = new Set<string>();
    docs.forEach(doc => {
      doc.suggested_templates?.forEach((st: any) => {
        if (st.template_id) {
          templateIds.add(st.template_id);
        }
      });
    });

    // Fetch all templates in a single query
    const templates = await templatesCollection.find({
      _id: { $in: Array.from(templateIds).map(id => new ObjectId(id)) }
    }).toArray();

    // Create template lookup map
    const templateMap = new Map(
      templates.map(t => [String(t._id), t])
    );

    // Enrich documents with full template details
    const enrichedDocs = docs.map(doc => {
      const enrichedSuggestions = doc.suggested_templates?.map((suggestion: any) => {
        const template = templateMap.get(suggestion.template_id);
        return {
          template_id: suggestion.template_id,
          match_score: suggestion.match_score,
          template_name: template?.template_name || 'Unknown',
          category: template?.category || 'Unknown',
          thumbnail_url: template?.identification?.reference_images?.[0]?.file_path || null,
          version: template?.version || '1.0.0'
        };
      }) || [];

      return {
        ...doc,
        suggested_templates: enrichedSuggestions,
        // Generate document thumbnail path (assuming stored during upload)
        document_thumbnail: doc.pdfUrl ? `/api/generate-thumbnail?file=${encodeURIComponent(doc.pdfUrl)}` : null
      };
    });

    return NextResponse.json({
      success: true,
      documents: enrichedDocs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        search,
        category,
        sortBy,
        sortOrder: sortOrder === 1 ? 'asc' : 'desc'
      }
    });
  } catch (error) {
    console.error('Error fetching unregistered documents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch unregistered documents', details: String(error) },
      { status: 500 }
    );
  }
}