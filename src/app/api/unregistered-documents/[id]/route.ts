// app/api/unregistered-documents/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const mockDataCollection = db.collection('mockData');
    const templatesCollection = db.collection('templates');

    // Fetch the document
    const doc = await mockDataCollection.findOne({
      _id: new ObjectId(documentId)
    });

    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get all unique template IDs from suggested templates
    const templateIds = new Set<string>();
    doc.suggested_templates?.forEach((st: any) => {
      if (st.template_id) {
        templateIds.add(st.template_id);
      }
    });

    // Fetch all templates in a single query
    const templates = await templatesCollection.find({
      _id: { $in: Array.from(templateIds).map(id => new ObjectId(id)) }
    }).toArray();

    // Create template lookup map
    const templateMap = new Map(
      templates.map(t => [String(t._id), t])
    );

    // Sort suggested templates by priority
    const sortedSuggestions = (doc.suggested_templates || [])
      .map((suggestion: any) => {
        const template = templateMap.get(suggestion.template_id);
        return {
          template_id: suggestion.template_id,
          template_name: suggestion.template_name || template?.template_name || 'Unknown',
          match_score: suggestion.match_score || 0,
          priority: suggestion.priority || 0,
          category: template?.category || 'Unknown',
          thumbnail_url: template?.identification?.reference_images?.[0]?.file_path || null,
          version: template?.version || '1.0.0'
        };
      })
      .sort((a: any, b: any) => a.priority - b.priority);

    const enrichedDoc = {
      _id: String(doc._id),
      fileId: doc.fileId,
      pdfUrl: doc.pdfUrl,
      blNumber: doc.blNumber || doc.B_L_Number,
      podDate: doc.podDate || doc.POD_Date,
      confidence: doc.confidence || 0,
      processing_time: doc.processing_time || 0,
      createdAt: doc.createdAt,
      
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

    return NextResponse.json({
      success: true,
      document: enrichedDoc
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch document', details: String(error) },
      { status: 500 }
    );
  }
}