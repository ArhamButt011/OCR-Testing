"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';
import axios from 'axios';

export const Step1BasicInfo: React.FC = () => {
  const { templateData, updateTemplateData, errors, setError, clearError } = useTemplate();
  
  // Template ID validation states
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [idCheckResult, setIdCheckResult] = useState<{
    available: boolean;
    message: string;
  } | null>(null);
  const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const checkTemplateIdUniqueness = useCallback(async (templateId: string) => {
    if (!templateId || templateId.length < 3) {
      setIdCheckResult(null);
      return;
    }

    // Validate format first (uppercase, numbers, underscores only)
    const validFormat = /^[A-Z0-9_]+$/.test(templateId);
    if (!validFormat) {
      setIdCheckResult({
        available: false,
        message: 'Template ID must contain only uppercase letters, numbers, and underscores'
      });
      setError('template_id', 'Invalid format: use only uppercase letters, numbers, and underscores');
      return;
    }

    setIsCheckingId(true);
    setIdCheckResult(null);

    try {
      const response = await axios.post('/api/templates/check-id', {
        template_id: templateId,
      });

      const data = response.data;

      if (data.available) {
        setIdCheckResult({
          available: true,
          message: 'Template ID is available'
        });
        clearError('template_id');
      } else {
        // Template ID already exists - block next step
        setIdCheckResult({
          available: false,
          message: data.message || 'Template ID already exists'
        });
        setError('template_id', 'This template ID is already taken. Please choose a different ID.');
      }
    } catch (error) {
      console.error('Error checking template ID:', error);
      
      // Handle axios error
      if (axios.isAxiosError(error) && error.response) {
        const errorMessage = error.response.data?.message || 'Error checking template ID';
        setIdCheckResult({
          available: false,
          message: errorMessage
        });
        setError('template_id', errorMessage);
      } else {
        setIdCheckResult({
          available: false,
          message: 'Error checking template ID. Please try again.'
        });
        setError('template_id', 'Failed to validate template ID. Please try again.');
      }
    } finally {
      setIsCheckingId(false);
    }
  }, [setError, clearError]);

  /**
   * Debounced template ID check (500ms delay)
   */
  const handleTemplateIdChange = (value: string) => {
    const upperValue = value.toUpperCase();
    updateTemplateData({ template_id: upperValue });
    
    // Clear previous timeout
    if (checkTimeout) {
      clearTimeout(checkTimeout);
    }

    // Clear previous check result
    setIdCheckResult(null);

    // Set new timeout for API check (debounce)
    if (upperValue.length >= 3) {
      const timeout = setTimeout(() => {
        checkTemplateIdUniqueness(upperValue);
      }, 500); // 500ms debounce
      setCheckTimeout(timeout);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (checkTimeout) {
        clearTimeout(checkTimeout);
      }
    };
  }, [checkTimeout]);

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

      {/* Template ID with Uniqueness Check */}
      <div>
        <label htmlFor="template_id" className="block text-sm font-medium text-gray-700">
          Template ID *
        </label>
        <div className="relative">
          <input
            type="text"
            id="template_id"
            value={templateData.template_id || ''}
            onChange={(e) => handleTemplateIdChange(e.target.value)}
            placeholder="STAMP_FEDEX_V1"
            className={`mt-1 block w-full rounded-md border ${
              errors.template_id 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : idCheckResult?.available
                ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            } px-3 py-2 pr-10 shadow-sm focus:outline-none`}
            disabled={isCheckingId}
          />
          
          {/* Loading/Status Icon */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 mt-1">
            {isCheckingId && (
              <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {!isCheckingId && idCheckResult?.available && (
              <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {!isCheckingId && idCheckResult && !idCheckResult.available && (
              <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>

        {/* Validation Messages */}
        {errors.template_id && (
          <p className="mt-1 text-sm text-red-600">{errors.template_id}</p>
        )}
        {!errors.template_id && idCheckResult && (
          <p className={`mt-1 text-sm ${
            idCheckResult.available ? 'text-green-600' : 'text-red-600'
          }`}>
            {idCheckResult.message}
          </p>
        )}
        {!errors.template_id && !idCheckResult && (
          <p className="mt-1 text-xs text-gray-500">
            Uppercase letters, numbers, and underscores only (e.g., STAMP_FEDEX_V1)
          </p>
        )}
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
          } px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500`}
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
          } px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500`}
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
          value={templateData.version || '1.0.0'}
          onChange={(e) => handleChange('version', e.target.value)}
          placeholder="1.0.0"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc space-y-1 pl-5">
                <li>Use descriptive names: STAMP_FEDEX_V1, RECEIPT_USPS_V2</li>
                <li>Include version number for tracking changes</li>
                <li>Keep it concise but meaningful</li>
                <li>Template ID must be unique across all templates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};