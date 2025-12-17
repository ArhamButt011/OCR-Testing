// src/app/admin/components/unregistered/BulkActionsBar.tsx
"use client";

import React from "react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onClearSelection
}) => {
  return (
    <div className="bg-primary text-white rounded-lg shadow-lg p-4 mb-6 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-semibold">
            {selectedCount} document{selectedCount !== 1 ? "s" : ""} selected
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onClearSelection}
            className="px-4 py-2 bg-white text-primary rounded-md hover:bg-gray-100 transition font-medium"
          >
            Clear Selection
          </button>
        </div>
      </div>
    </div>
  );
};