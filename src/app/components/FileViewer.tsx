'use client';

import React from 'react';

type Props = {
  base64Data: string;
  mimeType: string;
};

const FileViewer = ({ base64Data, mimeType }: Props) => {
  const getMimePrefix = () => {
    switch (mimeType.toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      default:
        return 'application/octet-stream'; // fallback
    }
  };

  const src = `data:${getMimePrefix()};base64,${base64Data}`;

  // Render based on type
  if (mimeType === 'pdf') {
    return (
      <iframe
        src={src}
        width="100%"
        height="800px"
        title="PDF Viewer"
        style={{ border: 'none' }}
      />
    );
  }

  // For images
  return (
    <img
      src={src}
      alt="Preview"
      style={{ maxWidth: '100%', maxHeight: '800px', display: 'block' }}
    />
  );
};

export default FileViewer;
