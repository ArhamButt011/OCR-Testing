// src/app/admin/components/unregistered/DocumentReviewModal.tsx
"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Swal from "sweetalert2";

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

interface DocumentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: UnregisteredDocument | null;
  onAssignTemplate: (documentId: string, templateId: string) => Promise<void>;
  onCreateNewTemplate: (documentId: string) => void;
}

export const DocumentReviewModal: React.FC<DocumentReviewModalProps> = ({
  isOpen,
  onClose,
  document,
  onAssignTemplate,
  onCreateNewTemplate
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  if (!isOpen || !document) return null;
  if (typeof window === "undefined") return null;

  const handleAssign = async () => {
    if (!selectedTemplateId) {
      Swal.fire({
        icon: "warning",
        title: "No Template Selected",
        text: "Please select a template before assigning."
      });
      return;
    }

    const selectedTemplate = document.suggested_templates.find(
      t => t.template_id === selectedTemplateId
    );

    const result = await Swal.fire({
      title: "Assign Template & Reprocess?",
      html: `
        <div class="text-left">
          <p class="mb-2">Assign <strong>${selectedTemplate?.template_name}</strong> to this document?</p>
          <p class="text-sm text-gray-600 mb-2">Match Score: <strong>${((selectedTemplate?.match_score || 0) * 100).toFixed(0)}%</strong></p>
          <p class="text-sm text-gray-600">This will trigger OCR reprocessing with the assigned template.</p>
        </div>
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
        await onAssignTemplate(document._id, selectedTemplateId);
        onClose();
      } finally {
        setIsAssigning(false);
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isAssigning) {
      onClose();
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "text-green-600 bg-green-100";
    if (confidence >= 0.5) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white w-full max-w-7xl rounded-lg shadow-2xl relative flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Document Review
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              BL: {document.blNumber || "N/A"} | File ID: {document.fileId}
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isAssigning}
            className="text-gray-400 hover:text-gray-500 focus:outline-none disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Left: Document Preview & Classification */}
            <div className="space-y-6">
              {/* Document Image */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <div className="aspect-[3/4] relative">
                  {document.pdfUrl ? (
                    <iframe
                      src={`/api/access-file?filename=${encodeURIComponent(document.pdfUrl)}`}
                      className="w-full h-full border-0"
                      title="Document preview"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-gray-400 text-6xl">📄</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Classification Details */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Classification Details
                </h3>
                
                <div className="space-y-3">
                  {/* Primary Classification */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Primary Model</p>
                      <p className="font-medium text-gray-900">
                        {document.classification_details.primary_model_prediction}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getConfidenceColor(document.classification_details.primary_confidence)}`}>
                      {(document.classification_details.primary_confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Secondary Classification */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Secondary Model</p>
                      <p className="font-medium text-gray-900">
                        {document.classification_details.secondary_model_prediction}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getConfidenceColor(document.classification_details.secondary_confidence)}`}>
                      {(document.classification_details.secondary_confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Overall Confidence */}
                  {/* <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Overall Confidence</p>
                      <p className="font-medium text-gray-900">Document Quality</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getConfidenceColor(document.confidence)}`}>
                      {(document.confidence * 100).toFixed(0)}%
                    </span>
                  </div> */}

                  {/* Processing Time */}
                  {/* <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">Processing Time</p>
                    <p className="font-medium text-gray-900">{document.processing_time}ms</p>
                  </div> */}
                </div>
              </div>
            </div>

            {/* Right: Suggested Templates */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Suggested Templates ({document.suggested_templates.length})
                </h3>

                {document.suggested_templates.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500 mb-4">No template suggestions available</p>
                    <button
                      onClick={() => onCreateNewTemplate(document._id)}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition"
                    >
                      Create New Template
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {document.suggested_templates.map((template) => (
                      <div
                        key={template.template_id}
                        onClick={() => setSelectedTemplateId(template.template_id)}
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          selectedTemplateId === template.template_id
                            ? "border-primary bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Priority Badge */}
                          <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {template.priority}
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
                                <span className="text-gray-400 text-2xl">📋</span>
                              </div>
                            )}
                          </div>

                          {/* Template Details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 mb-2">
                              {template.template_name}
                            </h4>
                            
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {template.category}
                              </span>
                              <span className="text-xs text-gray-500">
                                v{template.version}
                              </span>
                            </div>

                            {/* Match Score Bar */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-600">Match Score</span>
                                <span className="text-sm font-semibold text-gray-900">
                                  {(template.match_score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    template.match_score >= 0.7 ? "bg-green-500" :
                                    template.match_score >= 0.5 ? "bg-yellow-500" :
                                    "bg-red-500"
                                  }`}
                                  style={{ width: `${template.match_score * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Selection Indicator */}
                          {selectedTemplateId === template.template_id && (
                            <div className="flex-shrink-0">
                              <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => onCreateNewTemplate(document._id)}
            disabled={isAssigning}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Create New Template
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isAssigning}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Cancel
            </button>

            <button
              onClick={handleAssign}
              disabled={!selectedTemplateId || isAssigning}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isAssigning ? (
                <span className="flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Assigning...
                </span>
              ) : (
                "Assign Template"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
window.document.body  );
};