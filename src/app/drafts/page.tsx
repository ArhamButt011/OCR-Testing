// src/app/admin/drafts/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Context & Layout
import { useSidebar } from "../context/SidebarContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Spinner from "../components/Spinner";

// Draft Components
import { DraftSearchBar } from "../components/drafts/DraftsSearchBar";
import { DraftTable } from "../components/drafts/DraftTable";
import { DraftPagination } from "../components/drafts/DraftPagination";
import { DraftEmptyState } from "../components/drafts/DraftEmptyState";
import { DraftLoadingState } from "../components/drafts/DraftLoadingState";
import { CreateTemplateModal } from "../components/CreateTemplateModal";

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
    if (!confirm("Are you sure you want to delete this draft?")) {
      return;
    }

    try {
      console.log("🗑️ Deleting draft:", draftId);

      const response = await fetch(
        `/api/templates/draft?draft_id=${draftId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        console.log("✅ Draft deleted successfully");

        // Update state immediately without refetching
        setDrafts((prevDrafts) =>
          prevDrafts.filter((draft) => draft._id !== draftId)
        );
        setTotalItems((prev) => prev - 1);

        // Show success message
        alert("Draft deleted successfully");
      } else {
        const error = await response.json();
        console.error("❌ Failed to delete draft:", error);
        alert(error.error || "Failed to delete draft");
      }
    } catch (error) {
      console.error("❌ Error deleting draft:", error);
      alert("Failed to delete draft");
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedDraftId(undefined);
    // fetchDrafts(); // Refresh list after edit
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
        {/* Sidebar - Hidden on mobile, shown on desktop */}
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
                <DraftLoadingState />
              ) : drafts.length === 0 ? (
                <DraftEmptyState hasFilters={hasActiveFilters} />
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
                    <DraftPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      itemsPerPage={itemsPerPage}
                      totalItems={totalItems}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={handleItemsPerPageChange}
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