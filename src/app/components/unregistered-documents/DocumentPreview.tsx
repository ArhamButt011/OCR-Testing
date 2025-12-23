// src/app/components/unregistered-documents/DocumentPreview.tsx
"use client";

import React from "react";

interface DocumentPreviewProps {
  pdfUrl: string;
  title?: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  pdfUrl,
  title = "Document Preview",
}) => {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="aspect-[3/4] relative bg-gray-50">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Document preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 text-6xl">📄</div>
          </div>
        )}
      </div>
    </div>
  );
};