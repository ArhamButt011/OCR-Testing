"use client";

import React from 'react';
import { useTemplate } from '@/app/context/TemplateContext';

export const Step1BasicInfo: React.FC = () => {
  const { templateData, updateTemplateData, errors, clearError } = useTemplate();

  const handleChange = (field: string, value: string) => {
    updateTemplateData({ [field]: value });
    clearError(field);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter the basic details for your OCR template
        </p>
      </div>

      {/* Template ID */}
      <div>
        <label htmlFor="template_id" className="block text-sm font-medium text-gray-700">
          Template ID *
        </label>
        <input
          type="text"
          id="template_id"
          value={templateData.template_id || ''}
          onChange={(e) => handleChange('template_id', e.target.value.toUpperCase())}
          placeholder="STAMP_FEDEX_V1"
          className={`mt-1 block w-full rounded-md border ${
            errors.template_id ? 'border-red-300' : 'border-gray-300'
          } px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary`}
        />
        {errors.template_id && (
          <p className="mt-1 text-sm text-red-600">{errors.template_id}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Uppercase letters, numbers, and underscores only (e.g., STAMP_FEDEX_V1)
        </p>
      </div>

      {/* Template Name */}
      <div>
        <label htmlFor="template_name" className="block text-sm font-medium text-gray-700">
          Template Name *
        </label>
        <input
          type="text"
          id="template_name"
          value={templateData.template_name || ''}
          onChange={(e) => handleChange('template_name', e.target.value)}
          placeholder="FedEx POD Stamp"
          className={`mt-1 block w-full rounded-md border ${
            errors.template_name ? 'border-red-300' : 'border-gray-300'
          } px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary`}
        />
        {errors.template_name && (
          <p className="mt-1 text-sm text-red-600">{errors.template_name}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Human-readable name for this template
        </p>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">
          Category *
        </label>
        <select
          id="category"
          value={templateData.category || 'Stamp'}
          onChange={(e) => handleChange('category', e.target.value)}
          className={`mt-1 block w-full rounded-md border ${
            errors.category ? 'border-red-300' : 'border-gray-300'
          } px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary`}
        >
          <option value="Stamp">Stamp</option>
          <option value="Notation">Notation</option>
          <option value="Receipt">Receipt</option>
        </select>
        {errors.category && (
          <p className="mt-1 text-sm text-red-600">{errors.category}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Document type category
        </p>
      </div>

      {/* Version */}
      <div>
        <label htmlFor="version" className="block text-sm font-medium text-gray-700">
          Version
        </label>
        <input
          type="text"
          id="version"
          value={templateData.version || ''}
          onChange={(e) => handleChange('version', e.target.value)}
          placeholder="1.0.0"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
        />
        <p className="mt-1 text-xs text-gray-500">
          Semantic versioning (e.g., 1.0.0)
        </p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={4}
          value={templateData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Template for FedEx Bill of Lading documents with receiving stamp area..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional description of this template
        </p>
      </div>

      {/* Info Box */}
      <div className="rounded-md bg-blue-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">
              Template ID Best Practices
            </h3>
            <div className="mt-2 text-sm text-primary">
              <ul className="list-disc space-y-1 pl-5">
                <li>Use descriptive names: STAMP_FEDEX_V1, RECEIPT_USPS_V2</li>
                <li>Include version number for tracking changes</li>
                <li>Keep it concise but meaningful</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};