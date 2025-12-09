"use client";

import React, { useState } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';

export const Step5Prompts: React.FC = () => {
  const { templateData, updateTemplateData } = useTemplate();
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  
  const regions = ['stamp', 'bill_of_lading', 'customer_order_info', 'signatures'];
  const prompts = templateData.prompts || {};

  const updatePrompt = (region: string, field: string, value: any) => {
    updateTemplateData({
      prompts: {
        ...prompts,
        [region]: {
          ...prompts[region],
          [field]: value
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Region Prompts</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure VLM prompts for each detected region
        </p>
      </div>

      {/* Region Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Region
        </label>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        >
          <option value="">-- Select a region --</option>
          {regions.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
      </div>

      {/* Prompt Editor */}
      {selectedRegion && (
        <div className="rounded-lg border border-gray-300 p-6 space-y-6">
          <h3 className="text-lg font-medium text-gray-900">
            Configure {selectedRegion} Prompt
          </h3>

          {/* Prompt Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt Text *
            </label>
            <textarea
              rows={10}
              value={prompts[selectedRegion]?.prompt_text || ''}
              onChange={(e) => updatePrompt(selectedRegion, 'prompt_text', e.target.value)}
              placeholder={`Extract data from ${selectedRegion}...

Fields to extract:
- field1: description
- field2: description

Output JSON only.`}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Expected Output Schema */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Output Schema (JSON)
            </label>
            <textarea
              rows={6}
              value={JSON.stringify(prompts[selectedRegion]?.expected_output_schema || {}, null, 2)}
              onChange={(e) => {
                try {
                  const schema = JSON.parse(e.target.value);
                  updatePrompt(selectedRegion, 'expected_output_schema', schema);
                } catch {}
              }}
              placeholder={`{
  "field1": "string",
  "field2": "integer"
}`}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Configured Regions List */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Configured Regions ({Object.keys(prompts).length})
        </h3>
        <div className="space-y-2">
          {Object.keys(prompts).map(region => (
            <div
              key={region}
              className="flex items-center justify-between bg-gray-50 rounded-md px-4 py-3 border border-gray-200"
            >
              <span className="text-sm font-medium text-gray-900">{region}</span>
              <button
                onClick={() => setSelectedRegion(region)}
                className="text-sm text-primary hover:text-primary"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};