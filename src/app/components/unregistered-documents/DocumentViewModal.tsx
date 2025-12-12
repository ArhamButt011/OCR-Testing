// src/app/admin/components/unregistered/DocumentViewModal.tsx
"use client";

import React from "react";
import { createPortal } from "react-dom";

interface DocumentViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
}

export const DocumentViewModal: React.FC<DocumentViewModalProps> = ({
  isOpen,
  onClose,
  pdfUrl
}) => {
  if (!isOpen) return null;

  // Guard for SSR safety
  if (typeof document === "undefined") return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Document Preview
            </h2>
            <p className="text-sm text-gray-600 mt-1 truncate max-w-md">
              {pdfUrl?.split("/").pop() || "Document"}
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          {pdfUrl ? (
            <iframe
              src={`/api/access-file?filename=${encodeURIComponent(pdfUrl)}`}
              className="w-full h-full min-h-[70vh] border-0 rounded"
              title="PDF Document"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No document available</h3>
                <p className="mt-1 text-sm text-gray-500">The document URL is missing or invalid.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};