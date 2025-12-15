// src/app/admin/components/drafts/DraftEmptyState.tsx
"use client";

import React from 'react';
import Link from 'next/link';

interface DraftEmptyStateProps {
  hasFilters: string | boolean;
}

export const DraftEmptyState: React.FC<DraftEmptyStateProps> = ({
  hasFilters,
}) => {
  return (
    <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">No drafts found</h3>
      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? 'Try adjusting your search filters'
          : 'You have no saved drafts. Start creating a new template to save a draft.'}
      </p>
      {!hasFilters && (
        <div className="mt-6">
          <Link
            href="/templates"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Go to Templates
          </Link>
        </div>
      )}
    </div>
  );
};

