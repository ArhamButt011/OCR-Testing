import React, { useState } from 'react';
import { toast } from 'react-toastify';

interface TransformationRule {
  rule_name: string;
  field: string;
  action: string;
  formats?: string[];
  pattern?: string;
  description?: string;
}

interface TransformationRulesFormProps {
  rules: TransformationRule[];
  onAdd: (rule: TransformationRule) => void;
  onDelete: (index: number) => void;
  onEdit: (index: number, rule: TransformationRule) => void;
}

export const TransformationRulesForm: React.FC<TransformationRulesFormProps> = ({ 
  rules, 
  onAdd, 
  onDelete, 
  onEdit 
}) => {
  const [newRule, setNewRule] = useState<TransformationRule>({
    rule_name: '',
    field: '',
    action: '',
    formats: [],
    pattern: '',
    description: '',
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    if (!newRule.rule_name || !newRule.field || !newRule.action) {
      toast.error('Please fill in all required fields: Rule Name, Field, and Action');
      return;
    }

    if (editingIndex !== null) {
      onEdit(editingIndex, { ...newRule });
      toast.success('Transformation rule updated');
      setEditingIndex(null);
    } else {
      onAdd({ ...newRule });
      toast.success('Transformation rule added');
    }
    
    setNewRule({
      rule_name: '',
      field: '',
      action: '',
      formats: [],
      pattern: '',
      description: '',
    });
  };

  const handleEdit = (index: number) => {
    const rule = rules[index];
    setNewRule({
      rule_name: rule.rule_name,
      field: rule.field,
      action: rule.action,
      formats: rule.formats || [],
      pattern: rule.pattern || '',
      description: rule.description || '',
    });
    setEditingIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setNewRule({
      rule_name: '',
      field: '',
      action: '',
      formats: [],
      pattern: '',
      description: '',
    });
    setEditingIndex(null);
  };

  const showFormatsField = newRule.action === 'convert_to_mmddyy';
  const showPatternField = newRule.action === 'regex_extract';

  return (
    <div className="bg-white rounded-lg border border-purple-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">
          {editingIndex !== null ? 'Edit Transformation Rule' : 'Add Transformation Rule'}
        </h4>
        {editingIndex !== null && (
          <button
            onClick={handleCancel}
            className="text-xs text-gray-600 hover:text-gray-800"
          >
            Cancel Edit
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rule Name *
          </label>
          <input
            type="text"
            value={newRule.rule_name}
            onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
            placeholder="normalize_date_format"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field *
          </label>
          <input
            type="text"
            value={newRule.field}
            onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
            placeholder="stamp.pod_date"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action *
          </label>
          <input
            type="text"
            value={newRule.action}
            onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
            placeholder="convert_to_mmddyy"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Common: convert_to_mmddyy, regex_extract, uppercase, lowercase, trim, parse_number
          </p>
        </div>

        {showFormatsField && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formats (comma-separated)
            </label>
            <input
              type="text"
              value={newRule.formats?.join(', ') || ''}
              onChange={(e) => setNewRule({ 
                ...newRule, 
                formats: e.target.value.split(',').map(f => f.trim()).filter(Boolean)
              })}
              placeholder="M.DD, MM/DD, MMM DD, MMM DD YYYY"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        )}

        {showPatternField && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pattern (Regex)
            </label>
            <input
              type="text"
              value={newRule.pattern || ''}
              onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
              placeholder="^(\d+)"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        )}

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            value={newRule.description || ''}
            onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
            placeholder="If total_received is string with units, extract numeric part"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {editingIndex !== null ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            )}
          </svg>
          {editingIndex !== null ? 'Update Rule' : 'Add Transformation Rule'}
        </button>
        {editingIndex !== null && (
          <button
            onClick={handleCancel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>

      {/* List Rules */}
      {rules && rules.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-gray-200">
          <h5 className="text-sm font-medium text-gray-900">
            Configured Rules ({rules.length})
          </h5>
          {rules.map((rule, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    {rule.rule_name}
                  </span>
                  <span className="text-xs text-gray-500">{'->'}{rule.field}</span>
                </div>
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Action:</span> {rule.action}
                </div>
                {rule.formats && rule.formats.length > 0 && (
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Formats:</span> {rule.formats.join(', ')}
                  </div>
                )}
                {rule.pattern && (
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Pattern:</span>{' '}
                    <code className="bg-white px-1.5 py-0.5 rounded">{rule.pattern}</code>
                  </div>
                )}
                {rule.description && (
                  <div className="text-xs text-gray-500 mt-1">{rule.description}</div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleEdit(index)}
                  className="text-blue-600 hover:text-blue-700"
                  title="Edit rule"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(index)}
                  className="text-red-600 hover:text-red-700"
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
    </div>
  );
};