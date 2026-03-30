import ForkKnifeIcon from "../../assets/ForkKnife.svg";
import type { Message } from "../../../common/types/chat";
import React from "react";

interface FPDefaultSystemMessageViewProps {
  msg: Message;
}

export default function FPDefaultSystemMessageView({
  msg,
}: FPDefaultSystemMessageViewProps): React.JSX.Element {
  const contentText =
    typeof msg.content === "string"
      ? msg.content
      : typeof msg.content === "object"
      ? (msg.content as { body?: string }).body || JSON.stringify(msg.content)
      : String(msg.content || "");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        position: "relative",
        margin: "0.5rem 0",
      }}
    >
      {/* Left line */}
      <div
        style={{
          flex: 1,
          height: "1px",
          background: "#E5E7EB",
        }}
      />
      {/* Message bubble */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          margin: "0 12px",
          background: "#f3f4f6",
          color: "#111827",
          borderRadius: "9999px",
          padding: "0.4rem 0.75rem",
          width: "fit-content",
          boxShadow: "inset 0 0 0 1px #e5e7eb",
          position: "relative",
          zIndex: 1,
        }}
      >
        <img
          src={ForkKnifeIcon}
          alt="Fork and knife"
          style={{
            width: "16px",
            height: "16px",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
          {contentText}
        </span>
        <span aria-hidden style={{ marginLeft: 4, color: "#9ca3af" }}>
          ›
        </span>
      </div>
      {/* Right line */}
      <div
        style={{
          flex: 1,
          height: "1px",
          background: "#E5E7EB",
        }}
      />
    </div>
  );
}
