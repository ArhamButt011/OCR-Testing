// lib/fetchPdf.js

export async function fetchPdfUrls() {
    try {
        const response = await fetch("https://hanneskonzept.ml-bench.com/public/api/pdf-files");

        if (!response.ok) {
            throw new Error('Failed to fetch PDF URLs');
        }

        const data = await response.json();
        
        // Return the array of file URLs
        return data.file_urls || [];  // Default to an empty array if no URLs are returned
    } catch (error) {
        console.error("Error fetching PDF URLs:", error);
        throw error;
    }
}
