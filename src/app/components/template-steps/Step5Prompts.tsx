"use client";

import React, { useState } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';
import { ValidationRulesForm } from './ValidationRules';
import { TransformationRulesForm } from './TransformationRules';
import { BusinessLogicRulesForm } from './BusinessLogicRules';

type RuleType = 'validation_rules' | 'transformation_rules' | 'business_logic';

export const Step5Prompts: React.FC = () => {
  const { templateData, updateTemplateData, errors, setErrors } = useTemplate();
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [schemaText, setSchemaText] = useState<string>('');
  const [schemaError, setSchemaError] = useState<string>('');
  const [showPostProcessing, setShowPostProcessing] = useState(false);
  const [selectedRuleType, setSelectedRuleType] = useState<RuleType>('validation_rules');

  // Get regions from region_config
  const regions = React.useMemo(() => {
    const regionSet = new Set<string>();
    
    if (templateData.region_config?.yolo_config?.classes) {
      templateData.region_config.yolo_config.classes.forEach(cls => {
        regionSet.add(cls.region_name);
      });
    }
    
    if (templateData.region_config?.coordinate_regions) {
      templateData.region_config.coordinate_regions.forEach(region => {
        regionSet.add(region.region_name);
      });
    }
    
    return Array.from(regionSet);
  }, [templateData.region_config]);

  const prompts = templateData.prompts || {};
  const postProcessingRules = templateData.post_processing_rules || {};

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

  const updatePostProcessingRules = (rules: Partial<typeof postProcessingRules>) => {
    updateTemplateData({
      post_processing_rules: {
        ...postProcessingRules,
        ...rules
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
    
    setShowPostProcessing(false);
  }, [selectedRegion, prompts]);

  // Validate and save JSON schema
  const handleSchemaChange = (value: string) => {
    setSchemaText(value);
    
    try {
      const parsed = JSON.parse(value);
      setSchemaError('');
      updatePrompt(selectedRegion, 'expected_output_schema', parsed);
      
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

  // Add Validation Rule
  const addValidationRule = (rule: any) => {
    const updatedRules = [...(postProcessingRules.validation_rules || []), rule];
    updatePostProcessingRules({ validation_rules: updatedRules });
  };

  // Edit Validation Rule
  const editValidationRule = (index: number, rule: any) => {
    const updatedRules = [...(postProcessingRules.validation_rules || [])];
    updatedRules[index] = rule;
    updatePostProcessingRules({ validation_rules: updatedRules });
  };

  // Add Transformation Rule
  const addTransformationRule = (rule: any) => {
    const updatedRules = [...(postProcessingRules.transformation_rules || []), rule];
    updatePostProcessingRules({ transformation_rules: updatedRules });
  };

  // Edit Transformation Rule
  const editTransformationRule = (index: number, rule: any) => {
    const updatedRules = [...(postProcessingRules.transformation_rules || [])];
    updatedRules[index] = rule;
    updatePostProcessingRules({ transformation_rules: updatedRules });
  };

  // Add Business Logic Rule
  const addBusinessLogicRule = (rule: any) => {
    const updatedRules = [...(postProcessingRules.business_logic || []), rule];
    updatePostProcessingRules({ business_logic: updatedRules });
  };

  // Edit Business Logic Rule
  const editBusinessLogicRule = (index: number, rule: any) => {
    const updatedRules = [...(postProcessingRules.business_logic || [])];
    updatedRules[index] = rule;
    updatePostProcessingRules({ business_logic: updatedRules });
  };

  // Delete rules
  const deleteValidationRule = (index: number) => {
    const updated = (postProcessingRules.validation_rules || []).filter((_, i) => i !== index);
    updatePostProcessingRules({ validation_rules: updated });
  };

  const deleteTransformationRule = (index: number) => {
    const updated = (postProcessingRules.transformation_rules || []).filter((_, i) => i !== index);
    updatePostProcessingRules({ transformation_rules: updated });
  };

  const deleteBusinessLogicRule = (index: number) => {
    const updated = (postProcessingRules.business_logic || []).filter((_, i) => i !== index);
    updatePostProcessingRules({ business_logic: updated });
  };

  // Validate current region
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
        <h2 className="text-2xl font-bold text-gray-900">Region Prompts & Post-Processing</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure VLM prompts and global post-processing rules
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
        <div className="space-y-6">
          {/* Main Configuration Card */}
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
                placeholder={`Extract from RECEIVING STAMP AREA:
1. stamp_exist: yes/no
2. total_received: CARTONS ONLY
3. pod_date: MM/DD/YY format
4. damage, short, over, refused: integers

Output JSON only.`}
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

            {/* Expected Output Schema */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Output Schema (JSON) *
              </label>
              <textarea
                rows={12}
                value={schemaText}
                onChange={(e) => handleSchemaChange(e.target.value)}
                placeholder={`{
  "stamp_exist": "string",
  "seal_intact": "string",
  "pod_date": "string",
  "total_received": "integer",
  "damage": "integer",
  "short": "integer"
}`}
                className={`block w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 ${
                  schemaError 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              
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
        </div>
      )}

      {/* Global Post-Processing Rules Card */}
      <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Global Post-Processing Rules
              <span className="ml-2 text-sm font-normal text-gray-500">(Optional)</span>
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Define validation, transformation, and business logic rules applied across all regions
            </p>
          </div>
          <button
            onClick={() => setShowPostProcessing(!showPostProcessing)}
            className="inline-flex items-center px-3 py-1.5 border border-purple-300 text-sm font-medium rounded text-purple-700 bg-white hover:bg-purple-100"
          >
            {showPostProcessing ? 'Hide' : 'Show'} Rules
            <svg 
              className={`ml-2 h-4 w-4 transition-transform ${showPostProcessing ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {showPostProcessing && (
          <div className="space-y-4 pt-4 border-t border-purple-200">
            {/* Rule Type Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRuleType('validation_rules')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md border ${
                  selectedRuleType === 'validation_rules'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Validation Rules
                {(postProcessingRules.validation_rules?.length || 0) > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-purple-200 text-purple-800">
                    {postProcessingRules.validation_rules?.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSelectedRuleType('transformation_rules')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md border ${
                  selectedRuleType === 'transformation_rules'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Transformation Rules
                {(postProcessingRules.transformation_rules?.length || 0) > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-purple-200 text-purple-800">
                    {postProcessingRules.transformation_rules?.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSelectedRuleType('business_logic')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md border ${
                  selectedRuleType === 'business_logic'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Business Logic
                {(postProcessingRules.business_logic?.length || 0) > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-purple-200 text-purple-800">
                    {postProcessingRules.business_logic?.length}
                  </span>
                )}
              </button>
            </div>

            {/* Forms */}
            {selectedRuleType === 'validation_rules' && (
              <ValidationRulesForm
                rules={postProcessingRules.validation_rules || []}
                onAdd={addValidationRule}
                onEdit={editValidationRule}
                onDelete={deleteValidationRule}
              />
            )}

            {selectedRuleType === 'transformation_rules' && (
              <TransformationRulesForm
                rules={postProcessingRules.transformation_rules || []}
                onAdd={addTransformationRule}
                onEdit={editTransformationRule}
                onDelete={deleteTransformationRule}
              />
            )}

            {selectedRuleType === 'business_logic' && (
              <BusinessLogicRulesForm
                rules={postProcessingRules.business_logic || []}
                onAdd={addBusinessLogicRule}
                onEdit={editBusinessLogicRule}
                onDelete={deleteBusinessLogicRule}
              />
            )}
          </div>
        )}
      </div>

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
                    <div>
                      <span className="text-sm font-medium text-gray-900">{region}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {Object.keys(prompts[region]?.expected_output_schema || {}).length} fields
                        </span>
                      </div>
                    </div>
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

      {/* Summary of Post-Processing Rules */}
      {(postProcessingRules.validation_rules?.length || 
        postProcessingRules.transformation_rules?.length || 
        postProcessingRules.business_logic?.length) ? (
        <div className="rounded-lg border-2 border-indigo-200 bg-indigo-50 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Post-Processing Rules Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-indigo-600">
                {postProcessingRules.validation_rules?.length || 0}
              </div>
              <div className="text-xs text-gray-600">Validation Rules</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">
                {postProcessingRules.transformation_rules?.length || 0}
              </div>
              <div className="text-xs text-gray-600">Transformation Rules</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">
                {postProcessingRules.business_logic?.length || 0}
              </div>
              <div className="text-xs text-gray-600">Business Logic Rules</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};