// src/app/admin/components/drafts/DraftTable.tsx
"use client";

import React from 'react';
import { Draft } from '../../drafts/page';

interface DraftTableProps {
  drafts: Draft[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  onEdit: (draftId: string) => void;
  onDelete: (draftId: string) => void;
}

export const DraftTable: React.FC<DraftTableProps> = ({
  drafts,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
}) => {

  const getCategoryBadge = (category?: string) => {
    if (!category) return <span className="text-gray-400 text-sm">Not set</span>;
    
    const styles = {
      Stamp: "bg-blue-100 text-blue-800",
      Notation: "bg-purple-100 text-purple-800",
      Receipt: "bg-green-100 text-green-800",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          (styles as any)[category] || "bg-gray-100 text-gray-800"
        }`}
      >
        {category}
      </span>
    );
  };

  const getProgressBadge = (stepNumber: number) => {
    const totalSteps = 7;
    const percentage = ((stepNumber / totalSteps) * 100).toFixed(0);
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-gray-600 font-medium whitespace-nowrap">{stepNumber}/7</span>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="w-full overflow-x-auto grid grid-cols-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Template ID - Sortable */}
              <th
                onClick={() => onSort('partial_data.template_id')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Template ID
                  {renderSortIcon('partial_data.template_id')}
                </div>
              </th>

              {/* Name - Sortable */}
              <th
                onClick={() => onSort('partial_data.template_name')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Name
                  {renderSortIcon('partial_data.template_name')}
                </div>
              </th>

              {/* Category - Sortable */}
              <th
                onClick={() => onSort('partial_data.category')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Category
                  {renderSortIcon('partial_data.category')}
                </div>
              </th>

              {/* Progress - Sortable */}
              <th
                onClick={() => onSort('step_number')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Progress
                  {renderSortIcon('step_number')}
                </div>
              </th>

              {/* Last Saved - Sortable */}
              <th
                onClick={() => onSort('metadata.last_saved_at')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Last Saved
                  {renderSortIcon('metadata.last_saved_at')}
                </div>
              </th>

              {/* Expires - Sortable */}
              <th
                onClick={() => onSort('metadata.expires_at')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Expires
                  {renderSortIcon('metadata.expires_at')}
                </div>
              </th>

              {/* Actions - Not sortable */}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {drafts.map((draft) => (
              <tr key={draft._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                  {draft.partial_data.template_id || (
                    <span className="text-gray-400">Not set</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {draft.partial_data.template_name || (
                    <span className="text-gray-400">Untitled Draft</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {getCategoryBadge(draft.partial_data.category)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getProgressBadge(draft.step_number)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(draft.metadata.last_saved_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(draft.metadata.expires_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-3">
                    {/* Edit Button */}
                    <button
                      onClick={() => onEdit(draft._id)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                      title="Continue editing draft"
                    >
                      Edit
                    </button>
                    
                    {/* Delete button */}
                    <button
                      onClick={() => onDelete(draft._id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                      title="Delete draft"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};