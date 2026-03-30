import React from "react";

interface FP404ErrorProps {
  message?: string;
  onRetry?: () => void;
}

export default function FP404Error({
  message = "Dietitian not found",
  onRetry,
}: FP404ErrorProps): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        width: "100%",
        padding: "2rem",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "500px",
        }}
      >
        {/* 404 Number */}
        <div
          style={{
            fontSize: "8rem",
            fontWeight: 700,
            color: "#000000",
            lineHeight: 1,
            marginBottom: "1rem",
          }}
        >
          404
        </div>

        {/* Error Message */}
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "#111827",
            marginBottom: "0.5rem",
          }}
        >
          {message}
        </h1>

        <p
          style={{
            fontSize: "1rem",
            color: "#6b7280",
            marginBottom: "2rem",
            lineHeight: 1.5,
          }}
        >
          The dietitian ID you're looking for doesn't exist or is incorrect.
          Please check the URL and try again.
        </p>

        {/* Retry Button */}
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: "#109310",
              color: "#ffffff",
              border: "none",
              padding: "0.75rem 1.5rem",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#0d7a0d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#109310";
            }}
          >
            Try Again
          </button>
        )}

        {/* Home/Back Button */}
        <div style={{ marginTop: "1.5rem" }}>
          <button
            onClick={() => {
              window.location.href = window.location.origin;
            }}
            style={{
              background: "transparent",
              color: "#000000",
              border: "1px solid #6b7280",
              padding: "0.75rem 1.5rem",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#6b7280";
              e.currentTarget.style.color = "#000000";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#6b7280";
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}
