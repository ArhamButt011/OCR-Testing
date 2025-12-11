
"use client";

import React, { useState } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';

export const Step3Identification: React.FC = () => {
  const { templateData, updateTemplateData, errors, setError, clearError } = useTemplate();
  const [newPattern, setNewPattern] = useState('');

  const patterns = templateData.identification?.text_patterns || [];

  const addPattern = () => {
    if (!newPattern.trim()) return;

    // Validate regex
    try {
      new RegExp(newPattern);
    } catch (e) {
      setError('text_patterns', 'Invalid regex pattern');
      return;
    }

    const updatedPatterns = [...patterns, newPattern.trim()];
    updateTemplateData({
      identification: {
        ...templateData.identification,
        text_patterns: updatedPatterns
      }
    });

    setNewPattern('');
    clearError('text_patterns');
  };

  const removePattern = (index: number) => {
    const updatedPatterns = patterns.filter((_, i) => i !== index);
    updateTemplateData({
      identification: {
        ...templateData.identification,
        text_patterns: updatedPatterns
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Document Identification</h2>
        <p className="mt-1 text-sm text-gray-600">
          Define text patterns (regex) to identify matching documents
        </p>
      </div>

      {/* Text Patterns */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Text Patterns (Regex) *
        </label>

        {/* Add Pattern Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addPattern()}
            placeholder='BILL OF LADING|Bill of Lading:\s*\d{7,9}'
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={addPattern}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary transition-colors"
          >
            Add
          </button>
        </div>

        {errors.text_patterns && (
          <p className="mt-2 text-sm text-red-600">{errors.text_patterns}</p>
        )}

        {/* Pattern List */}
        {patterns.length > 0 && (
          <div className="mt-4 space-y-2">
            {patterns.map((pattern, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-50 rounded-md px-4 py-3 border border-gray-200"
              >
                <code className="text-sm font-mono text-gray-800 flex-1 break-all">
                  {pattern}
                </code>
                <button
                  onClick={() => removePattern(index)}
                  className="ml-4 text-red-600 hover:text-red-700"
                  title="Remove pattern"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-gray-500">
          {patterns.length} pattern(s) defined • Press Enter or click Add to save
        </p>
      </div>

  
    </div>
  );
};