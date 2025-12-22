// src/app/admin/components/templates/TemplateTestModal.tsx
"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Template } from "./TemplateTable";
import { PDFViewer } from "./PDFViewer";
import { TestResults } from "./TestResults";
import { FileUpload } from "./Fileupload";
import axios from "axios";
import { useApiConfig } from "@/app/context/ApiConfigContext";
import { toast } from "react-toastify";

interface TemplateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
}

interface TestResponse {
  success: boolean;
  extracted_data: {
    B_L_Number: string;
    Stamp_Exists: string;
    Seal_Intact: string;
    POD_Date: string;
    Signature_Exists: string;
    Issued_Qty: number;
    Received_Qty: number;
    Damage_Qty: string;
    Short_Qty: string;
    Over_Qty: string;
    Refused_Qty: string;
    Customer_Order_Num: string;
    template_id: string;
    confidence: number;
    processing_time: number;
    classification_details: {
      primary_model_prediction: string;
      primary_confidence: number;
      secondary_model_prediction: string | null;
      secondary_confidence: number | null;
    };
    suggested_templates: string[];
  };
  error: string | null;
  processing_time: number;
  regions_metadata: Array<{
    region_name: string;
    bbox: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };
    confidence: number;
  }>;
}

export const TemplateTestModal: React.FC<TemplateTestModalProps> = ({
  isOpen,
  onClose,
  template,
}) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { testTemplateApiUrl } = useApiConfig();

  if (!isOpen || !template) return null;
  if (typeof document === "undefined") return null;

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setTestResults(null);
    setIsUploading(true);

    try {
      // Create FormData to upload the file
      const formData = new FormData();
      formData.append("file", file);

      // Upload file to the server
      const uploadResponse = await axios.post("/api/templates/test/upload-file", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (uploadResponse.data.success) {
        setUploadedFileName(uploadResponse.data.filename);
        toast.success("File uploaded successfully!");
      } else {
        throw new Error(uploadResponse.data.error || "Failed to upload file");
      }
    } catch (error: any) {
      console.error("File upload error:", error);
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Failed to upload file. Please try again."
      );
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTest = async () => {
    if (!uploadedFile || !uploadedFileName) {
      toast.error("No file uploaded");
      return;
    }

    setIsLoading(true);

    try {
      // Construct the publicly accessible file URL
      const baseUrl = window.location.origin;
      const fileUrl = `${baseUrl}/api/access-file?filename=${uploadedFileName}`;

      console.log("Testing with file URL:", fileUrl);

      const response = await axios.post<TestResponse>(testTemplateApiUrl, {
        template: template,
        file_url: fileUrl,
      });

      console.log("Test response:", response.data);

      // Check if the response indicates success
      if (response.data.success) {
        setTestResults(response.data);
        toast.success("Template test completed successfully!");
      } else if (response.data.error) {
        // Handle error from the API
        toast.error(`Test failed: ${response.data.error}`);
        console.error("Test error:", response.data.error);
      } else {
        setTestResults(response.data);
      }
    } catch (error: any) {
      console.error("Template test error:", error);

      // Handle different types of errors
      if (error.response) {
        // Server responded with error status
        const errorMessage =
          error.response.data?.error ||
          error.response.data?.message ||
          `Server error: ${error.response.status}`;
        toast.error(errorMessage);
      } else if (error.request) {
        // Request was made but no response received
        toast.error("No response from server. Please check your connection.");
      } else {
        // Something else happened
        toast.error(error.message || "Failed to test template");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setUploadedFile(null);
    setUploadedFileName(null);
    setTestResults(null);
    onClose();
  };

  const handleTestAnother = () => {
    setUploadedFile(null);
    setUploadedFileName(null);
    setTestResults(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-[95vw] h-[90vh] rounded-2xl shadow-lg relative flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Test Template</h2>
            <p className="text-sm text-gray-600 mt-1">
              {template.template_name} ({template.template_id})
            </p>
          </div>

          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none transition-colors"
            aria-label="Close modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!uploadedFile && (
            <FileUpload onFileUpload={handleFileUpload} />
          )}

          {isUploading && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center">
                <svg
                  className="animate-spin h-12 w-12 text-primary mx-auto mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="text-lg font-medium text-gray-900">Uploading file...</p>
              </div>
            </div>
          )}

          {uploadedFile && !isUploading && !testResults && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center">
                <div className="mb-4">
                  <svg
                    className="h-16 w-16 text-green-500 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-lg font-medium text-gray-900">
                    File uploaded: {uploadedFile.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </div>
                <button
                  onClick={handleTest}
                  disabled={isLoading}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Testing...
                    </>
                  ) : (
                    "Run Test"
                  )}
                </button>
              </div>
            </div>
          )}

          {testResults && testResults.success && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {/* PDF Viewer with Bounding Boxes */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <PDFViewer
                  file={uploadedFile!}
                  regions={testResults.regions_metadata}
                />
              </div>

              {/* Test Results */}
              <div className="overflow-y-auto">
                <TestResults results={testResults} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {testResults && (
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleTestAnother}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              Test Another Document
            </button>

            <button
              onClick={handleClose}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};