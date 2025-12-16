"use client";

import React, { useState } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';
import type { FieldMapping } from '@/app/context/TemplateContext';

export const Step6FieldMapping: React.FC = () => {
  const { templateData, updateTemplateData, errors, setError, clearError } = useTemplate();
  const [isAddingField, setIsAddingField] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [newMapping, setNewMapping] = useState<FieldMapping>({
    source_field: '',
    target_field: '',
    data_type: 'string',
    required: false,
  });

  const fieldMappings = templateData.field_mapping || {};
  const regions = Object.keys(templateData.prompts || {});

  const dataTypes = ['string', 'integer', 'float', 'boolean', 'date'];

  const addOrUpdateMapping = () => {
    if (!newMapping.source_field || !newMapping.target_field) {
      setError('field_mapping', 'Source field and target field are required');
      return;
    }

    const targetField = editingField || newMapping.target_field;

    updateTemplateData({
      field_mapping: {
        ...fieldMappings,
        [targetField]: newMapping
      }
    });

    setNewMapping({
      source_field: '',
      target_field: '',
      data_type: 'string',
      required: false,
    });
    setIsAddingField(false);
    setEditingField(null);
    clearError('field_mapping');
  };

  const editMapping = (targetField: string) => {
    console.log('Editing mapping for:', targetField, fieldMappings[targetField]);
    setNewMapping(fieldMappings[targetField]);
    setEditingField(targetField);
    setIsAddingField(true);
  };

  const removeMapping = (targetField: string) => {
    const updated = { ...fieldMappings };
    delete updated[targetField];
    updateTemplateData({ field_mapping: updated });
  };

  const cancelEdit = () => {
    setNewMapping({
      source_field: '',
      target_field: '',
      data_type: 'string',
      required: false,
    });
    setIsAddingField(false);
    setEditingField(null);
    clearError('field_mapping');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Field Mapping</h2>
        <p className="mt-1 text-sm text-gray-600">
          Map OCR output fields to database fields
        </p>
      </div>

      {/* Add/Edit Field Mapping Button */}
      {!isAddingField && (
        <button
          onClick={() => setIsAddingField(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Field Mapping
        </button>
      )}

      {/* Add/Edit Field Form */}
      {isAddingField && (
        <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            {editingField ? 'Edit Field Mapping' : 'Add New Field Mapping'}
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Source Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Source Field (OCR Output) *
              </label>
              <input
                type="text"
                value={newMapping.source_field}
                onChange={(e) => setNewMapping({ ...newMapping, source_field: e.target.value })}
                placeholder="stamp.total_received"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Format: region.field (e.g., stamp.total_received)
              </p>
            </div>

            {/* Target Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Target Field (Database) *
              </label>
              <input
                type="text"
                value={newMapping.target_field}
                onChange={(e) => setNewMapping({ ...newMapping, target_field: e.target.value })}
                placeholder="OCR_RCVQTY"
                // disabled={!!editingField}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                Database column name (e.g., OCR_RCVQTY)
              </p>
            </div>

            {/* Data Type */}
            {/* <div>
              <label className="block text-sm font-medium text-gray-700">
                Data Type *
              </label>
              <select
                value={newMapping.data_type}
                onChange={(e) => setNewMapping({ ...newMapping, data_type: e.target.value as any })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                {dataTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div> */}

            {/* Required */}
            {/* <div className="flex items-center">
              <input
                type="checkbox"
                id="required"
                checked={newMapping.required || false}
                onChange={(e) => setNewMapping({ ...newMapping, required: e.target.checked })}
                className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="required" className="ml-2 block text-sm text-gray-700">
                Required field
              </label>
            </div> */}

            {/* Default Value */}
            {/* <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Default Value (Optional)
              </label>
              <input
                type="text"
                value={newMapping.default_value || ''}
                onChange={(e) => setNewMapping({ ...newMapping, default_value: e.target.value })}
                placeholder="0"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div> */}

            {/* Description */}
            {/* <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                value={newMapping.description || ''}
                onChange={(e) => setNewMapping({ ...newMapping, description: e.target.value })}
                placeholder="Brief description of this field mapping..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div> */}
          </div>

          {errors.field_mapping && (
            <p className="text-sm text-red-600">{errors.field_mapping}</p>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={cancelEdit}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={addOrUpdateMapping}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary"
            >
              {editingField ? 'Update Mapping' : 'Add Mapping'}
            </button>
          </div>
        </div>
      )}

      {/* Field Mappings List */}
      {Object.keys(fieldMappings).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Configured Mappings ({Object.keys(fieldMappings).length})
          </h3>
          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source Field
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target Field
                  </th>
                  {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Type
                  </th> */}
                  {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Required
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Default
                  </th> */}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(fieldMappings).map(([targetField, mapping]) => (
                  <tr key={targetField} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {mapping.source_field}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {mapping?.target_field}
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {mapping.data_type}
                      </span>
                    </td> */}
                    {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mapping.required ? (
                        <span className="text-red-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {mapping.default_value || '-'}
                    </td> */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => editMapping(targetField)}
                        className="text-primary hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeMapping(targetField)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    

      {/* Empty State */}
      {Object.keys(fieldMappings).length === 0 && !isAddingField && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No field mappings</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first field mapping.
          </p>
        </div>
      )}
    </div>
  );
};