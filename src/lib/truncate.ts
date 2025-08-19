
export function getTruncatedText(text: string, maxLength: number, showFull: boolean): {
  displayText: string;
  isTruncated: boolean;
} {
  const isTruncated = text.length > maxLength && !showFull;
  const displayText = isTruncated ? text.substring(0, maxLength) + "..." : text;
  return { displayText, isTruncated };
}
