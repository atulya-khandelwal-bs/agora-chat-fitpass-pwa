import React from "react";

interface FPFileMessageViewProps {
  fileUrl?: string;
  fileName?: string;
  fileMime?: string;
  fileSizeBytes?: number;
  fileSize?: string;
  isIncoming?: boolean;
  icons_details?: {
    left_icon?: string;
    right_icon?: string;
  };
  redirection_details?: Array<{
    cta_details?: {
      text?: string;
      text_color?: string;
      bg_color?: string;
    };
    redirect_url?: string;
    action_id?: string;
  }>;
}

export default function FPFileMessageView({
  fileUrl,
  fileName,
  fileMime,
  fileSizeBytes,
  fileSize,
  isIncoming = false,
  icons_details: _icons_details,
  redirection_details,
}: FPFileMessageViewProps): React.JSX.Element {
  // Get first redirect URL if available (use it if fileUrl is not available)
  const redirectUrl = redirection_details?.[0]?.redirect_url;

  const handleClick = (): void => {
    // Only handle click if there's a redirect URL and no fileUrl
    if (redirectUrl && !fileUrl) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (
        redirectUrl.startsWith("http://") ||
        redirectUrl.startsWith("https://")
      ) {
        if (isIOS) {
          // On iOS: Open in same tab to avoid duplicate tab issue
          window.location.href = redirectUrl;
        } else {
          // On other platforms: Open in new tab without back history
          const newWindow = window.open("about:blank", "_blank");
          if (newWindow) {
            newWindow.opener = null;
            newWindow.location.replace(redirectUrl);
          } else {
            window.open(redirectUrl, "_blank", "noopener,noreferrer");
          }
        }
      } else {
        window.location.href = redirectUrl;
      }
    }
  };
  // Format file size
  const formatFileSize = (): string => {
    if (fileSizeBytes != null) {
      if (fileSizeBytes < 1024) {
        // Less than 1 KB - show in bytes
        return `${fileSizeBytes} B`;
      }
      const kb = fileSizeBytes / 1024;
      if (kb >= 1024) {
        // 1 MB or more
        return `${(kb / 1024).toFixed(1)} MB`;
      }
      // Between 1 KB and 1 MB
      return `${Math.round(kb)} KB`;
    }
    if (fileSize) {
      return `${fileSize} KB`;
    }
    return "";
  };

  // Get file type label
  const fileTypeLabel = fileMime && fileMime.includes("pdf") ? "PDF" : "FILE";

  // Truncate file name if too long
  const displayFileName = (() => {
    const name = fileName || fileUrl || "File";
    const maxLength = 40; // Adjust as needed
    if (name.length > maxLength) {
      return `${name.substring(0, maxLength)}...`;
    }
    return name;
  })();

  const fileSizeText = formatFileSize();
  const sizeAndTypeText = fileSizeText
    ? `${fileSizeText} ${fileTypeLabel}`
    : fileTypeLabel;

  // Colors based on incoming/outgoing
  const bgColor = isIncoming ? "#E5E7EB" : "#109310";
  const textColor = isIncoming ? "#111827" : "#FFFFFF";
  const iconColor = isIncoming ? "#000" : "#FFFFFF";
  const iconFill = isIncoming ? "#E5E7EB" : "white";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px",
        background: bgColor,
        borderRadius: "8px",
        maxWidth: "380px",
        border: isIncoming ? "1px solid #E5E7EB" : "none",
        cursor:
          redirectUrl && !fileUrl ? "pointer" : fileUrl ? "pointer" : "default",
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        if (redirectUrl && !fileUrl) {
          handleClick();
        } else if (fileUrl) {
          if (isIOS) {
            // On iOS: Open in same tab to avoid duplicate tab issue
            // User can use browser back button to return
            window.location.href = fileUrl;
          } else {
            // On other platforms: Open in new tab without back history
            const newWindow = window.open("about:blank", "_blank");
            if (newWindow) {
              newWindow.opener = null;
              newWindow.location.replace(fileUrl);
            } else {
              window.open(fileUrl, "_blank", "noopener,noreferrer");
            }
          }
        }
      }}
    >
      {/* Document Icon */}
      <div
        style={{
          width: "40px",
          height: "40px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <defs>
            <mask id={`fileFoldCut-${isIncoming ? "in" : "out"}`}>
              <rect width="24" height="24" fill="white" />
              {/* Cut part (more vertical, less horizontal) */}
              <path d="M14 2v7h5z" fill="black" />
            </mask>
          </defs>

          {/* Filled file body WITH CUT FOLD */}
          <path
            d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
            fill={iconFill}
            mask={`url(#fileFoldCut-${isIncoming ? "in" : "out"})`}
          />

          {/* Outline */}
          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />

          {/* Fold line (match reduced horizontal size) */}
          <path d="M14 2v6a1 1 0 0 0 1 1h4" />
        </svg>
      </div>

      {/* File Info Text */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          minWidth: 0,
        }}
      >
        {/* File name */}
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: textColor,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={fileName || fileUrl || "File"}
        >
          {displayFileName}
        </div>
        {/* File size and type */}
        <div
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: textColor,
            textAlign: "left",
          }}
        >
          {sizeAndTypeText}
        </div>
      </div>

      {/* Download Icon */}
      {fileUrl && (
        <div
          style={{
            width: "24px",
            height: "24px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={iconColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
      )}
    </div>
  );
}
