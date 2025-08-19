export function getFileExtension(filename: string): string {
  const extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();

  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'tiff':
    case 'tif':
      return 'image/tiff';
    default:
      return 'application/octet-stream'; // Default for unknown file types
  }
}
