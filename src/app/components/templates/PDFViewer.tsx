import React, { useRef, useEffect, useState } from "react";

interface Region {
  region_name: string;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  confidence: number;
  page?: number;
}

interface PDFViewerProps {
  file: File;
  regions: Region[];
}

const REGION_COLORS: Record<string, string> = {
  stamp: "#10B981",
  bill_of_lading: "#3B82F6",
  bill_of_lading_header: "#3B82F6",
  customer_order_info: "#F59E0B",
  signatures: "#8B5CF6",
  default: "#6B7280",
};

export const PDFViewer: React.FC<PDFViewerProps> = ({ file, regions }) => {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [imageData, setImageData] = useState<HTMLImageElement | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [renderScale, setRenderScale] = useState(1.0);

  useEffect(() => {
    if (file) {
      loadFile();
    }
  }, [file]);

  useEffect(() => {
    if (pdfDocument && currentPage) {
      loadPDFPage(currentPage);
    }
  }, [pdfDocument, currentPage]);

  useEffect(() => {
    if (imageData) {
      renderImage();
    }
  }, [imageData, scale]);

  useEffect(() => {
    if (regions && regions.length > 0 && overlayCanvasRef.current && imageData && originalDimensions) {
      drawBoundingBoxes();
    }
  }, [regions, scale, imageData, originalDimensions, currentPage, renderScale]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);

    try {
      const fileType = file.type;

      if (fileType === "application/pdf") {
        await loadPDF();
      } else if (fileType.startsWith("image/")) {
        await loadImage();
        setTotalPages(1);
        setRenderScale(1.0);
      } else {
        setError("Unsupported file type");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading file:", error);
      setError("Failed to load file");
      setLoading(false);
    }
  };

  const loadImage = async () => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImageData(img);
          setOriginalDimensions({ width: img.width, height: img.height });
          setLoading(false);
          resolve();
        };
        img.onerror = () => {
          setError("Failed to load image");
          setLoading(false);
          reject();
        };
        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        setError("Failed to read file");
        setLoading(false);
        reject();
      };

      reader.readAsDataURL(file);
    });
  };

  const loadPDF = async () => {
    try {
      if (!(window as any).pdfjsLib) {
        await loadPDFJSFromCDN();
      }

      const pdfjsLib = (window as any).pdfjsLib;
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      await loadPDFPage(1, pdf);
    } catch (error) {
      console.error("Error loading PDF:", error);
      setError("Failed to load PDF");
      setLoading(false);
    }
  };

  const loadPDFPage = async (pageNumber: number, pdf?: any) => {
    try {
      setLoading(true);
      const pdfDoc = pdf || pdfDocument;
      
      if (!pdfDoc) {
        throw new Error("PDF document not loaded");
      }

      const page = await pdfDoc.getPage(pageNumber);

      // Get viewport at scale 1.0 to capture original dimensions
      const originalViewport = page.getViewport({ scale: 1.0 });
      setOriginalDimensions({ 
        width: originalViewport.width, 
        height: originalViewport.height 
      });

      // Use scale 1.0 for rendering to match the coordinate space
      const pdfRenderScale = 1.0;
      setRenderScale(pdfRenderScale);
      const viewport = page.getViewport({ scale: pdfRenderScale });

      // Create canvas
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not get canvas context");
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Convert canvas to image
      const img = new Image();
      img.onload = () => {
        setImageData(img);
        setLoading(false);
      };
      img.onerror = () => {
        setError("Failed to render PDF page");
        setLoading(false);
      };
      img.src = canvas.toDataURL();
    } catch (error) {
      console.error("Error loading PDF page:", error);
      setError("Failed to load PDF page");
      setLoading(false);
    }
  };

  const loadPDFJSFromCDN = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;

      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve();
      };

      script.onerror = () => {
        reject(new Error("Failed to load PDF.js from CDN"));
      };

      document.head.appendChild(script);
    });
  };

  const renderImage = () => {
    if (!imageData) return;

    const imageCanvas = imageCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (!imageCanvas || !overlayCanvas) return;

    const ctx = imageCanvas.getContext("2d");
    if (!ctx) return;

    // Calculate scaled dimensions
    const width = imageData.width * scale;
    const height = imageData.height * scale;

    // Set canvas dimensions
    imageCanvas.width = width;
    imageCanvas.height = height;
    overlayCanvas.width = width;
    overlayCanvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw image
    ctx.drawImage(imageData, 0, 0, width, height);

    // Draw bounding boxes
    drawBoundingBoxes();
  };

  const drawBoundingBoxes = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !imageData || !originalDimensions) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Filter regions for current page
    const currentPageRegions = regions.filter(region => {
      return !region.page || region.page === currentPage;
    });

    currentPageRegions.forEach((region) => {
      const box = region.bbox;
      const color = REGION_COLORS[region.region_name] || REGION_COLORS.default;

      // Calculate the scale factor from original PDF to current canvas
      const scaleFactorX = canvas.width / originalDimensions.width;
      const scaleFactorY = canvas.height / originalDimensions.height;
      
      // Apply the scale to map from original coordinates to canvas coordinates
      const x1 = box.x1 * scaleFactorX;
      const y1 = box.y1 * scaleFactorY;
      const x2 = box.x2 * scaleFactorX;
      const y2 = box.y2 * scaleFactorY;

      const width = x2 - x1;
      const height = y2 - y1;

      // Draw rectangle
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, width, height);

      // Draw semi-transparent fill
      ctx.fillStyle = color + "20";
      ctx.fillRect(x1, y1, width, height);

      // Draw label background
      const labelText = `${region.region_name} (${(region.confidence * 100).toFixed(0)}%)`;
      ctx.font = "bold 14px Arial";
      const textMetrics = ctx.measureText(labelText);
      const labelWidth = textMetrics.width + 10;
      const labelHeight = 25;

      ctx.fillStyle = color;
      ctx.fillRect(x1, y1 - labelHeight, labelWidth, labelHeight);

      // Draw label text
      ctx.fillStyle = "white";
      ctx.fillText(labelText, x1 + 5, y1 - 7);
    });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pageNum = parseInt(e.target.value);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center p-6">
          <svg
            className="mx-auto h-12 w-12 text-red-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading File</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-white text-center">
          <svg
            className="animate-spin h-8 w-8 mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="mt-2 text-sm">Loading document...</p>
        </div>
      </div>
    );
  }

  const currentPageRegions = regions.filter(region => {
    return !region.page || region.page === currentPage;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
              title="Zoom Out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                />
              </svg>
            </button>

            <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
              title="Zoom In"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                />
              </svg>
            </button>

            <button
              onClick={handleResetZoom}
              className="ml-2 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Page Navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={handlePageInput}
                  className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">of {totalPages}</span>
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next Page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-600">
          {currentPageRegions.length} region{currentPageRegions.length !== 1 ? "s" : ""} detected
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-900 p-4"
        style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'center',
          minHeight: 0 
        }}
      >
        <div style={{ position: "relative", display: "inline-block" }}>
          {/* Image Layer */}
          <canvas ref={imageCanvasRef} style={{ display: "block" }} />

          {/* Bounding Box Overlay Layer */}
          <canvas
            ref={overlayCanvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-wrap gap-3">
          {currentPageRegions.map((region, index) => {
            const color = REGION_COLORS[region.region_name] || REGION_COLORS.default;
            return (
              <div key={`${region.region_name}-${index}`} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-700">
                  {region.region_name} ({(region.confidence * 100).toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};