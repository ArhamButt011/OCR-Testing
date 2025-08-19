// lib/fetchOCRData.js

export async function fetchOCRData(pdfUrl) {
    // const ocrApiUrl = process.env.NEXT_PUBLIC_OCR_API_URL;
    const ocrApiUrl = "";

    const res = await fetch("/api/ipAddress/ip-address");
    const data = await res.json();
    if (data.ip) {
        ocrApiUrl = `http://${data.ip}:8080/run-ocr`;
    }

    if (!ocrApiUrl) {
        throw new Error("OCR API URL is not defined in the environment variables");
    }

    const timeout = 180000; // 3 minutes timeout

    const fetchWithTimeout = (url, options, timeout) => {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("OCR API call timed out")), timeout)
            )
        ]);
    };

    try {
        const response = await fetchWithTimeout(ocrApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ file_url_or_path: pdfUrl }),
        }, timeout);

        if (!response.ok) {
            throw new Error("OCR API call failed");
        }

        return await response.json();
    } catch (error) {
        console.error("Error during OCR API call:", error);
        throw error;
    }
}
