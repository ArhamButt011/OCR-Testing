// src/app/hooks/useTemplateActions.ts
"use client";

import { useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { toast } from "react-toastify";

type ActionCallback = (
  templateId: string,
  action: 'activate' | 'deactivate' | 'deprecate' | 'delete',
  data?: any
) => void;

export const useTemplateActions = (onActionComplete: ActionCallback) => {
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

      const response = await axios.patch(
        `/api/templates/${templateId}/status`,
        {
          status,
          // user_id: userId,
        }
      );

      return response.data;
    } catch (error) {
      console.error("Failed to update template status:", error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          error.response.data?.error || "Failed to update template status"
        );
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (templateId: string) => {
    const result = await Swal.fire({
      title: "Activate Template",
      text: "Activate this template? It will be used for OCR processing.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#F0F1F3",
      cancelButtonText: "Cancel",
      confirmButtonText: "Yes, Activate",
    });
    
    if (!result.isConfirmed) return;

    try {
      const response = await updateTemplateStatus(templateId, "active");
      toast.success(response.message || "Template activated successfully!");
      
      // Update local state
      onActionComplete(templateId, 'activate', { status: 'active' });
    } catch (error: any) {
      if (error.message.includes("deprecated")) {
        toast.error(
          "Cannot reactivate deprecated templates. Please create a new version instead."
        );
      } else {
        toast.error(`Failed to activate template: ${error.message}`);
      }
    }
  };

  const handleDeactivate = async (templateId: string) => {
    const result = await Swal.fire({
      title: "Deactivate Template",
      text: "Deactivate this template? It will no longer be used for OCR processing.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#F0F1F3",
      cancelButtonText: "Cancel",
      confirmButtonText: "Yes, Deactivate",
    });
    
    if (!result.isConfirmed) return;

    try {
      const response = await updateTemplateStatus(templateId, "inactive");
      toast.success(response.message || "Template deactivated successfully!");
      
      // Update local state
      onActionComplete(templateId, 'deactivate', { status: 'inactive' });
    } catch (error: any) {
      toast.error(`Failed to deactivate template: ${error.message}`);
    }
  };

  const handleDeprecate = async (templateId: string) => {
    const result = await Swal.fire({
      title: "Deprecate Template",
      text: "Deprecate this template? This action cannot be undone. The template will no longer be used for OCR processing and cannot be reactivated.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#F0F1F3",
      cancelButtonText: "Cancel",
      confirmButtonText: "Yes, Deprecate",
    });
    
    if (!result.isConfirmed) return;

    try {
      const response = await updateTemplateStatus(templateId, "deprecated");
      toast.success(response.message || "Template deprecated successfully!");
      
      // Update local state
      onActionComplete(templateId, 'deprecate', { status: 'deprecated' });
    } catch (error: any) {
      toast.error(`Failed to deprecate template: ${error.message}`);
    }
  };

  const handleDelete = async (templateId: string) => {
    const result = await Swal.fire({
      title: "Delete Template",
      text: "Delete this template? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#F0F1F3",
      cancelButtonText: "Cancel",
      confirmButtonText: "Delete",
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      await axios.delete(`/api/templates/${templateId}`);

      toast.success("Template deleted successfully!");
      
      // Update local state
      onActionComplete(templateId, 'delete');
    } catch (error: any) {
      console.error("Failed to delete template:", error);
      if (axios.isAxiosError(error) && error.response) {
        toast.error(
          `Failed to delete template: ${
            error.response.data?.error || error.message
          }`
        );
      } else {
        toast.error(`Failed to delete template: ${error.message}`);
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