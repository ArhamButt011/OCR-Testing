// src/app/admin/components/common/EmptyState.tsx
"use client";

import React from "react";

interface EmptyStateProps {
  /**
   * Icon type to display
   */
  icon?: "document" | "folder" | "search" | "inbox" | "template" | "database" | "custom";
  
  /**
   * Custom icon component (when icon="custom")
   */
  customIcon?: React.ReactNode;
  
  /**
   * Main title/heading
   */
  title: string;
  
  /**
   * Description text
   */
  description?: string;
  
  /**
   * Primary action button
   */
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  
  /**
   * Secondary action button
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  
  /**
   * Show background container
   */
  showContainer?: boolean;
  
  /**
   * Full height mode
   */
  fullHeight?: boolean;
}

const iconComponents = {
  document: (
    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  folder: (
    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  search: (
    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  inbox: (
    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  template: (
    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  database: (
    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "document",
  customIcon,
  title,
  description,
  action,
  secondaryAction,
  showContainer = true,
  fullHeight = false,
}) => {
  const content = (
    <div className={`text-center ${fullHeight ? "min-h-[400px] flex items-center justify-center" : "py-12"}`}>
      <div>
        {/* Icon */}
        {icon === "custom" ? customIcon : iconComponents[icon]}

        {/* Title */}
        <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>

        {/* Description */}
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}

        {/* Actions */}
        {(action || secondaryAction) && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {action && (
              <button
                onClick={action.onClick}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </button>
            )}
            
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (showContainer) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-12">
        {content}
      </div>
    );
  }

  return content;
};

// Export with display name
EmptyState.displayName = "EmptyState";