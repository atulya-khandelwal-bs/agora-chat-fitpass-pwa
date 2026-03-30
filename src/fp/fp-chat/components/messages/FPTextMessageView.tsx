import React from "react";
interface FPTextMessageViewProps {
  content: string | object | null | undefined;
}

export default function FPTextMessageView({
  content,
}: FPTextMessageViewProps): React.JSX.Element {
  // Ensure content is always a string
  const contentToRender =
    typeof content === "string"
      ? content
      : typeof content === "object"
      ? (content as { body?: string }).body || JSON.stringify(content)
      : String(content || "");

  return <div className="message-text">{contentToRender}</div>;
}
