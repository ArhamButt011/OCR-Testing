// src/app/admin/components/unregistered/TemplateDetailsModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { LoadingState } from "../common/LoadingState";

interface TemplateDetails {
  _id: string;
  template_id: string;
  template_name: string;
  category: string;
  version: string;
  description: string;
  status: string;
  identification: {
    reference_images: Array<{
      image_id: string;
      file_path: string;
    }>;
    text_patterns: string[];
  };
  region_config: {
    detection_method: string;
    yolo_config?: any;
    coordinate_regions?: any[];
    hybrid_config?: any;
  };
  prompts: Record<string, any>;
  field_mapping: Record<string, any>;
  metadata: {
    created_at: string;
    updated_at: string;
    usage_count: number;
    success_rate: number;
  };
}

interface TemplateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string | null;
}

export const TemplateDetailsModal: React.FC<TemplateDetailsModalProps> = ({
  isOpen,
  onClose,
  templateId
}) => {
  const [template, setTemplate] = useState<TemplateDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && templateId) {
      fetchTemplateDetails();
    }
  }, [isOpen, templateId]);

  const fetchTemplateDetails = async () => {
    if (!templateId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/templates/${templateId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch template details");
      }

      const data = await response.json();
      setTemplate(data.template);
    } catch (err) {
      console.error("Error fetching template:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  if (typeof window === "undefined") return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: "bg-green-100 text-green-700",
      inactive: "bg-gray-100 text-gray-700",
      deprecated: "bg-red-100 text-red-700"
    };
    return colors[status as keyof typeof colors] || colors.inactive;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Template Details
            </h2>
            {template && (
              <p className="text-sm text-gray-600 mt-1">
                {template.template_name} ({template.template_id})
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <LoadingState type="spinner" message="Loading template details..." />
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-2">
                <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">Error loading template</p>
              <p className="text-sm text-gray-500 mt-1">{error}</p>
            </div>
          ) : template ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Template Name</p>
                    <p className="font-medium text-gray-900">{template.template_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Template ID</p>
                    <p className="font-mono text-sm text-gray-900">{template.template_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Category</p>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                      {template.category}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Version</p>
                    <p className="font-medium text-gray-900">{template.version}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Status</p>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusBadge(template.status)}`}>
                      {template.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Usage Count</p>
                    <p className="font-medium text-gray-900">{template.metadata.usage_count}</p>
                  </div>
                </div>
                {template.description && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-600 mb-1">Description</p>
                    <p className="text-sm text-gray-700">{template.description}</p>
                  </div>
                )}
              </div>

              {/* Identification */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Identification</h3>
                
                {/* Reference Images */}
                {template.identification.reference_images.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Reference Images</p>
                    <div className="grid grid-cols-4 gap-3">
                      {template.identification.reference_images.map((img, idx) => (
                        <div key={idx} className="aspect-square bg-gray-100 rounded overflow-hidden relative">
                          <img
                            src={img.file_path}
                            alt={img.image_id}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Text Patterns */}
                {template.identification.text_patterns.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Text Patterns</p>
                    <div className="flex flex-wrap gap-2">
                      {template.identification.text_patterns.map((pattern, idx) => (
                        <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                          {pattern}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Region Configuration */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Region Configuration</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Detection Method:</span>
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm font-medium">
                      {template.region_config.detection_method}
                    </span>
                  </div>

                  {template.region_config.coordinate_regions && template.region_config.coordinate_regions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Coordinate Regions</p>
                      <div className="space-y-2">
                        {template.region_config.coordinate_regions.map((region: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded p-3">
                            <p className="font-medium text-gray-900 mb-1">{region.region_name}</p>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div>
                                <span className="text-gray-600">X1:</span>
                                <span className="ml-1 text-gray-900">{(region.x1_ratio * 100).toFixed(0)}%</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Y1:</span>
                                <span className="ml-1 text-gray-900">{(region.y1_ratio * 100).toFixed(0)}%</span>
                              </div>
                              <div>
                                <span className="text-gray-600">X2:</span>
                                <span className="ml-1 text-gray-900">{(region.x2_ratio * 100).toFixed(0)}%</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Y2:</span>
                                <span className="ml-1 text-gray-900">{(region.y2_ratio * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Prompts */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Extraction Prompts</h3>
                <div className="space-y-3">
                  {Object.entries(template.prompts).map(([key, value]: [string, any]) => (
                    <div key={key} className="bg-gray-50 rounded p-3">
                      <p className="font-medium text-gray-900 mb-2 capitalize">{key.replace(/_/g, ' ')}</p>
                      <div className="bg-white border border-gray-200 rounded p-2 text-xs font-mono text-gray-700 whitespace-pre-wrap">
                        {value.prompt_text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Field Mapping */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Field Mapping</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target Field</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Object.entries(template.field_mapping).map(([key, value]: [string, any]) => (
                        <tr key={key}>
                          <td className="px-3 py-2 font-mono text-xs text-gray-900">{value.target_field}</td>
                          <td className="px-3 py-2 text-xs text-gray-700">{value.source_field}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {value.data_type}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {value.required ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Metadata */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Created At</p>
                    <p className="text-gray-900">
                      {new Date(template.metadata.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Last Updated</p>
                    <p className="text-gray-900">
                      {new Date(template.metadata.updated_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Success Rate</p>
                    <p className="text-gray-900 font-medium">
                      {(template.metadata.success_rate * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};