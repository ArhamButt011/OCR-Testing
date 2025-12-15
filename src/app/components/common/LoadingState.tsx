// src/app/admin/components/common/LoadingState.tsx
"use client";

import React from "react";

interface LoadingStateProps {
  /**
   * Type of loading animation
   * - 'spinner': Centered spinning loader
   * - 'skeleton-table': Table skeleton with rows
   * - 'skeleton-cards': Card grid skeleton
   * - 'skeleton-list': List skeleton
   */
  type?: "spinner" | "skeleton-table" | "skeleton-cards" | "skeleton-list";
  
  /**
   * Number of skeleton rows/cards to show
   */
  rows?: number;
  
  /**
   * Custom message to display
   */
  message?: string;
  
  /**
   * Full height mode (centers content vertically)
   */
  fullHeight?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = "spinner",
  rows = 5,
  message = "Loading...",
  fullHeight = false,
}) => {
  // Spinner Loading
  if (type === "spinner") {
    return (
      <div className={`flex flex-col items-center justify-center ${fullHeight ? "min-h-[400px]" : "py-12"}`}>
        <div className="relative">
          <div className="w-12 h-12 border-4 border-gray-200 rounded-full"></div>
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
        {message && (
          <p className="mt-4 text-sm text-gray-600">{message}</p>
        )}
      </div>
    );
  }

  // Skeleton Table Loading
  if (type === "skeleton-table") {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="animate-pulse">
          {/* Table Header */}
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-28"></div>
            <div className="h-4 bg-gray-200 rounded flex-1"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>

          {/* Table Rows */}
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4 border-b border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-6 bg-gray-200 rounded w-16"></div>
              <div className="h-8 bg-gray-200 rounded flex-1"></div>
              <div className="flex gap-2">
                <div className="h-8 bg-gray-200 rounded w-16"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Skeleton Cards Loading
  if (type === "skeleton-cards") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-4/6 mb-4"></div>
              <div className="flex gap-2 mt-4">
                <div className="h-8 bg-gray-200 rounded w-20"></div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Skeleton List Loading
  if (type === "skeleton-list") {
    return (
      <div className="space-y-4">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

// Export with display name
LoadingState.displayName = "LoadingState";