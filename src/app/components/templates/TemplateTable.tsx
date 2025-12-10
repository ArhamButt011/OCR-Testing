// src/app/admin/components/templates/TemplateTable.tsx
"use client";

import React from 'react';

export interface Template {
  template_id: string;
  template_name: string;
  category: string;
  status: "active" | "inactive" | "deprecated";
  version: string;
  metadata: {
    created_at: string;
    updated_at: string;
    usage_count?: number;
    success_rate?: number;
  };
}

export type SortField = 'template_id' | 'template_name' | 'category' | 'status' | 'documents_processed' | 'accuracy_rate';
export type SortDirection = 'asc' | 'desc';

interface TemplateTableProps {
  templates: Template[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onActivate: (templateId: string) => void;
  onDeactivate: (templateId: string) => void;
  onDeprecate: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onEdit: (templateId: string) => void; // NEW
}

export const TemplateTable: React.FC<TemplateTableProps> = ({
  templates,
  sortField,
  sortDirection,
  onSort,
  onActivate,
  onDeactivate,
  onDeprecate,
  onDelete,
  onEdit, // NEW
}) => {
  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      deprecated: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          (styles as any)[status]
        }`}
      >
        {status}
      </span>
    );
  };

  const renderSortIcon = (field: SortField) => {
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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Template ID - Sortable */}
              <th
                onClick={() => onSort('template_id')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Template ID
                  {renderSortIcon('template_id')}
                </div>
              </th>

              {/* Name - Sortable */}
              <th
                onClick={() => onSort('template_name')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Name
                  {renderSortIcon('template_name')}
                </div>
              </th>

              {/* Category - Sortable */}
              <th
                onClick={() => onSort('category')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Category
                  {renderSortIcon('category')}
                </div>
              </th>

              {/* Status - Sortable */}
              <th
                onClick={() => onSort('status')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Status
                  {renderSortIcon('status')}
                </div>
              </th>

              {/* Documents Processed - Sortable */}
              <th
                onClick={() => onSort('documents_processed')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Documents Processed
                  {renderSortIcon('documents_processed')}
                </div>
              </th>

              {/* Accuracy Rate - Sortable */}
              <th
                onClick={() => onSort('accuracy_rate')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Accuracy Rate
                  {renderSortIcon('accuracy_rate')}
                </div>
              </th>

              {/* Actions - Not sortable */}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {templates.map((template) => (
              <tr key={template.template_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                  {template.template_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {template.template_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {template.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(template.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {template.metadata.usage_count?.toLocaleString() || '0'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {template.metadata.success_rate !== undefined
                    ? `${(template.metadata.success_rate * 100).toFixed(1)}%`
                    : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-3">
                    {/* NEW: Edit Button - Always visible */}
                    <button
                      onClick={() => onEdit(template.template_id)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                      title="Edit template"
                    >
                      Edit
                    </button>
                    
                    {/* FR-013 AC-013-3: Quick Actions */}
                    
                    {/* Inactive templates: Show Activate */}
                    {template.status === 'inactive' && (
                      <button
                        onClick={() => onActivate(template.template_id)}
                        className="text-green-600 hover:text-green-900 font-medium"
                        title="Activate template"
                      >
                        Activate
                      </button>
                    )}
                    
                    {/* Active templates: Show Deactivate and Deprecate */}
                    {template.status === 'active' && (
                      <>
                        <button
                          onClick={() => onDeactivate(template.template_id)}
                          className="text-orange-600 hover:text-orange-900 font-medium"
                          title="Deactivate template"
                        >
                          Deactivate
                        </button>
                        <button
                          onClick={() => onDeprecate(template.template_id)}
                          className="text-red-600 hover:text-red-900 font-medium"
                          title="Deprecate template (cannot be reactivated)"
                        >
                          Deprecate
                        </button>
                      </>
                    )}
                    
                    {/* Deprecated templates: Show warning and Reactivate (will fail with message) */}
                    {template.status === 'deprecated' && (
                      <>
                        <button
                          onClick={() => onActivate(template.template_id)}
                          className="text-gray-400 hover:text-gray-600 font-medium"
                          title="Cannot reactivate deprecated templates"
                        >
                          Reactivate
                        </button>
                        <span className="text-xs text-gray-500 italic">
                          (Create new version)
                        </span>
                      </>
                    )}
                    
                    {/* Delete button for all templates */}
                    <button
                      onClick={() => onDelete(template.template_id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                      title="Delete template"
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