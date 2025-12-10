"use client";

import React, { useState } from 'react';
import { useTemplate, ConditionalRule } from '@/app/context/TemplateContext';

export const Step5Prompts: React.FC = () => {
  const { templateData, updateTemplateData, errors, setErrors } = useTemplate();
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [schemaText, setSchemaText] = useState<string>('');
  const [schemaError, setSchemaError] = useState<string>('');
  const [showPostProcessing, setShowPostProcessing] = useState(false);
  
  // New rule state
  const [newRule, setNewRule] = useState<ConditionalRule>({
    rule_name: '',
    condition: '',
    action: 'set_to_null',
    field: '',
  });
  
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
    
    // Reset post-processing view when changing regions
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

  // Add post-processing rule
  const addPostProcessingRule = () => {
    if (!newRule.rule_name || !newRule.condition || !newRule.field) {
      alert('Please fill in all required fields: Rule Name, Condition, and Field');
      return;
    }

    const currentPostProcessing = prompts[selectedRegion]?.post_processing || { validations: [] };
    const updatedValidations = [...(currentPostProcessing.validations || []), { ...newRule }];

    updatePrompt(selectedRegion, 'post_processing', {
      ...currentPostProcessing,
      validations: updatedValidations
    });

    // Reset form
    setNewRule({
      rule_name: '',
      condition: '',
      action: 'set_to_null',
      field: '',
    });
  };

  // Delete post-processing rule
  const deletePostProcessingRule = (index: number) => {
    const currentPostProcessing = prompts[selectedRegion]?.post_processing || { validations: [] };
    const updatedValidations = (currentPostProcessing.validations || []).filter((_, i) => i !== index);

    updatePrompt(selectedRegion, 'post_processing', {
      ...currentPostProcessing,
      validations: updatedValidations
    });
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
        <h2 className="text-2xl font-bold text-gray-900">Region Prompts</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure VLM prompts and post-processing rules for each detected region
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
  "pod_sign": "string",
  "total_received": "integer",
  "damage": "integer",
  "short": "integer",
  "over": "integer",
  "refused": "integer",
  "roc_damaged": "integer",
  "damaged_kept": "integer",
  "notation_exist": "integer"
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

              <p className="mt-2 text-xs text-gray-500">
                Define the exact JSON structure that the VLM should output for this region.
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

          {/* Post-Processing Rules Card */}
          <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Post-Processing Rules
                  <span className="ml-2 text-sm font-normal text-gray-500">(Optional)</span>
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Define validation and transformation rules for extracted data
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
                {/* Add New Rule Form */}
                <div className="bg-white rounded-lg border border-purple-200 p-4 space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">Add Validation Rule</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Rule Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rule Name *
                      </label>
                      <input
                        type="text"
                        value={newRule.rule_name}
                        onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                        placeholder="reject_suspicious_values"
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    {/* Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field *
                      </label>
                      <input
                        type="text"
                        value={newRule.field}
                        onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
                        placeholder="total_received"
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    {/* Condition */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Condition *
                      </label>
                      <input
                        type="text"
                        value={newRule.condition}
                        onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                        placeholder="total_received in [226, 3511, 2028]"
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Example: <code className="bg-gray-100 px-1 rounded">field in [value1, value2]</code> or <code className="bg-gray-100 px-1 rounded">field {'>'} 100</code>
                      </p>
                    </div>

                    {/* Action */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Action *
                      </label>
                      <select
                        value={newRule.action}
                        onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="set_to_null">Set to null</option>
                        <option value="set_to_empty">Set to empty</option>
                        <option value="reject">Reject value</option>
                        <option value="flag">Flag for review</option>
                      </select>
                    </div>

                    {/* Message (Optional) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message <span className="text-xs text-gray-500">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={newRule.message || ''}
                        onChange={(e) => setNewRule({ ...newRule, message: e.target.value })}
                        placeholder="Suspicious value detected"
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={addPostProcessingRule}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Rule
                  </button>
                </div>

                {/* Existing Rules List */}
                {prompts[selectedRegion]?.post_processing?.validations && 
                 prompts[selectedRegion].post_processing.validations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">
                      Configured Rules ({prompts[selectedRegion].post_processing.validations.length})
                    </h4>
                    
                    {prompts[selectedRegion].post_processing.validations.map((rule, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-lg border border-purple-200 p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                {rule.rule_name}
                              </span>
                              <span className="text-xs text-gray-500">→ Field: {rule.field}</span>
                            </div>
                            <div className="mt-2 text-sm text-gray-700">
                              <span className="font-medium">Condition:</span>
                              <code className="ml-2 bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
                                {rule.condition}
                              </code>
                            </div>
                            <div className="mt-1 text-sm text-gray-700">
                              <span className="font-medium">Action:</span>
                              <span className="ml-2 text-purple-600">{rule.action}</span>
                              {rule.message && (
                                <span className="ml-2 text-gray-500">- {rule.message}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => deletePostProcessingRule(index)}
                            className="ml-4 text-red-600 hover:text-red-700"
                            title="Delete rule"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Help Text */}
                <div className="rounded-md bg-purple-100 p-3">
                  <p className="text-xs text-purple-800">
                    <strong>💡 Post-processing rules</strong> help clean and validate extracted data. 
                    For example, reject known OCR misreads like "226" for total_received.
                  </p>
                </div>
              </div>
            )}
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
              
              const rulesCount = prompts[region]?.post_processing?.validations?.length || 0;
              
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
                        {rulesCount > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            {rulesCount} rule{rulesCount !== 1 ? 's' : ''}
                          </span>
                        )}
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
                <li>Add post-processing rules to handle known OCR errors</li>
                <li>Use conditions like: <code className="bg-blue-100 px-1 rounded">field in [bad_value1, bad_value2]</code></li>
                <li>Configure ALL regions before proceeding to next step</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};