"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================================
// TYPES
// ============================================================================

export interface ReferenceImage {
  image_id: string;
  file_path: string;
  file?: File;
  preview?: string;
}

// FR-004 AC-004-3: Ratio-based coordinates (0-1 scale) for resolution independence
export interface CoordinateRegion {
  region_name: string;
  x1_ratio: number;  // Left edge position (0 = far left, 1 = far right)
  y1_ratio: number;  // Top edge position (0 = top, 1 = bottom)
  x2_ratio: number;  // Right edge position (0 = far left, 1 = far right)
  y2_ratio: number;  // Bottom edge position (0 = top, 1 = bottom)
  confidence_threshold?: number; // FR-004 AC-004-2: Optional per-region confidence override
}

// FR-004 AC-004-2: YOLO class with per-region confidence threshold
export interface YoloClass {
  class_id: string;
  region_name: string;
  confidence_threshold?: number; // Optional override of global confidence (default: 0.60)
}

export interface YoloConfig {
  model_name: string;
  model_path: string;
  confidence_threshold: number; // FR-004 AC-004-2: Global default (0.60)
  iou_threshold?: number;
  classes: YoloClass[]; // Changed from class_mapping to support per-region confidence
}

export interface HybridConfig {
  primary_method: 'yolo' | 'coordinates';
  fallback_method: 'yolo' | 'coordinates';
}

export interface RegionConfig {
  detection_method: 'yolo' | 'coordinates' | 'hybrid';
  coordinate_regions?: CoordinateRegion[];
  yolo_config?: YoloConfig;
  hybrid_config?: HybridConfig;
}

export interface PromptPostProcessing {
  transforms?: Array<{
    field: string;
    transform: string;
    description?: string;
  }>;
  validations?: Array<{
    rule_name: string;
    field: string;
    condition: string;
    action: string;
    message?: string;
    reject_values?: any[];
    validate?: string;
    reason?: string;
  }>;
}

export interface RegionPrompt {
  prompt_text: string;
  expected_output_schema: Record<string, string>;
  post_processing?: PromptPostProcessing;
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  data_type: 'string' | 'integer' | 'float' | 'boolean' | 'date';
  required?: boolean;
  transformation?: {
    map?: Record<string, any>;
    function?: string;
    format?: string;
  };
  fallback_source?: string;
  default_value?: any;
  description?: string;
  validation?: {
    regex?: string;
    max_length?: number;
    min?: number;
    max?: number;
  };
}

export interface ConditionalRule {
  rule_name: string;
  condition: string;
  action?: string;
  actions?: any[];
  field?: string;
  message?: string;
  formula?: string;
  expected?: string;
  on_mismatch?: any;
}

export interface PostProcessingRules {
  conditional_rules?: ConditionalRule[];
  transformation_rules?: Array<{
    field: string;
    transform: string;
  }>;
  cross_field_rules?: any[];
}

export interface TemplateData {
  // Step 1: Basic Info
  _id?: string; // MongoDB document ID
  template_id?: string;
  template_name?: string;
  category?: 'Stamp' | 'Notation' | 'Receipt';
  version?: string;
  description?: string;
  
  // Step 2: Reference Images (handled separately)
  
  // Step 3: Identification
  identification?: {
    reference_images?: ReferenceImage[];
    text_patterns?: string[];
  };
  
  // Step 4: Region Configuration
  region_config?: RegionConfig;
  
  // Step 5: Prompts
  prompts?: Record<string, RegionPrompt>;
  
  // Step 6: Field Mapping
  field_mapping?: Record<string, FieldMapping>;
  
  // Step 7: Post-Processing Rules (optional)
  post_processing_rules?: PostProcessingRules;
}

interface TemplateContextType {
  // State
  currentStep: number;
  totalSteps: number;
  templateData: TemplateData;
  draftId: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
  errors: Record<string, any>; // Changed from string to any to support nested errors
  isEditMode: boolean; // New: track if editing existing template
  
  // Actions
  setCurrentStep: (step: number) => void;
  updateTemplateData: (data: Partial<TemplateData>) => void;
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  loadTemplate: (templateId: string) => Promise<void>; // New: load existing template for editing
  validateStep: (step: number) => boolean;
  submitTemplate: () => Promise<string>;
  resetTemplate: () => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  setErrors: (errors: Record<string, any>) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

export const useTemplate = () => {
  const context = useContext(TemplateContext);
  if (!context) {
    throw new Error('useTemplate must be used within TemplateProvider');
  }
  return context;
};

// ============================================================================
// PROVIDER
// ============================================================================

interface TemplateProviderProps {
  children: React.ReactNode;
  initialDraftId?: string;
  initialTemplateId?: string; // New: for editing existing template
}

export const TemplateProvider: React.FC<TemplateProviderProps> = ({ 
  children, 
  initialDraftId,
  initialTemplateId 
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  const [templateData, setTemplateData] = useState<TemplateData>({
    version: '1.0.0',
    category: 'Stamp',
  });
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditMode, setIsEditMode] = useState(!!initialTemplateId);
  
  // Debounce timer ref
  const saveTimerRef = useRef<NodeJS.Timeout>();
  const hasUnsavedChanges = useRef(false);

  // ============================================================================
  // AUTO-SAVE WITH DEBOUNCING
  // ============================================================================

  const saveDraft = useCallback(async () => {
    if (!hasUnsavedChanges.current) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/templates/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          draft_id: draftId,
          step_number: currentStep,
          total_steps: totalSteps,
          partial_data: templateData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      const data = await response.json();
      
      if (!draftId && data._id) {
        setDraftId(data._id);
      }

      setLastSaved(new Date());
      hasUnsavedChanges.current = false;
      console.log('✅ Draft saved successfully');
    } catch (error) {
      console.error('❌ Failed to save draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [draftId, currentStep, templateData]);

  // Debounced auto-save effect
  useEffect(() => {
    if (hasUnsavedChanges.current) {
      // Clear existing timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Set new timer (2 seconds debounce)
      saveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, 2000);
    }

    // Cleanup
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [templateData, saveDraft]);

  // ============================================================================
  // LOAD DRAFT
  // ============================================================================

  const loadDraft = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/templates/draft?draft_id=${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to load draft');
      }

      const draft = await response.json();
      
      setDraftId(draft._id);
      setCurrentStep(draft.current_step || 1);
      setTemplateData(draft.partial_data || {});
      setLastSaved(new Date(draft.metadata.last_saved_at));
      
      console.log('✅ Draft loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load draft:', error);
    }
  }, []);

  // ============================================================================
  // LOAD TEMPLATE FOR EDITING
  // ============================================================================

  const loadTemplate = useCallback(async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load template');
      }

      const data = await response.json();
      
      // Extract template from response wrapper if it exists
      const template = data.template || data;
      
      // Remove MongoDB _id field if present
      if (template._id) {
        delete template._id;
      }
      
      setTemplateData(template);
      setIsEditMode(true);
      setCurrentStep(1);
      
      console.log('✅ Template loaded for editing:', templateId, template);
    } catch (error) {
      console.error('❌ Failed to load template:', error);
      throw error;
    }
  }, []);

  // Load initial draft or template if provided
  useEffect(() => {
    if (initialDraftId) {
      loadDraft(initialDraftId);
    } else if (initialTemplateId) {
      loadTemplate(initialTemplateId);
    }
  }, [initialDraftId, initialTemplateId, loadDraft, loadTemplate]);

  // ============================================================================
  // UPDATE TEMPLATE DATA
  // ============================================================================

  const updateTemplateData = useCallback((data: Partial<TemplateData>) => {
    setTemplateData(prev => {
      const updated = { ...prev, ...data };
      hasUnsavedChanges.current = true;
      return updated;
    });
  }, []);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1: // Basic Info
        if (!templateData.template_id) {
          newErrors.template_id = 'Template ID is required';
        } else if (!/^[A-Z0-9_]+$/.test(templateData.template_id)) {
          newErrors.template_id = 'Template ID must contain only uppercase letters, numbers, and underscores';
        } else if (errors.template_id) {
          // Preserve existing error from uniqueness check
          newErrors.template_id = errors.template_id;
        }
        
        if (!templateData.template_name) {
          newErrors.template_name = 'Template name is required';
        }
        
        if (!templateData.category) {
          newErrors.category = 'Category is required';
        }
        break;

      case 2: // Reference Images
        const imageCount = templateData.identification?.reference_images?.length || 0;
        if (imageCount === 0) {
          newErrors.reference_images = 'At least 1 reference image is required';
        }
        break;

      case 3: // Identification
        const patternCount = templateData.identification?.text_patterns?.length || 0;
        if (patternCount === 0) {
          newErrors.text_patterns = 'At least 1 text pattern is required';
        }
        break;

      case 4: // Region Configuration
        if (!templateData.region_config?.detection_method) {
          newErrors.detection_method = 'Detection method is required';
        }
        
        if (templateData.region_config?.detection_method === 'coordinates' && 
            !templateData.region_config?.coordinate_regions?.length) {
          newErrors.coordinate_regions = 'At least 1 coordinate region is required';
        }
        
        if (templateData.region_config?.detection_method === 'yolo' && 
            !templateData.region_config?.yolo_config) {
          newErrors.yolo_config = 'YOLO configuration is required';
        }
        break;

      case 5: // Prompts
        if (!templateData.prompts || Object.keys(templateData.prompts).length === 0) {
          newErrors.prompts = 'At least 1 region prompt is required';
        } else {
          const promptErrors: any = {};
          Object.entries(templateData.prompts).forEach(([region, promptConfig]) => {
            if (!promptConfig.prompt_text || promptConfig.prompt_text.trim() === '') {
              promptErrors[region] = { ...promptErrors[region], prompt_text: 'Prompt text is required' };
            }
            
            if (!promptConfig.expected_output_schema || Object.keys(promptConfig.expected_output_schema).length === 0) {
              promptErrors[region] = { ...promptErrors[region], schema: 'Expected output schema is required' };
            }
          });
          
          if (Object.keys(promptErrors).length > 0) {
            newErrors.prompts = promptErrors;
          }
          
          if (errors.prompts && typeof errors.prompts === 'object') {
            const hasSchemaErrors = Object.values(errors.prompts).some((err: any) => err && err.schema);
            if (hasSchemaErrors) {
              newErrors.prompts = errors.prompts;
            }
          }
        }
        break;

      case 6: // Field Mapping
        if (!templateData.field_mapping || Object.keys(templateData.field_mapping).length === 0) {
          newErrors.field_mapping = 'At least 1 field mapping is required';
        }
        break;

      case 7: // Review
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [templateData, errors]);

  // ============================================================================
  // SUBMIT TEMPLATE
  // ============================================================================

  const submitTemplate = useCallback(async (): Promise<string> => {
    try {
      // Validate all steps
      for (let step = 1; step <= 6; step++) {
        if (!validateStep(step)) {
          throw new Error(`Validation failed at step ${step}`);
        }
      }

      // First validate template structure
      const validateResponse = await fetch('/api/templates/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      if (!validateResponse.ok) {
        const error = await validateResponse.json();
        throw new Error(error.error || 'Template validation failed');
      }

      let result;

      if (isEditMode && templateData._id) {
        // Update existing template
        const updateResponse = await fetch(`/api/templates/${templateData._id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
        });

        if (!updateResponse.ok) {
          const error = await updateResponse.json();
          throw new Error(error.error || 'Failed to update template');
        }

        result = await updateResponse.json();
        console.log('✅ Template updated successfully:', result.template_id);
      } else {
        // Create new template
        const createResponse = await fetch('/api/templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...templateData,
            status: 'inactive',
          }),
        });

        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(error.error || 'Failed to create template');
        }

        result = await createResponse.json();
        console.log('✅ Template created successfully:', result.template_id);
      }

      // Delete draft after successful creation/update
      if (draftId) {
        await fetch(`/api/templates/draft?draft_id=${draftId}`, {
          method: 'DELETE',
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to submit template:', error);
      throw error;
    }
  }, [templateData, draftId, validateStep, isEditMode]);

  // ============================================================================
  // RESET TEMPLATE
  // ============================================================================

  const resetTemplate = useCallback(() => {
    setTemplateData({
      version: '1.0.0',
      category: 'Stamp',
    });
    setCurrentStep(1);
    setDraftId(null);
    setErrors({});
    setIsEditMode(false);
    hasUnsavedChanges.current = false;
    setLastSaved(null);
  }, []);

  // ============================================================================
  // ERROR MANAGEMENT
  // ============================================================================

  const setError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: TemplateContextType = {
    currentStep,
    totalSteps,
    templateData,
    draftId,
    isSaving,
    lastSaved,
    errors,
    isEditMode,
    setCurrentStep,
    updateTemplateData,
    saveDraft,
    loadDraft,
    loadTemplate,
    validateStep,
    submitTemplate,
    resetTemplate,
    setError,
    clearError,
    setErrors,
  };

  return (
    <TemplateContext.Provider value={value}>
      {children}
    </TemplateContext.Provider>
  );
};