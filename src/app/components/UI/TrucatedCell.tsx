// components/UI/TruncatedCell.tsx
import { useState } from "react";
import { getTruncatedText } from "@/lib/truncate";

interface TruncatedCellProps {
  value: string;
  maxLength?: number;
}

const TruncatedCell = ({ value, maxLength = 15 }: TruncatedCellProps) => {
  const [showFull, setShowFull] = useState(false);
  const { displayText, isTruncated } = getTruncatedText(value, maxLength, showFull);

  return (
    <td
      className={`py-2 px-4 border-b min-w-44 max-w-44 text-center bg-white z-50 cursor-pointer ${
        isTruncated ? "truncate" : "whitespace-normal break-words"
      }`}
      onClick={() => setShowFull((prev) => !prev)}
      title={!showFull ? "Click to show full name" : "Click to hide"}
    >
      {displayText}
    </td>
  );
};

export default TruncatedCell;
