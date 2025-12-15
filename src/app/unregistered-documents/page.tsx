// src/app/admin/unregistered-documents/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Spinner from "../components/Spinner";
import { useSidebar } from "../context/SidebarContext";
import { Pagination } from "../components/common/Pagination";
import { LoadingState } from "../components/common/LoadingState";
import { EmptyState } from "../components/common/EmptyState";
import { UnregisteredDocumentsTable } from "../components/unregistered-documents";
import { UnregisteredSearchBar } from "../components/unregistered-documents";
import { DocumentReviewModal } from "../components/unregistered-documents/DocumentViewModal";
import { CreateTemplateModal } from "../components/CreateTemplateModal";
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
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<UnregisteredDocument | null>(null);
  const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false);
  const [selectedDocForTemplate, setSelectedDocForTemplate] = useState<string | null>(null);

  const isFetchingRef = useRef(false);

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
    if (!isAuthenticated) return;
    fetchDocuments();
  }, [
    isAuthenticated,
    currentPage,
    itemsPerPage,
    searchQuery,
    categoryFilter,
    sortBy,
    sortOrder
  ]);

  const fetchDocuments = async () => {
    if (isFetchingRef.current) return;
    
    setLoading(true);
    isFetchingRef.current = true;
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder,
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }
      if (categoryFilter !== "all") {
        params.append("category", categoryFilter);
      }

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
      isFetchingRef.current = false;
    }
  };

  const handleReviewDocument = (document: UnregisteredDocument) => {
    setSelectedDocument(document);
    setReviewModalOpen(true);
  };

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
          html: `
            <div class="text-left">
              <p class="mb-2">${result.message}</p>
              <p class="text-sm text-gray-600">The document has been reprocessed with the assigned template.</p>
            </div>
          `,
          timer: 3000
        });
        
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

  const handleCreateNewTemplate = (documentId: string) => {
    setSelectedDocForTemplate(documentId);
    setReviewModalOpen(false);
    setCreateTemplateModalOpen(true);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string) => {
    setCategoryFilter(category);
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSortBy("createdAt");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || categoryFilter !== "all";

  const handleSidebarStateChange = (newState: boolean) => {
    return newState;
  };

  if (loadingAuth) return <Spinner />;
  if (!isAuthenticated) return <p className="p-8">Access Denied. Redirecting...</p>;

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
            leftContent="Unregistered Documents"
            totalContent={totalDocs}
            rightContent={null}
            buttonContent={null}
          />

          <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
              <div className="mb-4 sm:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                      Unregistered Documents
                    </h1>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
                      Review and assign templates to unregistered documents
                    </p>
                  </div>
                </div>
              </div>

              <UnregisteredSearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                categoryFilter={categoryFilter}
                onCategoryChange={handleCategoryChange}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                onClearFilters={clearFilters}
              />

              {loading ? (
                <LoadingState type="skeleton-table" rows={10} />
              ) : documents.length === 0 ? (
                <EmptyState
                  icon="document"
                  title="No unregistered documents"
                  description={
                    hasActiveFilters
                      ? "Try adjusting your search or filter criteria."
                      : "All documents have been assigned templates!"
                  }
                />
              ) : (
                <>
                  <UnregisteredDocumentsTable
                    documents={documents}
                    sortField={sortBy as any}
                    sortDirection={sortOrder}
                    onSort={handleSort}
                    // onReviewDocument={handleReviewDocument}
                  />

                  <div className="mt-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      itemsPerPage={itemsPerPage}
                      totalItems={totalDocs}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      showItemsPerPage={true}
                      showItemsInfo={true}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document Review Modal */}
      <DocumentReviewModal
        isOpen={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setSelectedDocument(null);
        }}
        document={selectedDocument}
        onAssignTemplate={handleAssignTemplate}
        onCreateNewTemplate={handleCreateNewTemplate}
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