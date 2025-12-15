// src/app/admin/drafts/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSidebar } from "../context/SidebarContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Spinner from "../components/Spinner";
import { Pagination } from "../components/common/Pagination";
import { LoadingState } from "../components/common/LoadingState";
import { EmptyState } from "../components/common/EmptyState";
import { DraftSearchBar } from "../components/drafts/DraftsSearchBar";
import { DraftTable } from "../components/drafts/DraftTable";
import { CreateTemplateModal } from "../components/CreateTemplateModal";
import Swal from "sweetalert2";
import { toast } from "react-toastify";

export interface Draft {
  _id: string;
  draft_id: string;
  step_number: number;
  partial_data: {
    template_id?: string;
    template_name?: string;
    category?: string;
    version?: string;
    description?: string;
    [key: string]: any;
  };
  metadata: {
    created_at: string;
    last_saved_at: string;
    expires_at: string;
  };
}

export default function DraftsPage() {
  const router = useRouter();
  const { isExpanded } = useSidebar();

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("metadata.last_saved_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Track if we're currently fetching to prevent reset
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
    fetchDrafts();
  }, [isAuthenticated, searchQuery, sortBy, sortOrder, currentPage, itemsPerPage]);

  const fetchDrafts = async () => {
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

      const response = await fetch(`/api/templates/draft?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();

        setDrafts(data.drafts || []);
        setTotalItems(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 0);
      } else {
        console.error("Failed to fetch drafts, status:", response.status);
      }
    } catch (error) {
      console.error("Failed to fetch drafts:", error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Handler functions
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    console.log("Sorting by field:", field);
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
    setSortBy("metadata.last_saved_at");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || sortBy !== "metadata.last_saved_at";

  // Handle edit draft
  const handleEdit = (draftId: string) => {
    setSelectedDraftId(draftId);
    setIsModalOpen(true);
  };

  // Handle delete draft
  const handleDelete = async (draftId: string) => {
    const result = await Swal.fire({
      title: "Delete Draft",
      text: "Are you sure you want to delete this draft?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#F0F1F3",
      cancelButtonText: "Cancel",
      confirmButtonText: "Delete",
    });
    
    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/templates/draft?draft_id=${draftId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setDrafts((prevDrafts) =>
          prevDrafts.filter((draft) => draft._id !== draftId)
        );
        setTotalItems((prev) => prev - 1);

        toast.success("Draft deleted successfully");
      } else {
        const error = await response.json();
        console.error("❌ Failed to delete draft:", error);
        toast.error(error.error || "Failed to delete draft");
      }
    } catch (error) {
      console.error("❌ Error deleting draft:", error);
      toast.error("Failed to delete draft");
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedDraftId(undefined);
  };

  const handleSidebarStateChange = (newState: boolean) => {
    return newState;
  };

  if (loadingAuth) return <Spinner />;
  if (!isAuthenticated)
    return <p className="p-8">Access Denied. Redirecting...</p>;

  return (
    <>
      <div className="flex flex-col lg:flex-row h-screen bg-white">
        {/* Sidebar */}
        <div className="">
          <Sidebar onStateChange={handleSidebarStateChange} />
        </div>

        <div
          className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
            isExpanded ? "lg:ml-64" : "ml-24"
          }`}
        >
          {/* Header */}
          <Header
            leftContent="Drafts"
            totalContent={totalItems}
            rightContent={null}
            buttonContent={null}
          />

          {/* Main content */}
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
              {/* Page Header */}
              <div className="mb-4 sm:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                      Template Drafts
                    </h1>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
                      Manage incomplete template drafts
                    </p>
                  </div>
                </div>
              </div>

              {/* Search & Filters */}
              <DraftSearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                handleSort={handleSort}
                sortBy={sortBy}
                onClearFilters={clearFilters}
              />

              {/* Table or Empty State */}
              {loading ? (
                <LoadingState type="skeleton-table" rows={10} />
              ) : drafts.length === 0 ? (
                <EmptyState
                  icon="document"
                  title="No drafts found"
                  description={
                    hasActiveFilters
                      ? "Try adjusting your search filters"
                      : "You have no saved drafts. Start creating a new template to save a draft."
                  }
                  action={
                    !hasActiveFilters
                      ? {
                          label: "Go to Templates",
                          onClick: () => router.push("/templates"),
                          icon: (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          ),
                        }
                      : undefined
                  }
                />
              ) : (
                <>
                  <DraftTable
                    drafts={drafts}
                    sortField={sortBy}
                    sortDirection={sortOrder}
                    onSort={handleSort}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />

                  {/* Pagination */}
                  <div className="mt-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      itemsPerPage={itemsPerPage}
                      totalItems={totalItems}
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

      {/* Edit Draft Modal */}
      <CreateTemplateModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        draftId={selectedDraftId}
      />
    </>
  );
}