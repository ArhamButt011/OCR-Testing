import React, { useState } from "react";
import { getTruncatedText } from "@/lib/truncate"; 

interface FileNameCellProps {
  pdfUrl?: string;
  fileId?: string;
}

const FileNameCell = ({ pdfUrl, fileId }: FileNameCellProps) => {
  const [showFull, setShowFull] = useState(false);

  const fileName = pdfUrl?.split("/").pop() || fileId || "No PDF Available";
  const { displayText, isTruncated } = getTruncatedText(fileName, 15, showFull);

  return (
    <td
      className={`py-2 px-4 border-b text-center sticky left-44 bg-white z-10 min-w-44 max-w-44 cursor-pointer ${
        isTruncated ? "truncate" : "whitespace-normal break-words"
      }`}
      onClick={() => setShowFull((prev) => !prev)}
      title={!showFull ? "Click to show full name" : "Click to hide"}
    >
      {displayText}
    </td>
  );
};

export default FileNameCell;
