// src/app/admin/templates/page.tsx
"use client";

import React, { useState, useEffect } from "react";
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
import { useTemplateFilters } from "@/hooks/useTemplateFilters";
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

  // Load templates
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/templates`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        console.error("Failed to fetch templates, status:", response.status);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  // Use custom hooks
  const {
    searchQuery,
    filterStatus,
    filterCategory,
    sortField,
    sortDirection,
    currentPage,
    itemsPerPage,
    sortedTemplates,
    paginatedTemplates,
    totalPages,
    hasActiveFilters,
    handleSort,
    handleSearchChange,
    handleStatusChange,
    handleCategoryChange,
    setCurrentPage,
    handleItemsPerPageChange,
    clearFilters,
  } = useTemplateFilters(templates);

  const {
    handleActivate,
    handleDeactivate,
    handleDeprecate,
    handleDelete,
  } = useTemplateActions(fetchTemplates);

  const handleCreateNew = () => {
    setSelectedDraftId(undefined);
    setIsModalOpen(true);
  };

  const handleSidebarStateChange = (newState: boolean) => {
    return newState;
  };

  if (loadingAuth) return <Spinner />;
  if (!isAuthenticated) return <p className="p-8">Access Denied. Redirecting...</p>;

  return (
    <>
      <div className="flex flex-row h-screen bg-white">
        <Sidebar onStateChange={handleSidebarStateChange} />

        <div
          className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
            isExpanded ? "ml-64" : "ml-24"
          }`}
        >
          {/* Header */}
          <Header
            leftContent="Templates"
            totalContent={sortedTemplates.length}
            rightContent={null}
            buttonContent={null}
          />

          {/* Main content */}
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Page Header */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Template Dashboard</h1>
                    <p className="mt-2 text-sm text-gray-600">
                      FR-013: Manage document recognition templates
                    </p>
                  </div>
                  <button
                    onClick={handleCreateNew}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create New Template
                  </button>
                </div>
              </div>

              {/* Search & Filters - AC-013-4, AC-013-2 */}
              <TemplateSearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                filterStatus={filterStatus}
                onStatusChange={handleStatusChange}
                filterCategory={filterCategory}
                onCategoryChange={handleCategoryChange}
                onClearFilters={clearFilters}
              />

              {/* Table or Empty State - AC-013-1 */}
              {loading ? (
                <TemplateLoadingState />
              ) : sortedTemplates.length === 0 ? (
                <TemplateEmptyState
                  hasFilters={hasActiveFilters}
                  onCreateNew={handleCreateNew}
                />
              ) : (
                <>
                  <TemplateTable
                    templates={paginatedTemplates}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onActivate={handleActivate}
                    onDeactivate={handleDeactivate}
                    onDeprecate={handleDeprecate}
                    onDelete={handleDelete}
                  />

                  {/* Pagination - AC-013-6 */}
                  {totalPages > 1 && (
                    <div className="mt-4">
                      <TemplatePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        itemsPerPage={itemsPerPage}
                        totalItems={sortedTemplates.length}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={handleItemsPerPageChange}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchTemplates();
        }}
        draftId={selectedDraftId}
      />
    </>
  );
}