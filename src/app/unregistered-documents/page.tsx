// src/app/admin/unregistered-documents/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Spinner from "../components/Spinner";
import { useSidebar } from "../context/SidebarContext";
import { UnregisteredDocumentsTable } from "../components/unregistered-documents";
import { UnregisteredSearchBar } from "../components/unregistered-documents";
import { UnregisteredPagination } from "../components/unregistered-documents";
import { DocumentViewModal } from "../components/unregistered-documents/DocumentViewModal";
import { CreateTemplateModal } from "../components/CreateTemplateModal";
import Swal from "sweetalert2";

interface UnregisteredDocument {
  _id: string;
  fileId: string;
  pdfUrl: string;
  blNumber: string;
  podDate: string;
  confidence: number;
  processing_time: number;
  createdAt: string;
  suggested_templates?: Array<{
    template_id: string;
    template_name: string;
    match_score: number;
    category: string;
    thumbnail_url: string;
    version: string;
  }>;
}

export default function UnregisteredDocumentsPage() {
  const router = useRouter();
  const { isExpanded } = useSidebar();
  
  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [documents, setDocuments] = useState<UnregisteredDocument[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState("");
  const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false);
  const [selectedDocForTemplate, setSelectedDocForTemplate] = useState<string | null>(null);

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

  // Fetch unregistered documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        search: searchQuery,
        category: categoryFilter,
        sortBy,
        sortOrder
      });

      const response = await fetch(`/api/unregistered-documents?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      
      setDocuments(data.documents || []);
      setTotalDocs(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching documents:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to fetch unregistered documents"
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, categoryFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated, fetchDocuments]);

  const handleAssignTemplate = async (documentId: string, templateId: string) => {
    try {
      const response = await fetch("/api/unregistered-documents/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: [documentId],
          templateId,
          reprocess: true
        })
      });

      const result = await response.json();

      if (response.ok) {
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: result.message,
          timer: 2000
        });
        
        // Refresh list
        fetchDocuments();
      } else {
        throw new Error(result.error || "Assignment failed");
      }
    } catch (error) {
      console.error("Assignment error:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: String(error)
      });
    }
  };

  const handleViewDocument = (pdfUrl: string) => {
    setSelectedDocumentUrl(pdfUrl);
    setViewModalOpen(true);
  };

  const handleCreateNewTemplate = (documentId: string) => {
    setSelectedDocForTemplate(documentId);
    setCreateTemplateModalOpen(true);
  };

  const handleSidebarStateChange = (newState: boolean) => {
    return newState;
  };

  if (loadingAuth) return <Spinner />;
  if (!isAuthenticated) return <p className="p-8">Access Denied. Redirecting...</p>;

  return (
    <>
      <div className="flex flex-col lg:flex-row h-screen bg-white">
        <div>
          <Sidebar onStateChange={handleSidebarStateChange} />
        </div>

        <div
          className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
            isExpanded ? "lg:ml-64" : "ml-24"
          }`}
        >
          <Header
            leftContent="Unregistered Documents"
            totalContent={totalDocs}
            rightContent={null}
            buttonContent={null}
          />

          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Unregistered Documents Review
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Assign templates to unregistered documents and trigger reprocessing
                </p>
              </div>

              {/* Search and Filters */}
              <UnregisteredSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                onSearch={fetchDocuments}
              />

              {/* Table */}
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Spinner />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg shadow">
                  <div className="text-gray-400 text-6xl mb-4">📄</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    No Unregistered Documents
                  </h3>
                  <p className="text-gray-500">
                    All documents have been assigned templates!
                  </p>
                </div>
              ) : (
                <UnregisteredDocumentsTable
                  documents={documents}
                  onAssignTemplate={handleAssignTemplate}
                  onViewDocument={handleViewDocument}
                  onCreateNewTemplate={handleCreateNewTemplate}
                />
              )}

              {/* Pagination */}
              {!loading && documents.length > 0 && (
                <UnregisteredPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document View Modal */}
      <DocumentViewModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        pdfUrl={selectedDocumentUrl}
      />

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={createTemplateModalOpen}
        onClose={() => {
          setCreateTemplateModalOpen(false);
          setSelectedDocForTemplate(null);
          fetchDocuments();
        }}
        draftId={undefined}
        templateId={undefined}
      />
    </>
  );
}