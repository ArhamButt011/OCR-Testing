// src/app/admin/templates/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Context & Layout
import { useSidebar } from "../context/SidebarContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Spinner from "../components/Spinner";

// Template Components
import { TemplateSearchBar } from "../components/templates/TemplateSearchBar";
import { TemplateTable } from "../components/templates/TemplateTable";
import type { Template } from "../components/templates/TemplateTable";
import { TemplatePagination } from "../components/templates/TemplatePagination";
import { TemplateEmptyState } from "../components/templates/TemplateEmptyState";
import { TemplateLoadingState } from "../components/templates/TemplateLoadingState";
import { CreateTemplateModal } from "../components/CreateTemplateModal";

// Hooks
import { useTemplateActions } from "@/hooks/useTemplateActions";

export default function TemplatesPage() {
  const router = useRouter();
  const { isExpanded } = useSidebar();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | undefined>();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();

  // Server-side filtering, sorting, and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
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
    fetchTemplates();
  }, [
    isAuthenticated,
    searchQuery,
    filterStatus,
    filterCategory,
    sortBy,
    sortOrder,
    currentPage,
    itemsPerPage,
  ]);

  const fetchTemplates = async () => {
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
      if (filterStatus !== "all") {
        params.append("status", filterStatus);
      }
      if (filterCategory !== "all") {
        params.append("category", filterCategory);
      }

      const response = await fetch(`/api/templates?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        
        setTemplates(data.templates || []);
        setTotalItems(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 0);
      } else {
        console.error("Failed to fetch templates, status:", response.status);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const { handleActivate, handleDeactivate, handleDeprecate, handleDelete } =
    useTemplateActions(fetchTemplates);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleStatusChange = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string) => {
    console.log("Selected category:", category);
    setFilterCategory(category);
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
    setFilterStatus("all");
    setFilterCategory("all");
    setSortBy("");
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery || filterStatus !== "all" || filterCategory !== "all";

  // Handle create new template
  const handleCreateNew = () => {
    setSelectedDraftId(undefined);
    setSelectedTemplateId(undefined);
    setIsModalOpen(true);
  };

  // Handle edit template
  const handleEdit = (templateId: string) => {
    setSelectedDraftId(undefined);
    setSelectedTemplateId(templateId);
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedDraftId(undefined);
    setSelectedTemplateId(undefined);
    fetchTemplates(); // Refresh list after create/edit
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
        <div className="hidden lg:block">
          <Sidebar onStateChange={handleSidebarStateChange} />
        </div>

        <div
          className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
            isExpanded ? "lg:ml-64" : "lg:ml-24"
          }`}
        >
          {/* Header */}
          <Header
            leftContent="Templates"
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
                      Template Dashboard
                    </h1>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
                      Manage document recognition templates
                    </p>
                  </div>
                  <button
                    onClick={handleCreateNew}
                    className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary w-full sm:w-auto"
                  >
                    <svg
                      className="h-5 w-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Create New Template
                  </button>
                </div>
              </div>

              {/* Search & Filters */}
              <TemplateSearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                filterStatus={filterStatus}
                onStatusChange={handleStatusChange}
                handleSort={handleSort}
                sortBy={sortBy}
                filterCategory={filterCategory}
                onCategoryChange={handleCategoryChange}
                onClearFilters={clearFilters}
              />

              {/* Table or Empty State */}
              {loading ? (
                <TemplateLoadingState />
              ) : templates.length === 0 ? (
                <TemplateEmptyState
                  hasFilters={hasActiveFilters}
                  onCreateNew={handleCreateNew}
                />
              ) : (
                <>
                  <TemplateTable
                    templates={templates}
                    sortField={sortBy as any}
                    sortDirection={sortOrder}
                    onSort={handleSort}
                    onActivate={handleActivate}
                    onDeactivate={handleDeactivate}
                    onDeprecate={handleDeprecate}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />

                  {/* Pagination */}
                  <div className="mt-4">
                    <TemplatePagination
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

      {/* Create/Edit Template Modal */}
      <CreateTemplateModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        draftId={selectedDraftId}
        templateId={selectedTemplateId}
      />
    </>
  );
}