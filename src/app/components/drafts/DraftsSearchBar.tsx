// src/app/admin/components/drafts/DraftSearchBar.tsx
"use client";

import React from 'react';

interface DraftSearchBarProps {
  searchQuery: string;
  sortBy: string;
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
  handleSort: (sortBy: string) => void;
}

export const DraftSearchBar: React.FC<DraftSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  handleSort,
  sortBy,
  onClearFilters,
}) => {

  const hasActiveFilters = searchQuery || sortBy !== 'metadata.last_saved_at';

  return (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by template ID or name..."
              className="block w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-primary"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-primary"
          >
            <option value="metadata.last_saved_at">Last Saved</option>
            <option value="metadata.created_at">Date Created</option>
            <option value="step_number">Progress (Step)</option>
            <option value="partial_data.template_id">Template ID</option>
            <option value="partial_data.template_name">Template Name</option>
          </select>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Active filters:</span>
          
          {searchQuery && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-primary">
              Search: "{searchQuery}"
              <button
                onClick={() => onSearchChange('')}
                className="ml-1 text-primary hover:text-primary"
              >
                ×
              </button>
            </span>
          )}

          {sortBy !== 'metadata.last_saved_at' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-primary">
              Sort By: {sortBy}
              <button
                onClick={() => handleSort('metadata.last_saved_at')}
                className="ml-1 text-primary hover:text-primary"
              >
                ×
              </button>
            </span>
          )}
          
          <button
            onClick={onClearFilters}
            className="text-xs text-gray-600 hover:text-gray-800 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};