import React from "react";

/**
 * Parses text with HTML-like tags (<b>, <i>, <u>, <s>) and converts them to React elements
 * Supports nested tags like <b><i>text</i></b>
 * @param text - The text string containing formatting tags
 * @returns React element(s) with proper formatting applied
 */
export function formatTextWithTags(text: string): React.ReactNode {
  if (!text || typeof text !== "string") {
    return text;
  }

  let keyCounter = 0;

  // Recursive function to parse tags
  const parseRecursive = (str: string): React.ReactNode => {
    // Find the first opening tag
    const openMatch = str.match(/<(b|i|u|s)>/);
    if (!openMatch) {
      return str; // No more tags, return as-is
    }

    const openIndex = openMatch.index!;
    const tag = openMatch[1];
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;

    // Find matching closing tag (handles nested tags of the same type)
    let depth = 1;
    let closeIndex = openIndex + openTag.length;
    while (depth > 0 && closeIndex < str.length) {
      const nextOpen = str.indexOf(openTag, closeIndex);
      const nextClose = str.indexOf(closeTag, closeIndex);

      if (nextClose === -1) {
        // No closing tag found, treat as plain text
        return str;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        closeIndex = nextOpen + openTag.length;
      } else {
        depth--;
        if (depth === 0) {
          closeIndex = nextClose;
          break;
        }
        closeIndex = nextClose + closeTag.length;
      }
    }

    if (depth !== 0) {
      // Unmatched tag, return as plain text
      return str;
    }

    // Extract parts
    const before = str.substring(0, openIndex);
    const inner = str.substring(openIndex + openTag.length, closeIndex);
    const after = str.substring(closeIndex + closeTag.length);

    // Recursively parse inner content
    const innerContent = parseRecursive(inner);

    // Apply formatting
    let formattedInner: React.ReactNode;
    const key = `fmt-${tag}-${keyCounter++}`;
    if (tag === "b") {
      formattedInner = <strong key={key}>{innerContent}</strong>;
    } else if (tag === "i") {
      formattedInner = <em key={key}>{innerContent}</em>;
    } else if (tag === "u") {
      formattedInner = <u key={key}>{innerContent}</u>;
    } else if (tag === "s") {
      formattedInner = <s key={key}>{innerContent}</s>;
    } else {
      formattedInner = innerContent;
    }

    // Combine parts
    const beforeContent = before ? parseRecursive(before) : null;
    const afterContent = after ? parseRecursive(after) : null;

    const result: React.ReactNode[] = [];
    if (beforeContent) result.push(beforeContent);
    result.push(formattedInner);
    if (afterContent) result.push(afterContent);

    return result.length === 1 ? (
      result[0]
    ) : (
      <React.Fragment>{result}</React.Fragment>
    );
  };

  return parseRecursive(text);
}
