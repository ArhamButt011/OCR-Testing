// src/app/admin/unregistered-documents/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import Spinner from "../../components/Spinner";
import { useSidebar } from "../../context/SidebarContext";
import { LoadingState } from "@/app/components/common/LoadingState";
import { TemplateDetailsModal } from "@/app/components/unregistered-documents/TemplateDetailsModal";
import { CreateTemplateModal } from "../../components/CreateTemplateModal";
import Swal from "sweetalert2";
import Image from "next/image";
import Link from "next/link";
import { useApiConfig } from "@/app/context/ApiConfigContext";

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

export default function DocumentDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { isExpanded } = useSidebar();
  const documentId = params?.id as string;
  const {aiBaseUrl}=useApiConfig()

  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [document, setDocument] = useState<UnregisteredDocument | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [templateDetailsModalOpen, setTemplateDetailsModalOpen] =
    useState(false);
  const [selectedTemplateForDetails, setSelectedTemplateForDetails] = useState<
    string | null
  >(null);
  const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");

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
    if (isAuthenticated && documentId) {
      fetchDocument();
    }
  }, [isAuthenticated, documentId]);

  const fetchDocument = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/unregistered-documents/${documentId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch document");
      }

      const data = await response.json();
      setDocument(data.document);
    } catch (error) {
      console.error("Error fetching document:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to fetch document details",
      });
      // Preserve URL params when redirecting back
      const queryString = searchParams.toString();
      const backUrl = queryString
        ? `/unregistered-documents?${queryString}`
        : "/unregistered-documents";
      router.push(backUrl);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTemplateId || !document) {
      Swal.fire({
        icon: "warning",
        title: "No Template Selected",
        text: "Please select a template before assigning.",
      });
      return;
    }

    const selectedTemplate = document.suggested_templates.find(
      (t) => t.template_id === selectedTemplateId
    );

    const result = await Swal.fire({
      title: "Assign Template & Reprocess?",
      html: `
        <div class="text-left">
          <p class="mb-2">Assign <strong>${
            selectedTemplate?.template_name
          }</strong> to this document?</p>
          <p class="text-sm text-gray-600 mb-2">Match Score: <strong>${(
            (selectedTemplate?.match_score || 0) * 100
          ).toFixed(0)}%</strong></p>
          <p class="text-sm text-gray-600">This will trigger OCR reprocessing with the assigned template.</p>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#6B7280",
      confirmButtonText: "Yes, Assign & Reprocess",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      setIsAssigning(true);
      try {
        const response = await fetch(`${aiBaseUrl}/api/ocr/reprocess`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            _id: document._id,
            file_url: document.pdfUrl,
            template_id: selectedTemplateId,
          }),
        });

        const resultData = await response.json();

        if (response.ok) {
          Swal.fire({
            icon: "success",
            title: "Success!",
            html: `
              <div class="text-left">
                <p class="mb-2">${resultData.message}</p>
                <p class="text-sm text-gray-600">The document has been reprocessed with the assigned template.</p>
              </div>
            `,
            timer: 3000,
          }).then(() => {
            // Preserve URL params when redirecting back
            const queryString = searchParams.toString();
            const backUrl = queryString
              ? `/unregistered-documents?${queryString}`
              : "/unregistered-documents";
            router.push(backUrl);
          });
        } else {
          throw new Error(resultData.error || "Assignment failed");
        }
      } catch (error) {
        console.error("Assignment error:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: String(error),
        });
      } finally {
        setIsAssigning(false);
      }
    }
  };

  const handleViewTemplateDetails = (templateId: string) => {
    setSelectedTemplateForDetails(templateId);
    setTemplateDetailsModalOpen(true);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "text-green-600 bg-green-100";
    if (confidence >= 0.5) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  // Handle back navigation with preserved URL params
  const handleBackNavigation = () => {
    const queryString = searchParams.toString();
    const backUrl = queryString
      ? `/unregistered-documents?${queryString}`
      : "/unregistered-documents";
    router.push(backUrl);
  };

  const handleSidebarStateChange = (newState: boolean) => {
    return newState;
  };

  const fileName = document?.pdfUrl.split("/").pop();

  useEffect(() => {
    const accessUrl = fileName
      ? `/api/access-file?filename=${encodeURIComponent(
          fileName
        )}&t=${Date.now()}`
      : "";
    setPdfUrl(accessUrl);
  }, [document?.pdfUrl]);

  if (loadingAuth) return <Spinner />;
  if (!isAuthenticated)
    return <p className="p-8">Access Denied. Redirecting...</p>;

  return (
    <>
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
            leftContent="Document Review"
            totalContent={null}
            rightContent={null}
            buttonContent={null}
          />

          <div className="flex-1 overflow-auto bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-6">
              {/* Back Button */}
              <button
                onClick={handleBackNavigation}
                className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <svg
                  className="h-4 w-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Unregistered Documents
              </button>

              {loading ? (
                <LoadingState
                  type="spinner"
                  message="Loading document..."
                  fullHeight
                />
              ) : !document ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Document not found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Document Preview */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">
                          Document Preview
                        </h3>
                      </div>
                      <div className="aspect-[3/4] relative bg-gray-50">
                        {document.pdfUrl ? (
                          <iframe
                            src={pdfUrl}
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
                  </div>

                  {/* Right: Suggested Templates */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Suggested Templates (
                        {document.suggested_templates.length})
                      </h3>

                      {document.suggested_templates.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                          <p className="text-gray-500 mb-4">
                            No template suggestions available
                          </p>
                          <Link
                            href={"/templates"}
                            className="px-4 py-2 border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 transition"
                          >
                            Create New Template
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {document.suggested_templates.map((template) => (
                            <div
                              key={template.template_id}
                              onClick={() =>
                                setSelectedTemplateId(template.template_id)
                              }
                              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                selectedTemplateId === template.template_id
                                  ? "border-primary bg-blue-50"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                                  {template.priority}
                                </div>

                                <div className="flex-shrink-0 w-20 h-28 bg-gray-100 rounded overflow-hidden relative">
                                  {template.thumbnail_url ? (
                                    <Image
                                      src={template.thumbnail_url}
                                      alt={template.template_name}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center h-full">
                                      <span className="text-gray-400 text-2xl">
                                        ""
                                      </span>
                                    </div>
                                  )}
                                </div>

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

                                  <div className="mb-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs text-gray-600">
                                        Match Score
                                      </span>
                                      <span className="text-sm font-semibold text-gray-900">
                                        {(template.match_score * 100).toFixed(
                                          0
                                        )}
                                        %
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full transition-all ${
                                          template.match_score >= 0.7
                                            ? "bg-green-500"
                                            : template.match_score >= 0.5
                                            ? "bg-yellow-500"
                                            : "bg-red-500"
                                        }`}
                                        style={{
                                          width: `${
                                            template.match_score * 100
                                          }%`,
                                        }}
                                      />
                                    </div>
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewTemplateDetails(
                                        template.template_id
                                      );
                                    }}
                                    className="text-xs text-primary hover:text-primary-dark font-medium"
                                  >
                                    View Details
                                  </button>
                                </div>

                                {selectedTemplateId ===
                                  template.template_id && (
                                  <div className="flex-shrink-0">
                                    <svg
                                      className="w-6 h-6 text-primary"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-6 flex items-center justify-between">
                        <Link
                          href={"/templates"}
                          // onClick={() => setCreateTemplateModalOpen(true)}
                          // disabled={isAssigning}
                          className="px-4 py-2 border-gray-300 text-white bg-[#6B7280] rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Create New Template
                        </Link>

                        <button
                          onClick={handleAssign}
                          disabled={!selectedTemplateId || isAssigning}
                          className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {isAssigning ? (
                            <span className="flex items-center">
                              <svg
                                className="animate-spin h-4 w-4 mr-2"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              Assigning...
                            </span>
                          ) : (
                            "Assign Template"
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Classification Details
                      </h3>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">
                              Primary Model
                            </p>
                            <p className="font-medium text-gray-900">
                              {
                                document.classification_details
                                  .primary_model_prediction
                              }
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${getConfidenceColor(
                              document.classification_details.primary_confidence
                            )}`}
                          >
                            {(
                              document.classification_details
                                .primary_confidence * 100
                            ).toFixed(0)}
                            %
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">
                              Secondary Model
                            </p>
                            <p className="font-medium text-gray-900">
                              {
                                document.classification_details
                                  .secondary_model_prediction
                              }
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${getConfidenceColor(
                              document.classification_details
                                .secondary_confidence
                            )}`}
                          >
                            {(
                              document.classification_details
                                .secondary_confidence * 100
                            ).toFixed(0)}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <TemplateDetailsModal
        isOpen={templateDetailsModalOpen}
        onClose={() => {
          setTemplateDetailsModalOpen(false);
          setSelectedTemplateForDetails(null);
        }}
        templateId={selectedTemplateForDetails}
      />

      <CreateTemplateModal
        isOpen={createTemplateModalOpen}
        onClose={() => {
          setCreateTemplateModalOpen(false);
        }}
        draftId={undefined}
        templateId={undefined}
      />
    </>
  );
}
