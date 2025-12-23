// components/UnregisteredDocumentDetails.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { IoArrowBack, IoDocument, IoTime, IoCheckmarkCircle, IoAlertCircle, IoDownload } from 'react-icons/io5';

interface ClassificationDetails {
  primary_model_prediction: string;
  primary_confidence: number;
  secondary_model_prediction: string;
  secondary_confidence: number;
}

interface SuggestedTemplate {
  template_id: string;
  template_name: string;
  match_score: number;
  priority: number;
  category: string;
  thumbnail_url: string | null;
  version: string;
}

interface DocumentData {
  _id: string;
  fileId?: string;
  pdfUrl: string;
  blNumber?: string;
  podDate?: string;
  confidence: number;
  processing_time: number;
  createdAt: string;
  classification_details: ClassificationDetails;
  suggested_templates: SuggestedTemplate[];
  document_thumbnail: string | null;
}

interface UnregisteredDocumentDetailsProps {
  documentId: string;
}

export default function UnregisteredDocumentDetails({ documentId }: UnregisteredDocumentDetailsProps) {
  const router = useRouter();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/unregistered-documents/${documentId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch document');
        }

        if (data.success) {
          setDocument(data.document);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  const handleTemplateSelect = (templateId: string) => {
    // Navigate to template registration or details page
    router.push(`/templates/${templateId}/register?documentId=${documentId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <IoAlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">Error</h2>
          <p className="text-gray-600 text-center mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Document not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <IoArrowBack className="h-5 w-5 mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Document Details</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Document Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Document Preview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Preview</h2>
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                {document.document_thumbnail ? (
                  <Image
                    src={document.document_thumbnail}
                    alt="Document thumbnail"
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <IoDocument className="h-24 w-24 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-between items-center">
                <a
                  href={document.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-blue-600 hover:text-blue-700"
                >
                  <IoDownload className="h-4 w-4 mr-2" />
                  Download PDF
                </a>
                {document.fileId && (
                  <span className="text-sm text-gray-500">File ID: {document.fileId}</span>
                )}
              </div>
            </div>

            {/* Suggested Templates */}
            {document.suggested_templates.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Suggested Templates</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {document.suggested_templates.map((template) => (
                    <div
                      key={template.template_id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition cursor-pointer"
                      onClick={() => handleTemplateSelect(template.template_id)}
                    >
                      <div className="flex items-start space-x-4">
                        {template.thumbnail_url ? (
                          <div className="relative w-16 h-16 flex-shrink-0 bg-gray-100 rounded">
                            <Image
                              src={template.thumbnail_url}
                              alt={template.template_name}
                              fill
                              className="object-cover rounded"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center">
                            <IoDocument className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{template.template_name}</h3>
                          <p className="text-sm text-gray-500 mb-2">{template.category}</p>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs px-2 py-1 rounded ${getConfidenceColor(template.match_score)}`}>
                              {(template.match_score * 100).toFixed(1)}% Match
                            </span>
                            <span className="text-xs text-gray-500">Priority: {template.priority}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Document Info */}
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Document ID</label>
                  <p className="text-sm font-mono text-gray-900 break-all">{document._id}</p>
                </div>
                {document.blNumber && (
                  <div>
                    <label className="text-sm text-gray-500">B/L Number</label>
                    <p className="text-gray-900">{document.blNumber}</p>
                  </div>
                )}
                {document.podDate && (
                  <div>
                    <label className="text-sm text-gray-500">POD Date</label>
                    <p className="text-gray-900">{document.podDate}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-500">Created At</label>
                  <p className="text-gray-900">{formatDate(document.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Processing Time</label>
                  <p className="text-gray-900 flex items-center">
                    <IoTime className="h-4 w-4 mr-1" />
                    {document.processing_time.toFixed(2)}s
                  </p>
                </div>
              </div>
            </div>

            {/* Classification Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Classification</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">Primary Model</label>
                  <p className="text-gray-900">{document.classification_details.primary_model_prediction}</p>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Confidence</span>
                      <span className={getConfidenceColor(document.classification_details.primary_confidence)}>
                        {(document.classification_details.primary_confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          document.classification_details.primary_confidence >= 0.8
                            ? 'bg-green-500'
                            : document.classification_details.primary_confidence >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${document.classification_details.primary_confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-500">Secondary Model</label>
                  <p className="text-gray-900">{document.classification_details.secondary_model_prediction}</p>
                  <div className="mt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Confidence</span>
                      <span className={getConfidenceColor(document.classification_details.secondary_confidence)}>
                        {(document.classification_details.secondary_confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          document.classification_details.secondary_confidence >= 0.8
                            ? 'bg-green-500'
                            : document.classification_details.secondary_confidence >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${document.classification_details.secondary_confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className="flex items-center text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-sm font-medium">
                  <IoAlertCircle className="h-4 w-4 mr-1" />
                  Unregistered
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}