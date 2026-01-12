"use client";

import React, { useState, useCallback, useRef } from "react";
import axios from "axios";
import { useTemplate } from "@/app/context/TemplateContext";
import { useApiConfig } from "@/app/context/ApiConfigContext";

export const Step2ReferenceImages: React.FC = () => {
  const { templateData, updateTemplateData, errors, setError, clearError } =
    useTemplate();
  const { baseUrl } = useApiConfig();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = templateData.identification?.reference_images || [];
  const maxImages = 5;

  console.log("Current images:", images.length);
  console.log("Base URL:", baseUrl);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      console.log("File selection triggered");
      
      if (!files || files.length === 0) {
        console.log("No files selected");
        return;
      }

      const currentCount = images.length;
      const availableSlots = maxImages - currentCount;

      if (files.length > availableSlots) {
        setError(
          "reference_images",
          `You can only upload ${availableSlots} more image(s). You have ${currentCount}/${maxImages} images.`
        );
        return;
      }

      // Validate files
      const validFiles: File[] = [];
      const duplicateFiles: string[] = [];
      
      console.log("Validating", files.length, "file(s)...");
      console.log("Existing images in state:", images.map(img => ({
        name: img.original_name,
        size: img.size,
        hasFile: !!img.file,
        hasFileName: img.file?.name ? true : false
      })));
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        console.log(`Checking file: ${file.name}, size: ${file.size}, type: ${file.type}`);

        // Check file type
        if (!file.type.startsWith("image/")) {
          setError("reference_images", `${file.name} is not an image file`);
          continue;
        }

        // Check file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          setError("reference_images", `${file.name} exceeds 10MB limit`);
          continue;
        }

        // Check for duplicates
        let isDuplicate = false;
        
        for (const existingImage of images) {
          console.log(`Comparing with existing: ${existingImage.original_name}, size: ${existingImage.size}, hasFile: ${!!existingImage.file}, hasFileName: ${existingImage.file?.name ? true : false}`);
          
          // Case 1: Check if existingImage has a proper File object (with name property)
          if (existingImage.file && existingImage.file.name) {
            const fileMatch = 
              existingImage.file.name === file.name &&
              existingImage.file.size === file.size &&
              existingImage.file.type === file.type;
            
            console.log(`  File object comparison: ${fileMatch}`);
            
            if (fileMatch) {
              isDuplicate = true;
              break;
            }
          } else {
            // Case 2: Existing image from database (no proper File object)
            const nameMatches = existingImage.original_name === file.name;
            const sizeMatches = existingImage.size === file.size;
            const typeMatches = existingImage.mime_type 
              ? existingImage.mime_type === file.type 
              : true;
            
            console.log(`  DB comparison - name: ${nameMatches}, size: ${sizeMatches}, type: ${typeMatches}`);
            
            if (nameMatches && sizeMatches && typeMatches) {
              isDuplicate = true;
              break;
            }
          }
        }

        if (isDuplicate) {
          console.log(`DUPLICATE FOUND: ${file.name}`);
          duplicateFiles.push(file.name);
          continue;
        }

        console.log(`File ${file.name} is valid`);
        validFiles.push(file);
      }

      // Show duplicate error with better messaging
      if (duplicateFiles.length > 0) {
        const errorMsg = `Duplicate image(s) detected: ${duplicateFiles.join(", ")}. This image${duplicateFiles.length > 1 ? 's are' : ' is'} already uploaded.`;
        console.log("Duplicate error:", errorMsg);
        setError("reference_images", errorMsg);
        
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        
        // If all files are duplicates, stop here
        if (validFiles.length === 0) {
          return;
        }
      }

      if (validFiles.length === 0) {
        console.log("No valid files after validation");
        return;
      }

      console.log("Valid files:", validFiles.map(f => `${f.name} (${f.size} bytes)`).join(", "));

      setUploading(true);
      clearError("reference_images");

      try {
        const formData = new FormData();
        validFiles.forEach((file) => {
          formData.append("images", file);
        });

        // Upload with progress using axios
        const response = await axios.post("/api/templates/reference-images", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = (progressEvent.loaded / progressEvent.total) * 100;
              setUploadProgress({ all: percent });
            }
          },
        });

        console.log("Upload response:", response.data);

        const newImages = response.data.images.map((img: any, idx: number) => ({
          image_id: img.image_id,
          file_path: img.file_path,
          original_name: img.original_name,
          size: img.size,
          mime_type: img.mime_type,
          file: validFiles[idx],
        }));

        console.log("New images:", newImages.map((img: any) => img.original_name).join(", "));

        updateTemplateData({
          identification: {
            ...templateData.identification,
            reference_images: [...images, ...newImages],
          },
        });

        console.log("Upload complete!");
      } catch (error) {
        console.error("Upload error:", error);
        if (axios.isAxiosError(error)) {
          const errorMessage = error.response?.data?.error || error.message;
          setError("reference_images", `Failed to upload images: ${errorMessage}`);
        } else {
          setError("reference_images", "Failed to upload images. Please try again.");
        }
      } finally {
        setUploading(false);
        setUploadProgress({});
        
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [images, templateData.identification, updateTemplateData, setError, clearError]
  );

  console.log("images-> ", images);
  console.log("Base url-> ", baseUrl);

  
  const handleRemoveImage = useCallback(
    async (imageId: string) => {
      try {
        console.log("Removing image:", imageId);

        const response = await axios.delete(
          `/api/templates/reference-images/${imageId}`
        );

        console.log("Delete result:", response.data);

        const updatedImages = images.filter((img) => img.image_id !== imageId);
        updateTemplateData({
          identification: {
            ...templateData.identification,
            reference_images: updatedImages,
          },
        });

        console.log("Image removed successfully");
      } catch (error) {
        console.error("Delete error:", error);
        if (axios.isAxiosError(error)) {
          const errorMessage = error.response?.data?.error || error.message;
          setError("reference_images", `Failed to remove image: ${errorMessage}`);
        } else {
          setError("reference_images", "Failed to remove image");
        }
      }
    },
    [images, templateData.identification, updateTemplateData, setError]
  );

  const handleImageError = useCallback((imageId: string, filePath: string) => {
    console.error("Image load failed:", {
      imageId,
      filePath,
      fullUrl: `${baseUrl}${filePath}`
    });
    setImageLoadErrors(prev => ({ ...prev, [imageId]: true }));
  }, [baseUrl]);

  const handleImageLoad = useCallback((imageId: string) => {
    console.log("Image loaded:", imageId);
    setImageLoadErrors(prev => ({ ...prev, [imageId]: false }));
  }, []);

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
                    ref={fileInputRef}
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
        {uploading && uploadProgress.all !== undefined && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Uploading...</span>
              <span className="text-gray-600">{Math.round(uploadProgress.all)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress.all}%` }}
              />
            </div>
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
            {images.map((image, index) => {
              const fullUrl = `${baseUrl}${image.file_path}`;
              const hasError = imageLoadErrors[image.image_id];

              return (
                <div
                  key={image.image_id}
                  className={`relative group rounded-lg border overflow-hidden ${
                    hasError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <div className="aspect-square relative bg-gray-100">
                    {!hasError ? (
                      <img
                        src={fullUrl}
                        alt={image.original_name || `Image ${index + 1}`}
                        className="object-contain w-full h-full"
                        onError={() => handleImageError(image.image_id, image.file_path)}
                        onLoad={() => handleImageLoad(image.image_id)}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-red-500 p-4">
                        <svg
                          className="w-12 h-12 mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <p className="text-xs text-center font-medium">Failed to load</p>
                        <p className="text-xs text-center text-gray-500 mt-1 break-all px-2">
                          {image.file_path}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveImage(image.image_id)}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 focus:opacity-100"
                    title="Remove image"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>

                  {/* Image Label */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1 truncate">
                    {image.original_name || `Image ${index + 1}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};