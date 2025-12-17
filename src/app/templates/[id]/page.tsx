// src/app/templates/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Spinner from "../../components/Spinner";
import { useSidebar } from "../../context/SidebarContext";
import { LoadingState } from "@/app/components/common/LoadingState";
import Image from "next/image";

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
  post_processing_rules?: Record<string, any>;
  metadata: {
    created_at: string;
    updated_at: string;
    usage_count: number;
    success_rate: number;
  };
}

export default function TemplateDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { isExpanded } = useSidebar();
  const templateId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [template, setTemplate] = useState<TemplateDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/admin-login");
      return;
    }

    const decodeJwt = (token: string) => {
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        return JSON.parse(jsonPayload);
      } catch (e) {
        return null;
      }
    };

    const decodedToken = decodeJwt(token);
    const currentTime = Date.now() / 1000;

    if (!decodedToken || decodedToken.exp < currentTime) {
      localStorage.removeItem("token");
      router.push("/admin-login");
      return;
    }

    if (decodedToken.role !== "admin") {
      router.push("/extracted-data-monitoring");
      return;
    }

    setIsAuthenticated(true);
    setLoadingAuth(false);
  }, [router]);

  useEffect(() => {
    if (isAuthenticated && templateId) {
      fetchTemplateDetails();
    }
  }, [isAuthenticated, templateId]);

  const fetchTemplateDetails = async () => {
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

  const getStatusBadge = (status: string) => {
    const colors = {
      active: "bg-green-100 text-green-700",
      inactive: "bg-gray-100 text-gray-700",
      deprecated: "bg-red-100 text-red-700"
    };
    return colors[status as keyof typeof colors] || colors.inactive;
  };

  const handleSidebarStateChange = (newState: boolean) => {
    return newState;
  };

  if (loadingAuth) return <Spinner />;
  if (!isAuthenticated) return <p className="p-8">Access Denied. Redirecting...</p>;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-white">
      <div className="">
        <Sidebar onStateChange={handleSidebarStateChange} />
      </div>

      <div
        className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
          isExpanded ? "lg:ml-64" : "ml-24"
        }`}
      >
        <Header
          leftContent="Template Details"
          totalContent={null}
          rightContent={null}
          buttonContent={null}
        />

        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Back Button */}
            <button
              onClick={() => router.push("/templates")}
              className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Templates
            </button>

            {loading ? (
              <LoadingState type="spinner" message="Loading template details..." fullHeight />
            ) : error ? (
              <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
                <div className="text-red-500 mb-2">
                  <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">Error loading template</p>
                <p className="text-sm text-gray-500 mt-1">{error}</p>
              </div>
            ) : !template ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Template not found</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Template Name</p>
                      <p className="font-medium text-gray-900 text-lg">{template.template_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Template ID</p>
                      <p className="font-mono text-sm text-gray-900">{template.template_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Category</p>
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {template.category}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Version</p>
                      <p className="font-medium text-gray-900">{template.version}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(template.status)}`}>
                        {template.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Usage Count</p>
                      <p className="font-medium text-gray-900">{template.metadata.usage_count.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Success Rate</p>
                      <p className="font-medium text-gray-900">
                        {(template.metadata.success_rate * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {template.description && (
                    <div className="mt-6">
                      <p className="text-sm text-gray-600 mb-1">Description</p>
                      <p className="text-gray-700">{template.description}</p>
                    </div>
                  )}
                </div>

                {/* Identification */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Identification</h2>
                  
                  {/* Reference Images */}
                  {template.identification.reference_images.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-3">Reference Images</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {template.identification.reference_images.map((img, idx) => (
                          <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative border border-gray-200">
                            <img
                              src={img.file_path}
                              alt={img.image_id}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2">
                              {img.image_id}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Text Patterns */}
                  {template.identification.text_patterns.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-3">Text Patterns</p>
                      <div className="flex flex-wrap gap-2">
                        {template.identification.text_patterns.map((pattern, idx) => (
                          <span key={idx} className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Region Configuration */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Region Configuration</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">Detection Method:</span>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                        {template.region_config.detection_method}
                      </span>
                    </div>

                    {template.region_config.coordinate_regions && template.region_config.coordinate_regions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-3">Coordinate Regions</p>
                        <div className="space-y-3">
                          {template.region_config.coordinate_regions.map((region: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <p className="font-medium text-gray-900 mb-3 text-lg">{region.region_name}</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white rounded p-3 border border-gray-200">
                                  <span className="text-xs text-gray-600 block mb-1">X1 Position</span>
                                  <span className="text-sm font-medium text-gray-900">{(region.x1_ratio).toFixed(2)}</span>
                                </div>
                                <div className="bg-white rounded p-3 border border-gray-200">
                                  <span className="text-xs text-gray-600 block mb-1">Y1 Position</span>
                                  <span className="text-sm font-medium text-gray-900">{(region.y1_ratio).toFixed(2)}</span>
                                </div>
                                <div className="bg-white rounded p-3 border border-gray-200">
                                  <span className="text-xs text-gray-600 block mb-1">X2 Position</span>
                                  <span className="text-sm font-medium text-gray-900">{(region.x2_ratio).toFixed(2)}</span>
                                </div>
                                <div className="bg-white rounded p-3 border border-gray-200">
                                  <span className="text-xs text-gray-600 block mb-1">Y2 Position</span>
                                  <span className="text-sm font-medium text-gray-900">{(region.y2_ratio).toFixed(2)}</span>
                                </div>
                              </div>
                              {region.confidence_threshold && (
                                <div className="mt-3 bg-white rounded p-3 border border-gray-200">
                                  <span className="text-xs text-gray-600">Confidence Threshold: </span>
                                  <span className="text-sm font-medium text-gray-900">
                                    {(region.confidence_threshold * 100).toFixed(0)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prompts */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Extraction Prompts</h2>
                  <div className="space-y-4">
                    {Object.entries(template.prompts).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="font-medium text-gray-900 mb-3 text-lg capitalize">
                          {key.replace(/_/g, ' ')}
                        </p>
                        <div className="bg-white border border-gray-300 rounded-lg p-4">
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                            {value.prompt_text}
                          </pre>
                        </div>
                        {value.expected_output_schema && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-gray-600 mb-2">Expected Output Schema:</p>
                            <div className="bg-gray-100 rounded p-3 text-xs font-mono">
                              <pre>{JSON.stringify(value.expected_output_schema, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Field Mapping */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Field Mapping</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Target Field</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Source</th>
                          {/* <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Required</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Default Value</th> */}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.entries(template.field_mapping).map(([key, value]: [string, any]) => (
                          <tr key={key} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-sm text-gray-900">{value.target_field}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{value.source_field}</td>
                            {/* <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {value.data_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {value.required ? (
                                <span className="text-green-600 font-bold text-lg">✓</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {value.default_value !== undefined ? String(value.default_value) : '-'}
                            </td> */}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Metadata */}
                {/* <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Metadata</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Created At</p>
                      <p className="text-gray-900 font-medium">
                        {new Date(template.metadata.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Last Updated</p>
                      <p className="text-gray-900 font-medium">
                        {new Date(template.metadata.updated_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </div>
                </div> */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}