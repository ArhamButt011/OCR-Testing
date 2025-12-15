// src/app/admin/components/unregistered/UnregisteredDocumentsTable.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";

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
  thumbnail_url: string;
  version: string;
}

interface UnregisteredDocument {
  _id: string;
  fileId: string;
  pdfUrl: string;
  blNumber: string;
  podDate: string;
  confidence: number;
  processing_time: number;
  createdAt: string;
  classification_details: ClassificationDetails;
  suggested_templates: SuggestedTemplate[];
  document_thumbnail?: string;
}

interface UnregisteredDocumentsTableProps {
  documents: UnregisteredDocument[];
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}

export const UnregisteredDocumentsTable: React.FC<UnregisteredDocumentsTableProps> = ({
  documents,
  sortField,
  sortDirection,
  onSort
}) => {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "bg-green-100 text-green-700";
    if (confidence >= 0.4) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const SortableHeader: React.FC<{ field: string; children: React.ReactNode }> = ({ field, children }) => (
    <th
      onClick={() => onSort(field)}
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <svg
            className={`h-4 w-4 transition-transform ${sortDirection === "desc" ? "transform rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
      </div>
    </th>
  );

  const handleReview = (documentId: string) => {
    router.push(`/unregistered-documents/${documentId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="blNumber">BL Number</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Classification
              </th>
              <SortableHeader field="createdAt">Date Added</SortableHeader>
              <SortableHeader field="confidence">Confidence</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Suggestions
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((doc) => (
              <tr key={doc._id} className="hover:bg-gray-50 transition-colors">
                {/* BL Number */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {doc.blNumber || "N/A"}
                  </div>
                  <div className="text-xs text-gray-500">
                    ID: {doc.fileId}
                  </div>
                </td>

                {/* Classification */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {doc.classification_details.primary_model_prediction}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(doc.classification_details.primary_confidence * 100).toFixed(0)}% confidence
                    </div>
                  </div>
                </td>

                {/* Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(doc.createdAt)}
                </td>

                {/* Overall Confidence */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getConfidenceColor(doc.confidence)}`}>
                    {(doc.confidence * 100).toFixed(0)}%
                  </span>
                </td>

                {/* Suggestions Count */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {doc.suggested_templates.length} template{doc.suggested_templates.length !== 1 ? 's' : ''}
                    </span>
                    {doc.suggested_templates.length > 0 && (
                      <span className="text-xs text-gray-500">
                        (Best: {(doc.suggested_templates[0].match_score * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => handleReview(doc._id)}
                    className="inline-flex items-center px-4 py-2 border border-primary text-primary bg-white rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors font-medium text-sm"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};