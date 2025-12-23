import React, { useState } from "react";
import { getTruncatedText } from "@/lib/truncate";

interface FileNameCellProps {
  pdfUrl?: string;
  fileId?: string;
  className?: string;
}

const FileNameUnregistered = ({ pdfUrl, fileId, className }: FileNameCellProps) => {
  const [showFull, setShowFull] = useState(false);

  const fileName = pdfUrl?.split("/").pop() || fileId || "No PDF Available";
  const { displayText, isTruncated } = getTruncatedText(fileName, 15, showFull);

  return (
    <div
      className={`py-2 px-4 ${
        className ? className : "left-44"
      } sticky text-center bg-white z-10 min-w-44 max-w-44 cursor-pointer ${
        isTruncated ? "truncate" : "whitespace-normal break-words"
      }`}
      onClick={() => setShowFull((prev) => !prev)}
      title={!showFull ? "Click to show full name" : "Click to hide"}
    >
      {displayText}
  </div>
  );
};

export default FileNameUnregistered;
