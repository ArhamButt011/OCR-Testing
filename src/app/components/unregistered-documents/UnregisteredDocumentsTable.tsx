// src/app/admin/components/unregistered/UnregisteredDocumentsTable.tsx
"use client";

import React, { useState } from "react";
import Swal from "sweetalert2";

interface SuggestedTemplate {
  template_id: string;
  template_name: string;
  match_score: number;
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
  suggested_templates?: SuggestedTemplate[];
}

interface UnregisteredDocumentsTableProps {
  documents: UnregisteredDocument[];
  onAssignTemplate: (documentId: string, templateId: string) => Promise<void>;
  onViewDocument: (pdfUrl: string) => void;
  onCreateNewTemplate: (documentId: string) => void;
}

export const UnregisteredDocumentsTable: React.FC<UnregisteredDocumentsTableProps> = ({
  documents,
  onAssignTemplate,
  onViewDocument,
  onCreateNewTemplate
}) => {
  const [assigningDocs, setAssigningDocs] = useState<Set<string>>(new Set());

  const handleAssign = async (docId: string, templateId: string, templateName: string) => {
    const result = await Swal.fire({
      title: "Assign Template?",
      html: `
        <p>Assign <strong>${templateName}</strong> to this document?</p>
        <p class="text-sm text-gray-600 mt-2">This will trigger OCR reprocessing.</p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, Assign & Reprocess",
      cancelButtonText: "Cancel"
    });

    if (result.isConfirmed) {
      setAssigningDocs(prev => new Set(prev).add(docId));
      try {
        await onAssignTemplate(docId, templateId);
      } finally {
        setAssigningDocs(prev => {
          const newSet = new Set(prev);
          newSet.delete(docId);
          return newSet;
        });
      }
    }
  };

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

  const getMatchScoreColor = (score: number) => {
    if (score >= 0.7) return "text-green-600";
    if (score >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                BL Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                File Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date Added
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Suggested Templates
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((doc) => {
              const isAssigning = assigningDocs.has(doc._id);
              const hasSuggestions = doc.suggested_templates && doc.suggested_templates.length > 0;

              return (
                <tr key={doc._id} className="hover:bg-gray-50">
                  {/* BL Number */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {doc.blNumber || "N/A"}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {doc.fileId}
                    </div>
                  </td>

                  {/* File Name */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {doc.pdfUrl?.split("/").pop() || "Unknown"}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(doc.createdAt)}
                  </td>

                  {/* Confidence */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getConfidenceColor(doc.confidence)}`}>
                      {(doc.confidence * 100).toFixed(0)}%
                    </span>
                  </td>

                  {/* Suggested Templates Dropdown */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {hasSuggestions ? (
                      <div className="relative">
                        <select
                          disabled={isAssigning}
                          onChange={(e) => {
                            const templateId = e.target.value;
                            if (templateId) {
                              const template = doc.suggested_templates?.find(
                                t => t.template_id === templateId
                              );
                              if (template) {
                                handleAssign(doc._id, templateId, template.template_name);
                              }
                              e.target.value = ""; // Reset dropdown
                            }
                          }}
                          className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Template ({doc.suggested_templates?.length})</option>
                          {doc.suggested_templates?.map((template, index) => (
                            <option key={template.template_id} value={template.template_id}>
                              {index + 1}. {template.template_name} ({(template.match_score * 100).toFixed(0)}%)
                            </option>
                          ))}
                        </select>
                        
                        {/* Match scores indicator */}
                        <div className="mt-1 flex items-center gap-1">
                          {doc.suggested_templates?.slice(0, 3).map((template, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1"
                              title={`${template.template_name}: ${(template.match_score * 100).toFixed(0)}%`}
                            >
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                              <span className={`text-xs font-medium ${getMatchScoreColor(template.match_score)}`}>
                                {(template.match_score * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No suggestions</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      {/* View Document */}
                      <button
                        onClick={() => onViewDocument(doc.pdfUrl)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        title="View Document"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>

                      {/* Create New Template */}
                      <button
                        onClick={() => onCreateNewTemplate(doc._id)}
                        disabled={isAssigning}
                        className="inline-flex items-center px-3 py-1.5 border border-yellow-500 rounded-md text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Create New Template"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New
                      </button>

                      {/* Processing Indicator */}
                      {isAssigning && (
                        <div className="flex items-center">
                          <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};