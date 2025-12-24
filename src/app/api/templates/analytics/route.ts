// app/api/analytics/route.ts

import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  const DB_NAME = process.env.DB_NAME || "my-next-app";

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('📊 Analytics API - Start Date:', startDate, 'End Date:', endDate);

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const mockDataCollection = db.collection('mockData');

    // Build date filter - createdAt is stored as Date object
    const dateFilter: any = {};
    if (startDate && endDate) {
      // Create Date objects and set to start/end of day
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      
      dateFilter.createdAt = {
        $gte: startDateObj,
        $lte: endDateObj
      };
    }

    console.log('🔍 Date Filter:', dateFilter);

    // 1. Total Documents & Basic Stats
    const totalDocs = await mockDataCollection.countDocuments(dateFilter);
    console.log('📄 Total Docs:', totalDocs);
    
    // Unregistered = documents with suggested_templates array length > 0
    const unregisteredCount = await mockDataCollection.countDocuments({
      ...dateFilter,
      suggested_templates: { $exists: true, $ne: [] }
    });
    console.log('❌ Unregistered:', unregisteredCount);
    
    // Processed = documents with valid template_id (registered and processed)
    const processedCount = await mockDataCollection.countDocuments({
      ...dateFilter,
      template_id: { $exists: true, $nin: [null, ""] }
    });
    console.log('✅ Processed:', processedCount);

    // 2. Average Confidence - using direct confidence field
    const avgConfidenceResult = await mockDataCollection.aggregate([
      { $match: dateFilter },
      {
        $match: {
          confidence: { $exists: true, $ne: null }
        }
      },
      { 
        $group: { 
          _id: null, 
          avgConfidence: { $avg: '$confidence' } 
        } 
      }
    ]).toArray();
    const avgConfidence = avgConfidenceResult[0]?.avgConfidence || 0;
    console.log('📊 Avg Confidence:', avgConfidence);

    // 3. Documents Per Template (with processing time)
    const docsPerTemplate = await mockDataCollection.aggregate([
      { $match: dateFilter },
      {
        $match: {
          template_id: { $exists: true, $nin: [null, ""] }
        }
      },
      {
        $group: {
          _id: '$template_id',
          count: { $sum: 1 },
          avgProcessingTime: { $avg: '$processing_time' },
          avgConfidence: { $avg: '$confidence' }
        }
      },
      {
        $addFields: {
          template_id_obj: {
            $cond: {
              if: { $eq: [{ $type: '$_id' }, 'string'] },
              then: { $toObjectId: '$_id' },
              else: '$_id'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'templates',
          localField: 'template_id_obj',
          foreignField: '_id',
          as: 'templateInfo'
        }
      },
      { $unwind: { path: '$templateInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          template_id: '$_id',
          template_name: {
            $ifNull: ['$templateInfo.template_name', 'Unknown Template']
          },
          count: 1,
          avgProcessingTime: 1,
          avgConfidence: 1
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    console.log('📋 Docs Per Template:', docsPerTemplate.length);

    // 4. Confidence Distribution (Histogram) - using direct confidence field
    const confidenceDistribution = await mockDataCollection.aggregate([
      { $match: dateFilter },
      {
        $match: {
          confidence: { $exists: true, $ne: null }
        }
      },
      {
        $bucket: {
          groupBy: '$confidence',
          boundaries: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
          default: 'Other',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]).toArray();
    console.log('📊 Confidence Distribution:', confidenceDistribution.length);

    // 5. Unregistered Document Trend (Daily)
    const unregisteredTrend = await mockDataCollection.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: 1 },
          unregistered: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $isArray: '$suggested_templates' },
                    { $gt: [{ $size: '$suggested_templates' }, 0] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          date: '$_id',
          unregisteredRate: {
            $cond: {
              if: { $eq: ['$total', 0] },
              then: 0,
              else: { $multiply: [{ $divide: ['$unregistered', '$total'] }, 100] }
            }
          }
        }
      },
      { $sort: { date: 1 } }
    ]).toArray();
    console.log('📈 Unregistered Trend:', unregisteredTrend.length);

    // 6. Documents Processed Over Time (Daily) - by template
    const docsOverTime = await mockDataCollection.aggregate([
      { $match: dateFilter },
      {
        $match: {
          template_id: { $exists: true, $nin: [null, ""] }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            template_id: '$template_id'
          },
          count: { $sum: 1 }
        }
      },
      {
        $addFields: {
          template_id_obj: {
            $cond: {
              if: { $eq: [{ $type: '$_id.template_id' }, 'string'] },
              then: { $toObjectId: '$_id.template_id' },
              else: '$_id.template_id'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'templates',
          localField: 'template_id_obj',
          foreignField: '_id',
          as: 'templateInfo'
        }
      },
      { $unwind: { path: '$templateInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          date: '$_id.date',
          template_id: '$_id.template_id',
          template_name: {
            $ifNull: ['$templateInfo.template_name', 'Unknown Template']
          },
          count: 1
        }
      },
      { $sort: { date: 1, template_name: 1 } }
    ]).toArray();
    console.log('📅 Docs Over Time:', docsOverTime.length);

    // 7. Category Distribution
    const categoryDistribution = await mockDataCollection.aggregate([
      { $match: dateFilter },
      {
        $match: {
          'classification_details.primary_model_prediction': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$classification_details.primary_model_prediction',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          avgConfidence: 1
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    console.log('📊 Category Distribution:', categoryDistribution.length);

    // 8. Template Usage Ranking
    const templateRanking = docsPerTemplate.slice(0, 10); // Top 10

    // Response
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalDocuments: totalDocs,
          avgConfidence: parseFloat((avgConfidence * 100).toFixed(2)),
          unregisteredRate: totalDocs > 0 ? parseFloat(((unregisteredCount / totalDocs) * 100).toFixed(2)) : 0,
          processedRate: totalDocs > 0 ? parseFloat(((processedCount / totalDocs) * 100).toFixed(2)) : 0,
          unregisteredCount,
          processedCount
        },
        docsPerTemplate,
        confidenceDistribution: confidenceDistribution.map(bucket => ({
          range: `${(bucket._id * 100).toFixed(0)}-${((bucket._id + 0.2) * 100).toFixed(0)}%`,
          count: bucket.count
        })),
        categoryDistribution,
        unregisteredTrend,
        docsOverTime,
        templateRanking
      }
    });
  } catch (error: any) {
    console.error('❌ Analytics API Error:', error);
    console.error('Error Stack:', error.stack);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch analytics data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Export CSV
export async function POST(request: Request) {
  const DB_NAME = process.env.DB_NAME || "my-next-app";

  try {
    const { type, startDate, endDate } = await request.json();

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const mockDataCollection = db.collection('mockData');

    const dateFilter: any = {};
    if (startDate && endDate) {
      // Create Date objects and set to start/end of day
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      
      dateFilter.createdAt = {
        $gte: startDateObj,
        $lte: endDateObj
      };
    }

    if (type === 'summary') {
      // Export summary data by category
      const data = await mockDataCollection.aggregate([
        { $match: dateFilter },
        {
          $match: {
            'classification_details.primary_model_prediction': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$classification_details.primary_model_prediction',
            count: { $sum: 1 },
            avgProcessingTime: { $avg: '$processing_time' },
            avgConfidence: { $avg: '$confidence' },
            unregistered: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $isArray: '$suggested_templates' },
                      { $gt: [{ $size: '$suggested_templates' }, 0] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            avgProcessingTime: 1,
            avgConfidence: 1,
            unregistered: 1,
            processed: { $subtract: ['$count', '$unregistered'] }
          }
        },
        { $sort: { count: -1 } }
      ]).toArray();

      const headers = ['Category', 'Total Documents', 'Processed', 'Unregistered', 'Avg Processing Time (ms)', 'Avg Confidence (%)'];
      
      const csvRows = [
        headers.join(','),
        ...data.map(row => [
          row.category || 'Unknown',
          row.count,
          row.processed || 0,
          row.unregistered || 0,
          row.avgProcessingTime?.toFixed(2) || 0,
          ((row.avgConfidence || 0) * 100).toFixed(2)
        ].join(','))
      ];

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=analytics_summary.csv'
        }
      });
    }

    if (type === 'templates') {
      // Export template-based data
      const data = await mockDataCollection.aggregate([
        { $match: dateFilter },
        {
          $match: {
            template_id: { $exists: true, $nin: [null, ""] }
          }
        },
        {
          $group: {
            _id: '$template_id',
            count: { $sum: 1 },
            avgProcessingTime: { $avg: '$processing_time' },
            avgConfidence: { $avg: '$confidence' }
          }
        },
        {
          $addFields: {
            template_id_obj: {
              $cond: {
                if: { $eq: [{ $type: '$_id' }, 'string'] },
                then: { $toObjectId: '$_id' },
                else: '$_id'
              }
            }
          }
        },
        {
          $lookup: {
            from: 'templates',
            localField: 'template_id_obj',
            foreignField: '_id',
            as: 'templateInfo'
          }
        },
        { $unwind: { path: '$templateInfo', preserveNullAndEmptyArrays: true } }
      ]).toArray();

      const headers = ['Template ID', 'Template Name', 'Documents Processed', 'Avg Processing Time (ms)', 'Avg Confidence (%)'];
      
      const csvRows = [
        headers.join(','),
        ...data.map(row => [
          row.templateInfo?.template_id || row._id || 'Unknown',
          row.templateInfo?.template_name || 'Unknown',
          row.count,
          row.avgProcessingTime?.toFixed(2) || 0,
          ((row.avgConfidence || 0) * 100).toFixed(2)
        ].join(','))
      ];

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=template_analytics.csv'
        }
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid export type' }, { status: 400 });
  } catch (error: any) {
    console.error('❌ Export Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to export data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}