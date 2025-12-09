// src/app/admin/templates/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Local components & context (keeps same import pattern as your Jobs page)
import { useSidebar } from "../context/SidebarContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Spinner from "../components/Spinner";

import { CreateTemplateModal } from "../components/CreateTemplateModal";

interface Template {
  template_id: string;
  template_name: string;
  category: string;
  status: "active" | "inactive" | "deprecated";
  version: string;
  metadata: {
    created_at: string;
    updated_at: string;
  };
}

export default function TemplatesPage() {
  const router = useRouter();
  const { isExpanded } = useSidebar();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Auth check (same pattern as Jobs page)
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

  // Load templates (trigger after filters change or auth succeeds)
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterCategory, isAuthenticated]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterCategory !== "all") params.append("category", filterCategory);

      const response = await fetch(`/api/templates?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        // optional: handle non-ok responses
        console.error("Failed to fetch templates, status:", response.status);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedDraftId(undefined);
    setIsModalOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    // For editing, you might want to convert template to draft first
    setSelectedDraftId(undefined);
    setIsModalOpen(true);
  };

  const handleActivateTemplate = async (templateId: string) => {
    if (!confirm("Activate this template?")) return;

    try {
      const response = await fetch(`/api/templates/${templateId}/activate`, {
        method: "POST",
      });

      if (response.ok) {
        alert("Template activated successfully!");
        fetchTemplates();
      } else {
        throw new Error("Failed to activate");
      }
    } catch (error) {
      console.error("Activation failed:", error);
      alert("Failed to activate template");
    }
  };

  const handleDeprecateTemplate = async (templateId: string) => {
    if (!confirm("Deprecate this template? It will no longer be used for OCR.")) return;

    try {
      const response = await fetch(`/api/templates/${templateId}/deprecate`, {
        method: "POST",
      });

      if (response.ok) {
        alert("Template deprecated successfully!");
        fetchTemplates();
      } else {
        throw new Error("Failed to deprecate");
      }
    } catch (error) {
      console.error("Deprecation failed:", error);
      alert("Failed to deprecate template");
    }
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_template_id: `${templateId}_COPY` }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Template duplicated as ${data.template_id}`);
        fetchTemplates();
      } else {
        throw new Error("Failed to duplicate");
      }
    } catch (error) {
      console.error("Duplication failed:", error);
      alert("Failed to duplicate template");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Delete this template? This action cannot be undone.")) return;

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        alert("Template deleted successfully!");
        fetchTemplates();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      console.error("Deletion failed:", error);
      alert("Failed to delete template");
    }
  };


    const handleSidebarStateChange = (newState: boolean) => {
    // setIsSidebarExpanded(newState);
    return newState;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      deprecated: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          (styles as any)[status]
        }`}
      >
        {status}
      </span>
    );
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
            totalContent={templates.length}
            rightContent={null}
            buttonContent={null}
          />

          {/* Main content */}
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Page Header / Actions */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">OCR Templates</h1>
                    <p className="mt-2 text-sm text-gray-600">
                      Manage your document recognition templates
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

              {/* Filters */}
              <div className="mb-6 flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-primary"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="deprecated">Deprecated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="block w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-primary"
                  >
                    <option value="all">All</option>
                    <option value="Stamp">Stamp</option>
                    <option value="Notation">Notation</option>
                    <option value="Receipt">Receipt</option>
                  </select>
                </div>
              </div>

              {/* Templates Grid */}
              {loading ? (
                <div className="text-center py-12">
                  <svg className="animate-spin h-8 w-8 mx-auto text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">Loading templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No templates</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating a new template.</p>
                  <div className="mt-6">
                    <button
                      onClick={handleCreateNew}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary"
                    >
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Template
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => (
                    <div
                      key={template.template_id}
                      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {template.template_name}
                            </h3>
                            <p className="text-sm font-mono text-gray-500 mt-1">
                              {template.template_id}
                            </p>
                          </div>
                          {getStatusBadge(template.status)}
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Category:</span>
                            <span className="font-medium text-gray-900">{template.category}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Version:</span>
                            <span className="font-medium text-gray-900">{template.version}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Updated:</span>
                            <span className="font-medium text-gray-900">
                              {new Date(template.metadata.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="bg-gray-50 px-6 py-3 flex justify-between border-t border-gray-200">
                        {template.status === "inactive" && (
                          <button
                            onClick={() => handleActivateTemplate(template.template_id)}
                            className="text-sm text-green-600 hover:text-green-700 font-medium"
                          >
                            Activate
                          </button>
                        )}
                        {template.status === "active" && (
                          <button
                            onClick={() => handleDeprecateTemplate(template.template_id)}
                            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                          >
                            Deprecate
                          </button>
                        )}
                        {template.status === "deprecated" && (
                          <span className="text-sm text-gray-400">Deprecated</span>
                        )}

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleDuplicateTemplate(template.template_id)}
                            className="text-sm text-primary hover:text-primary font-medium"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.template_id)}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
          fetchTemplates(); // Refresh list after closing modal
        }}
        draftId={selectedDraftId}
      />
    </>
  );
}
