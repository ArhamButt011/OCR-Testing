// src/app/admin/hooks/useTemplateActions.ts
"use client";

import { useState } from 'react';
import axios from 'axios';

export const useTemplateActions = (onRefresh: () => void) => {
  const [loading, setLoading] = useState(false);

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

  const updateTemplateStatus = async (
    templateId: string, 
    status: "active" | "inactive" | "deprecated"
  ) => {
    try {
      setLoading(true);
      const userId = getUserId();

      const response = await axios.patch(`/api/templates/${templateId}/status`, {
        status,
        // user_id: userId,
      });

      return response.data;
    } catch (error) {
      console.error("Failed to update template status:", error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data?.error || "Failed to update template status");
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };


  const handleActivate = async (templateId: string) => {
    if (!confirm("Activate this template? It will be used for OCR processing.")) {
      return;
    }

    try {
      const result = await updateTemplateStatus(templateId, "active");
      console.log("result",result)
      alert(result.message || "Template activated successfully!");
      onRefresh();
    } catch (error: any) {
      if (error.message.includes("deprecated")) {
        alert(
          "Cannot reactivate deprecated templates. Please create a new version instead."
        );
      } else {
        alert(`Failed to activate template: ${error.message}`);
      }
    }
  };

 
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

  const handleDelete = async (templateId: string) => {
    if (!confirm("Delete this template? This action cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/api/templates/${templateId}`);
      
      alert("Template deleted successfully!");
      onRefresh();
    } catch (error: any) {
      console.error("Failed to delete template:", error);
      if (axios.isAxiosError(error) && error.response) {
        alert(`Failed to delete template: ${error.response.data?.error || error.message}`);
      } else {
        alert(`Failed to delete template: ${error.message}`);
      }
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