"use client";

import React, { useState, useCallback } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';
import Image from 'next/image';

export const Step2ReferenceImages: React.FC = () => {
  const { templateData, updateTemplateData, errors, setError, clearError } = useTemplate();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const images = templateData.identification?.reference_images || [];
  const maxImages = 5;
  console.log('Current reference images:', images);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const currentCount = images.length;
    const availableSlots = maxImages - currentCount;

    if (files.length > availableSlots) {
      setError('reference_images', `You can only upload ${availableSlots} more image(s)`);
      return;
    }

    // Validate files
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('reference_images', `${file.name} is not an image file`);
        continue;
      }

      // Check file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('reference_images', `${file.name} exceeds 10MB limit`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    clearError('reference_images');

    try {
      // Create FormData
      const formData = new FormData();
      validFiles.forEach(file => {
        formData.append('images', file);
      });

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(prev => ({
            ...prev,
            [validFiles[0].name]: percentComplete
          }));
        }
      });

      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        xhr.open('POST', '/api/templates/reference-images');
        xhr.send(formData);
      });

      const response = await uploadPromise;

      // Update template data with uploaded images
      const newImages = response.images.map((img: any) => ({
        image_id: img.image_id,
        file_path: img.file_path,
        preview: `/templates/reference-images/${img.image_id}`
      }));

      updateTemplateData({
        identification: {
          ...templateData.identification,
          reference_images: [...images, ...newImages]
        }
      });

      console.log('✅ Images uploaded successfully');
    } catch (error) {
      console.error('❌ Upload failed:', error);
      setError('reference_images', 'Failed to upload images');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  }, [images, templateData.identification, updateTemplateData, setError, clearError]);

  const handleRemoveImage = useCallback(async (imageId: string) => {
    try {
      // Delete from server
      const response = await fetch(`/api/templates/reference-images/${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      // Update template data
      const updatedImages = images.filter(img => img.image_id !== imageId);
      updateTemplateData({
        identification: {
          ...templateData.identification,
          reference_images: updatedImages
        }
      });

      console.log('✅ Image removed successfully');
    } catch (error) {
      console.error('❌ Failed to remove image:', error);
      setError('reference_images', 'Failed to remove image');
    }
  }, [images, templateData.identification, updateTemplateData, setError]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reference Images</h2>
        <p className="mt-1 text-sm text-gray-600">
          Upload 1-5 sample images that represent this template
        </p>
      </div>

      {/* Upload Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Images ({images.length}/{maxImages}) *
        </label>

        {images.length < maxImages && (
          <div className="mt-2 flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 hover:border-gray-400 transition-colors">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-4 flex text-sm leading-6 text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md bg-white font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:text-blue-500"
                >
                  <span>Upload files</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    multiple
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-gray-600">
                PNG, JPG, JPEG up to 10MB each
              </p>
              <p className="text-xs leading-5 text-gray-600 mt-1">
                {maxImages - images.length} slot(s) remaining
              </p>
            </div>
          </div>
        )}

        {errors.reference_images && (
          <p className="mt-2 text-sm text-red-600">{errors.reference_images}</p>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-4">
            {Object.entries(uploadProgress).map(([filename, progress]) => (
              <div key={filename} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{filename}</span>
                  <span className="text-gray-600">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Uploaded Images ({images.length})
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            
            {images.map((image, index) => (
                
              <div
                key={image.image_id}
                className="relative group rounded-lg border border-gray-300 overflow-hidden"
              >
                <div className="aspect-square relative bg-gray-100">
                    
                  {image.file_path                                       && (
                    <Image
                      src={`${image.file_path}`}
                      alt={`Reference image ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                
                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveImage(image.image_id)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  title="Remove image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Image Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1 truncate">
                  Image {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              Reference Image Guidelines
            </h3>
            <div className="mt-2 text-sm text-primary">
              <ul className="list-disc space-y-1 pl-5">
                <li>Upload clear, high-quality scans of sample documents</li>
                <li>Include variations (different stamps, formats, conditions)</li>
                <li>These images help the system identify matching documents</li>
                <li>Minimum 1 image, maximum 5 images per template</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};