import React, { useState } from 'react';
import { toast } from 'react-toastify';

interface ValidationRule {
  rule_name: string;
  field: string | string[];
  condition: string;
  action: string;
  reason?: string;
}

interface ValidationRulesFormProps {
  rules: ValidationRule[];
  onAdd: (rule: ValidationRule) => void;
  onDelete: (index: number) => void;
  onEdit: (index: number, rule: ValidationRule) => void;
}

export const ValidationRulesForm: React.FC<ValidationRulesFormProps> = ({ 
  rules, 
  onAdd, 
  onDelete, 
  onEdit 
}) => {
  const [newRule, setNewRule] = useState<ValidationRule>({
    rule_name: '',
    field: '',
    condition: '',
    action: '',
    reason: '',
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    if (!newRule.rule_name || !newRule.field || !newRule.condition || !newRule.action) {
      toast.error('Please fill in all required fields: Rule Name, Field, Condition, and Action');
      return;
    }

    // Parse field - convert comma-separated string to array if needed
    const fieldValue = typeof newRule.field === 'string' && newRule.field.includes(',')
      ? newRule.field.split(',').map(f => f.trim()).filter(Boolean)
      : newRule.field;

    if (editingIndex !== null) {
      onEdit(editingIndex, { ...newRule, field: fieldValue });
      toast.success('Validation rule updated');
      setEditingIndex(null);
    } else {
      onAdd({ ...newRule, field: fieldValue });
      toast.success('Validation rule added');
    }
    
    setNewRule({
      rule_name: '',
      field: '',
      condition: '',
      action: '',
      reason: '',
    });
  };

  const handleEdit = (index: number) => {
    const rule = rules[index];
    setNewRule({
      rule_name: rule.rule_name,
      field: Array.isArray(rule.field) ? rule.field.join(', ') : rule.field,
      condition: rule.condition,
      action: rule.action,
      reason: rule.reason || '',
    });
    setEditingIndex(index);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setNewRule({
      rule_name: '',
      field: '',
      condition: '',
      action: '',
      reason: '',
    });
    setEditingIndex(null);
  };

  return (
    <div className="bg-white rounded-lg border border-purple-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">
          {editingIndex !== null ? 'Edit Validation Rule' : 'Add Validation Rule'}
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
            placeholder="reject_suspicious_carton_counts"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Field *
          </label>
          <input
            type="text"
            value={typeof newRule.field === 'string' ? newRule.field : newRule.field.join(', ')}
            onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
            placeholder="stamp.total_received or stamp.damage,stamp.short"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <p className="mt-1 text-xs text-gray-500">Use comma-separated for multiple fields</p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Condition *
          </label>
          <input
            type="text"
            value={newRule.condition}
            onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
            placeholder="value in [226, 3511, 2028] OR value >= 1000 AND value <= 9999"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Examples: "always", "value {'>'} 500", "value in [226, 3511]", "matches hallucinated pattern"
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action *
          </label>
          <input
            type="text"
            value={newRule.action}
            onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
            placeholder="set_to_null"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Common: set_to_null, set_to_empty, set_to_no, set_to_yes, reject, flag
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason
          </label>
          <input
            type="text"
            value={newRule.reason || ''}
            onChange={(e) => setNewRule({ ...newRule, reason: e.target.value })}
            placeholder="Known false positive values from OCR misreading"
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
          {editingIndex !== null ? 'Update Rule' : 'Add Validation Rule'}
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
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {rule.rule_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {"->"}{Array.isArray(rule.field) ? rule.field.join(', ') : rule.field}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Condition:</span>{' '}
                  <code className="bg-white px-1.5 py-0.5 rounded">{rule.condition}</code>
                </div>
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Action:</span> {rule.action}
                  {rule.reason && <span className="ml-2 text-gray-500">- {rule.reason}</span>}
                </div>
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