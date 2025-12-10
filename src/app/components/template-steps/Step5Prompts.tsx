"use client";

import React, { useState } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';

export const Step5Prompts: React.FC = () => {
  const { templateData, updateTemplateData, errors, setErrors } = useTemplate();
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [schemaText, setSchemaText] = useState<string>('');
  const [schemaError, setSchemaError] = useState<string>('');
  
  // Get regions from region_config
  const regions = React.useMemo(() => {
    const regionSet = new Set<string>();
    
    // Add regions from YOLO classes
    if (templateData.region_config?.yolo_config?.classes) {
      templateData.region_config.yolo_config.classes.forEach(cls => {
        regionSet.add(cls.region_name);
      });
    }
    
    // Add regions from coordinate_regions
    if (templateData.region_config?.coordinate_regions) {
      templateData.region_config.coordinate_regions.forEach(region => {
        regionSet.add(region.region_name);
      });
    }
    
    return Array.from(regionSet); 
  }, [templateData.region_config]);

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

  // Load schema when region is selected
  React.useEffect(() => {
    if (selectedRegion && prompts[selectedRegion]?.expected_output_schema) {
      setSchemaText(JSON.stringify(prompts[selectedRegion].expected_output_schema, null, 2));
      setSchemaError('');
    } else if (selectedRegion) {
      setSchemaText('{\n  \n}');
      setSchemaError('');
    }
  }, [selectedRegion, prompts]);

  // Validate and save JSON schema
  const handleSchemaChange = (value: string) => {
    setSchemaText(value);
    
    // Try to parse JSON
    try {
      const parsed = JSON.parse(value);
      setSchemaError('');
      updatePrompt(selectedRegion, 'expected_output_schema', parsed);
      
      // Clear any previous schema errors for this region
      if (errors.prompts?.[selectedRegion]?.schema) {
        const newErrors = { ...errors };
        if (newErrors.prompts?.[selectedRegion]) {
          delete newErrors.prompts[selectedRegion].schema;
        }
        setErrors(newErrors);
      }
    } catch (e: any) {
      const errorMsg = `Invalid JSON: ${e.message}`;
      setSchemaError(errorMsg);
      
      // Set error in context to block navigation
      setErrors({
        ...errors,
        prompts: {
          ...errors.prompts,
          [selectedRegion]: {
            ...errors.prompts?.[selectedRegion],
            schema: errorMsg
          }
        }
      });
    }
  };

  // Validate that selected region has both prompt_text and valid schema
  const validateCurrentRegion = () => {
    if (!selectedRegion) return true;
    
    const currentPrompt = prompts[selectedRegion];
    const errors: string[] = [];
    
    if (!currentPrompt?.prompt_text || currentPrompt.prompt_text.trim() === '') {
      errors.push('Prompt text is required');
    }
    
    if (!currentPrompt?.expected_output_schema || Object.keys(currentPrompt.expected_output_schema).length === 0) {
      errors.push('Expected output schema is required');
    }
    
    if (schemaError) {
      errors.push(schemaError);
    }
    
    return errors.length === 0;
  };

  // Delete region prompt
  const deletePrompt = (region: string) => {
    const newPrompts = { ...prompts };
    delete newPrompts[region];
    updateTemplateData({ prompts: newPrompts });
    
    if (selectedRegion === region) {
      setSelectedRegion('');
      setSchemaText('');
    }
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
          Select Region *
        </label>
        {regions.length === 0 ? (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  No regions configured. Please configure regions in Step 4 first.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Select a region --</option>
            {regions.map(region => (
              <option key={region} value={region}>
                {region} {prompts[region] ? '✓' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Prompt Editor */}
      {selectedRegion && (
        <div className="rounded-lg border-2 border-gray-300 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Configure "{selectedRegion}" Prompt
            </h3>
            {!validateCurrentRegion() && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Incomplete
              </span>
            )}
          </div>

          {/* Prompt Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt Text *
            </label>
            <textarea
              rows={10}
              value={prompts[selectedRegion]?.prompt_text || ''}
              onChange={(e) => updatePrompt(selectedRegion, 'prompt_text', e.target.value)}
              placeholder={`Extract data from the ${selectedRegion} region...

Fields to extract:
- field1: description
- field2: description

Output ONLY valid JSON matching the schema below.`}
              className={`block w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 ${
                !prompts[selectedRegion]?.prompt_text 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            {!prompts[selectedRegion]?.prompt_text && (
              <p className="mt-1 text-sm text-red-600">Prompt text is required</p>
            )}
          </div>

          {/* Expected Output Schema - NOW EDITABLE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Output Schema (JSON) *
            </label>
            <textarea
              rows={12}
              value={schemaText}
              onChange={(e) => handleSchemaChange(e.target.value)}
              placeholder={`{
  "stamp_exist": "yes | no",
  "seal_intact": "yes | no | empty | null",
  "pod_date": "<string> | empty | null",
  "pod_sign": "yes | no | empty | null",
  "total_received": "<integer> | empty | null",
  "damage": "<integer> | empty | null",
  "short": "<integer> | empty | null",
  "over": "<integer> | empty | null",
  "refused": "<integer> | empty | null",
  "roc_damaged": "<integer> | empty | null",
  "damaged_kept": "<integer> | empty | null",
  "notation_exist": "<integer> | empty | null"
}`}
              className={`block w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 ${
                schemaError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            
            {/* JSON Validation Feedback */}
            {schemaError ? (
              <div className="mt-2 flex items-start">
                <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="ml-2 text-sm text-red-600">{schemaError}</p>
              </div>
            ) : prompts[selectedRegion]?.expected_output_schema ? (
              <div className="mt-2 flex items-start">
                <svg className="h-5 w-5 text-green-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="ml-2 text-sm text-green-600">Valid JSON schema</p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-red-600">Expected output schema is required</p>
            )}

            {/* Helper Text */}
            <p className="mt-2 text-xs text-gray-500">
              Define the exact JSON structure that the VLM should output for this region.
              Use format: <code className="bg-gray-100 px-1 py-0.5 rounded">{"field_name"}: {"type"} | empty | null</code>
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                if (confirm(`Delete prompt configuration for "${selectedRegion}"?`)) {
                  deletePrompt(selectedRegion);
                }
              }}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50"
            >
              <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Prompt
            </button>

            <div className="flex items-center gap-2">
              {validateCurrentRegion() ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                  <svg className="h-3.5 w-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Configuration Complete
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  <svg className="h-3.5 w-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Incomplete
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Configured Regions List */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Configured Regions ({Object.keys(prompts).length} / {regions.length})
        </h3>
        
        {Object.keys(prompts).length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No prompts configured yet</p>
            <p className="text-xs text-gray-400">Select a region above to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.keys(prompts).map(region => {
              const isValid = prompts[region]?.prompt_text && 
                            prompts[region]?.expected_output_schema && 
                            Object.keys(prompts[region].expected_output_schema).length > 0;
              
              return (
                <div
                  key={region}
                  className={`flex items-center justify-between rounded-md px-4 py-3 border-2 transition-colors ${
                    selectedRegion === region
                      ? 'border-blue-500 bg-blue-50'
                      : isValid
                      ? 'border-green-200 bg-green-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isValid ? (
                      <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="text-sm font-medium text-gray-900">{region}</span>
                    <span className="text-xs text-gray-500">
                      {Object.keys(prompts[region]?.expected_output_schema || {}).length} fields
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedRegion(region)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="rounded-md bg-blue-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Prompt Configuration Tips</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc space-y-1 pl-5">
                <li>Write clear, specific instructions for the VLM</li>
                <li>Define exact field names and types in JSON schema</li>
                <li>Use format: <code className="bg-blue-100 px-1 rounded">"field": "type | empty | null"</code></li>
                <li>Configure ALL regions before proceeding to next step</li>
                <li>JSON schema must be valid - errors will block navigation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};