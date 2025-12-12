// src/app/admin/components/unregistered/UnregisteredDocumentCard.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
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
  document_thumbnail?: string;
  suggested_templates?: SuggestedTemplate[];
}

interface UnregisteredDocumentCardProps {
  document: UnregisteredDocument;
  isSelected: boolean;
  onSelect: () => void;
  onAssignTemplate: (documentIds: string[], templateId: string) => Promise<void>;
  onCreateNewTemplate: (documentId: string) => Promise<void>;
}

export const UnregisteredDocumentCard: React.FC<UnregisteredDocumentCardProps> = ({
  document,
  isSelected,
  onSelect,
  onAssignTemplate,
  onCreateNewTemplate
}) => {
  const [isAssigning, setIsAssigning] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState(false);

  const handleAssign = async (templateId: string, templateName: string) => {
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
      setIsAssigning(true);
      try {
        await onAssignTemplate([document._id], templateId);
      } finally {
        setIsAssigning(false);
      }
    }
  };

  const handleCreateNew = async () => {
    const result = await Swal.fire({
      title: "Create New Template?",
      text: "This will open the template creation page with this document as reference.",
      icon: "info",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Create Template",
      cancelButtonText: "Cancel"
    });

    if (result.isConfirmed) {
      await onCreateNewTemplate(document._id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "text-green-600 bg-green-100";
    if (confidence >= 0.4) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const topSuggestions = document.suggested_templates?.slice(0, 3) || [];
  const hasMoreSuggestions = (document.suggested_templates?.length || 0) > 3;

  return (
    <div
      className={`bg-white rounded-lg shadow border-2 transition-all ${
        isSelected ? "border-primary" : "border-gray-200"
      }`}
    >
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Document Preview */}
          <div className="lg:col-span-1">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onSelect}
                className="mt-1 w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
              />
              
              <div className="flex-1">
                <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden mb-3 relative">
                  {document.document_thumbnail ? (
                    <Image
                      src={document.document_thumbnail}
                      alt="Document preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-gray-400 text-6xl">📄</div>
                    </div>
                  )}
                </div>
                
                {/* Document Info */}
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">File:</span>
                    <p className="font-medium text-gray-900 truncate">
                      {document.pdfUrl?.split("/").pop() || "N/A"}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-gray-500">BL Number:</span>
                    <p className="font-medium text-gray-900">
                      {document.blNumber || "N/A"}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-gray-500">Date:</span>
                    <p className="text-gray-700">
                      {formatDate(document.createdAt)}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-gray-500">Confidence:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(document.confidence)}`}>
                      {(document.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Suggested Templates */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Suggested Templates ({document.suggested_templates?.length || 0})
              </h3>
              
              <button
                onClick={handleCreateNew}
                disabled={isAssigning}
                className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                + Create New Template
              </button>
            </div>

            {topSuggestions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No template suggestions available</p>
                <button
                  onClick={handleCreateNew}
                  className="mt-3 text-primary hover:underline font-medium"
                >
                  Create a new template for this document
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Show top 3 suggestions */}
                {topSuggestions.map((template, index) => (
                  <div
                    key={template.template_id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-primary transition"
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank Badge */}
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>

                      {/* Template Thumbnail */}
                      <div className="flex-shrink-0 w-20 h-28 bg-gray-100 rounded overflow-hidden relative">
                        {template.thumbnail_url ? (
                          <Image
                            src={template.thumbnail_url}
                            alt={template.template_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-gray-400 text-3xl">📋</span>
                          </div>
                        )}
                      </div>

                      {/* Template Details */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {template.template_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            {template.category}
                          </span>
                          <span className="text-xs text-gray-500">
                            v{template.version}
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  template.match_score >= 0.7 ? "bg-green-500" :
                                  template.match_score >= 0.5 ? "bg-yellow-500" :
                                  "bg-red-500"
                                }`}
                                style={{ width: `${template.match_score * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {(template.match_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Assign Button */}
                      <button
                        onClick={() => handleAssign(template.template_id, template.template_name)}
                        disabled={isAssigning}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {isAssigning ? "Assigning..." : "Assign"}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Show More Button */}
                {hasMoreSuggestions && (
                  <button
                    onClick={() => setExpandedTemplates(!expandedTemplates)}
                    className="w-full py-2 text-primary hover:bg-blue-50 rounded-md transition font-medium"
                  >
                    {expandedTemplates ? "Show Less" : `Show ${(document.suggested_templates?.length || 0) - 3} More`}
                  </button>
                )}

                {/* Expanded Templates */}
                {expandedTemplates && document.suggested_templates?.slice(3).map((template, index) => (
                  <div
                    key={template.template_id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-primary transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center font-bold">
                        {index + 4}
                      </div>

                      <div className="flex-shrink-0 w-20 h-28 bg-gray-100 rounded overflow-hidden relative">
                        {template.thumbnail_url ? (
                          <Image
                            src={template.thumbnail_url}
                            alt={template.template_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-gray-400 text-3xl">📋</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {template.template_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            {template.category}
                          </span>
                          <span className="text-xs text-gray-500">
                            v{template.version}
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gray-500 h-2 rounded-full"
                                style={{ width: `${template.match_score * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {(template.match_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAssign(template.template_id, template.template_name)}
                        disabled={isAssigning}
                        className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {isAssigning ? "Assigning..." : "Assign"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};