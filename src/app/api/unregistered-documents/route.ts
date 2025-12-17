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
            { B_L_Number: { $regex: search, $options: 'i' } },
            { fileId: { $regex: search, $options: 'i' } },
            { pdfUrl: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }

    // Category filter based on classification details
    if (category && category !== 'all') {
      filter['classification_details.primary_model_prediction'] = category;
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
      if (doc.suggested_templates && Array.isArray(doc.suggested_templates)) {
        doc.suggested_templates.forEach((st: any) => {
          if (st.template_id) {
            // Only add if it's a valid ObjectId format
            if (ObjectId.isValid(st.template_id)) {
              templateIds.add(st.template_id);
            }
          }
        });
      }
    });

    // Fetch all templates in a single query if we have template IDs
    let templates: any[] = [];
    if (templateIds.size > 0) {
      try {
        templates = await templatesCollection.find({
          _id: { $in: Array.from(templateIds).map(id => new ObjectId(id)) }
        }).toArray();
      } catch (templateError) {
        console.error('Error fetching templates:', templateError);
        // Continue without templates if fetch fails
        templates = [];
      }
    }

    // Create template lookup map
    const templateMap = new Map(
      templates.map(t => [String(t._id), t])
    );

    // Enrich documents with full template details
    const enrichedDocs = docs.map(doc => {
      // Sort suggested templates by priority (already ordered in response)
      const sortedSuggestions = (doc.suggested_templates && Array.isArray(doc.suggested_templates) 
        ? doc.suggested_templates 
        : []
      )
        .map((suggestion: any) => {
          const template = templateMap.get(suggestion.template_id);
          return {
            template_id: suggestion.template_id || '',
            template_name: suggestion.template_name || template?.template_name || 'Unknown',
            match_score: suggestion.match_score || 0,
            priority: suggestion.priority || 0,
            category: template?.category || 'Unknown',
            thumbnail_url: template?.identification?.reference_images?.[0]?.file_path || null,
            version: template?.version || '1.0.0'
          };
        })
        .sort((a: any, b: any) => a.priority - b.priority);

      return {
        _id: String(doc._id),
        fileId: doc.fileId || '',
        pdfUrl: doc.pdfUrl || '',
        blNumber: doc.blNumber || doc.B_L_Number || '',
        podDate: doc.podDate || doc.POD_Date || '',
        confidence: doc.confidence || 0,
        processing_time: doc.processing_time || 0,
        createdAt: doc.createdAt || new Date().toISOString(),
        
        // Include classification details
        classification_details: doc.classification_details || {
          primary_model_prediction: 'Unknown',
          primary_confidence: 0,
          secondary_model_prediction: 'Unknown',
          secondary_confidence: 0
        },
        
        // Enriched suggested templates
        suggested_templates: sortedSuggestions,
        
        // Document thumbnail
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
      { 
        success: false, 
        error: 'Failed to fetch unregistered documents', 
        details: String(error) 
      },
      { status: 500 }
    );
  }
}