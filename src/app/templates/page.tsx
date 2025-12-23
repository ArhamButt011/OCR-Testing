// src/app/templates/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Spinner from "../components/Spinner";
import { Pagination } from "../components/common/Pagination";
import { LoadingState } from "../components/common/LoadingState";
import { EmptyState } from "../components/common/EmptyState";
import { TemplateSearchBar } from "../components/templates/TemplateSearchBar";
import { TemplateTable } from "../components/templates/TemplateTable";
import type { Template } from "../components/templates/TemplateTable";
import { CreateTemplateModal } from "../components/CreateTemplateModal";
import { TemplateTestModal } from "../components/templates/TemplateTestModal";
import { useTemplateActions } from "@/hooks/useTemplateActions";

// Separate component that uses useSearchParams
function TemplatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isExpanded } = useSidebar();
  
  // Get initial values from URL or use defaults
  const getInitialValue = (key: string, defaultValue: any) => {
    const value = searchParams.get(key);
    if (value === null) return defaultValue;
    
    // Handle different types
    if (key === 'page' || key === 'limit') {
      return parseInt(value) || defaultValue;
    }
    return value;
  };

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | undefined>();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  
  // Initialize state from URL params
  const [searchQuery, setSearchQuery] = useState(() => getInitialValue('search', ''));
  const [filterStatus, setFilterStatus] = useState(() => getInitialValue('status', 'all'));
  const [filterCategory, setFilterCategory] = useState(() => getInitialValue('category', 'all'));
  const [sortBy, setSortBy] = useState(() => getInitialValue('sortBy', ''));
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => 
    getInitialValue('sortOrder', 'asc') as "asc" | "desc"
  );
  const [currentPage, setCurrentPage] = useState(() => getInitialValue('page', 1));
  const [itemsPerPage, setItemsPerPage] = useState(() => getInitialValue('limit', 10));
  
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const isFetchingRef = useRef(false);

  // Update URL when state changes
  const updateURL = useCallback((params: Record<string, any>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === '' || value === 'all' || value === null || value === undefined) {
        current.delete(key);
      } else {
        current.set(key, String(value));
      }
    });

    const search = current.toString();
    const query = search ? `?${search}` : '';
    
    // Use replace to avoid adding to history for every state change
    router.replace(`/templates${query}`, { scroll: false });
  }, [router, searchParams]);

  // Authentication check
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

  // Fetch templates when URL params change
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

  // Local state update functions
  const updateTemplateInState = useCallback((templateId: string, updates: Partial<Template>) => {
    setTemplates(prev => 
      prev.map(template => 
        template._id === templateId 
          ? { ...template, ...updates }
          : template
      )
    );
  }, []);

  const addTemplateToState = useCallback((newTemplate: Template) => {
    setTemplates(prev => [newTemplate, ...prev]);
    setTotalItems(prev => prev + 1);
  }, []);

  const removeTemplateFromState = useCallback((templateId: string) => {
    setTemplates(prev => prev.filter(template => template._id !== templateId));
    setTotalItems(prev => prev - 1);
  }, []);

  // Enhanced template actions with local state updates
  const { handleActivate, handleDeactivate, handleDeprecate, handleDelete } =
    useTemplateActions((templateId, action, data) => {
      switch (action) {
        case 'activate':
        case 'deactivate':
        case 'deprecate':
          updateTemplateInState(templateId, { status: data.status });
          break;
        case 'delete':
          removeTemplateFromState(templateId);
          break;
      }
    });

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    updateURL({ search: query, page: 1 });
  };

  const handleStatusChange = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
    updateURL({ status, page: 1 });
  };

  const handleCategoryChange = (category: string) => {
    setFilterCategory(category);
    setCurrentPage(1);
    updateURL({ category, page: 1 });
  };

  const handleSort = (field: string) => {
    const newSortOrder = sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(newSortOrder);
    setCurrentPage(1);
    updateURL({ sortBy: field, sortOrder: newSortOrder, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateURL({ page });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
    updateURL({ limit: newItemsPerPage, page: 1 });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterCategory("all");
    setSortBy("");
    setSortOrder("asc");
    setCurrentPage(1);
    setItemsPerPage(10);
    
    // Clear all URL params
    router.replace('/templates', { scroll: false });
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

  // Handle modal close with local state update
const handleModalClose = (shouldRefresh?: boolean, templateData?: any) => {
  setIsModalOpen(false);
  const wasEditing = !!selectedTemplateId;
  const editingId = selectedTemplateId;
  setSelectedDraftId(undefined);
  setSelectedTemplateId(undefined);
  
  if (templateData) {
    console.log('Modal closed with template data:', templateData);
    
    // Ensure we have the template object (it might be nested in a 'template' property)
    const template = templateData.template || templateData;
    
    if (wasEditing && editingId) {
      // Update existing template
      console.log('Updating existing template:', editingId);
      updateTemplateInState(editingId, template);
    } else {
      // Add new template
      console.log('Adding new template to state');
      
      // Ensure the template has all required fields for the table
      const newTemplate: Template = {
        _id: template._id,
        template_id: template.template_id,
        template_name: template.template_name,
        category: template.category,
        status: template.status || 'inactive',
        version: template.version,
        metadata: template.metadata || {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 0,
          success_rate: 0,
        },
      };
      
      addTemplateToState(newTemplate);
    }
  } else if (shouldRefresh) {
    // Only refetch if explicitly requested
    console.log('Refetching templates due to shouldRefresh flag');
    // fetchTemplates();
  }
};

  const handleTest = (template: Template) => {
    setSelectedTemplate(template);
    setTestModalOpen(true);
  };
  
  const handleTestModalClose = () => {
    setTestModalOpen(false);
    setSelectedTemplate(null);
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
        <div className="">
          <Sidebar onStateChange={handleSidebarStateChange} />
        </div>

        <div
          className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
            isExpanded ? "lg:ml-64" : "ml-24"
          }`}
        >
          <div className="min-h-screen bg-gray-50">
            <div className="mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
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

              {loading ? (
                <LoadingState type="skeleton-table" rows={10} />
              ) : templates.length === 0 ? (
                <EmptyState
                  icon="template"
                  title="No templates found"
                  description={
                    hasActiveFilters
                      ? "Try adjusting your filters"
                      : "Get started by creating a new template"
                  }
                  action={
                    !hasActiveFilters
                      ? {
                          label: "Create Template",
                          onClick: handleCreateNew,
                          icon: (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          ),
                        }
                      : undefined
                  }
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
                    onTest={handleTest}
                  />

                  <div className="mt-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      itemsPerPage={itemsPerPage}
                      totalItems={totalItems}
                      onPageChange={handlePageChange}
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

      <CreateTemplateModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        draftId={selectedDraftId}
        templateId={selectedTemplateId}
      />
      <TemplateTestModal
        isOpen={testModalOpen}
        onClose={handleTestModalClose}
        template={selectedTemplate}
      />
    </>
  );
}

// Main page component with Suspense boundary
export default function TemplatesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <TemplatesContent />
    </Suspense>
  );
}