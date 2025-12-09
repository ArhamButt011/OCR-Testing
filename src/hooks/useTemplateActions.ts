// src/app/admin/hooks/useTemplateActions.ts
"use client";

import { useState } from 'react';

export const useTemplateActions = (onRefresh: () => void) => {
  const [loading, setLoading] = useState(false);

  /**
   * Get user ID from JWT token
   */
  const getUserId = (): string => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return "unknown";

      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const decoded = JSON.parse(jsonPayload);
      return decoded.userId || decoded.user_id || decoded.id || "unknown";
    } catch (error) {
      console.error("Failed to decode token:", error);
      return "unknown";
    }
  };

  /**
   * Update template status using your API endpoint
   * PATCH /api/templates/{id}/status
   * Body: { status: "active" | "inactive" | "deprecated", user_id: string }
   */
  const updateTemplateStatus = async (
    templateId: string, 
    status: "active" | "inactive" | "deprecated"
  ) => {
    try {
      setLoading(true);
      const userId = getUserId();

      const response = await fetch(`/api/templates/${templateId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          status,
          user_id: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update template status");
      }

      return data;
    } catch (error) {
      console.error("Failed to update template status:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Activate a template (set status to "active")
   */
  const handleActivate = async (templateId: string) => {
    if (!confirm("Activate this template? It will be used for OCR processing.")) {
      return;
    }

    try {
      const result = await updateTemplateStatus(templateId, "active");
      alert(result.message || "Template activated successfully!");
      onRefresh();
    } catch (error: any) {
      // Handle specific error for deprecated templates
      if (error.message.includes("deprecated")) {
        alert(
          "Cannot reactivate deprecated templates. Please create a new version instead."
        );
      } else {
        alert(`Failed to activate template: ${error.message}`);
      }
    }
  };

  /**
   * Deactivate a template (set status to "inactive")
   */
  const handleDeactivate = async (templateId: string) => {
    if (!confirm("Deactivate this template? It will no longer be used for OCR processing.")) {
      return;
    }

    try {
      const result = await updateTemplateStatus(templateId, "inactive");
      alert(result.message || "Template deactivated successfully!");
      onRefresh();
    } catch (error: any) {
      alert(`Failed to deactivate template: ${error.message}`);
    }
  };

  /**
   * Deprecate a template (set status to "deprecated")
   * Note: Deprecated templates cannot be reactivated
   */
  const handleDeprecate = async (templateId: string) => {
    if (!confirm(
      "Deprecate this template? This action cannot be undone. The template will no longer be used for OCR processing and cannot be reactivated."
    )) {
      return;
    }

    try {
      const result = await updateTemplateStatus(templateId, "deprecated");
      alert(result.message || "Template deprecated successfully!");
      onRefresh();
    } catch (error: any) {
      alert(`Failed to deprecate template: ${error.message}`);
    }
  };

  /**
   * Delete a template
   */
  const handleDelete = async (templateId: string) => {
    if (!confirm("Delete this template? This action cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete template");
      }

      alert("Template deleted successfully!");
      onRefresh();
    } catch (error: any) {
      console.error("Failed to delete template:", error);
      alert(`Failed to delete template: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    handleActivate,
    handleDeactivate,
    handleDeprecate,
    handleDelete,
    updateTemplateStatus,
  };
};