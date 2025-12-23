export function getFileNameFromUrl(pdfUrl:string | undefined) {
  if (!pdfUrl || typeof pdfUrl !== "string") return "";
  return pdfUrl.split("/").pop() || "";
}
