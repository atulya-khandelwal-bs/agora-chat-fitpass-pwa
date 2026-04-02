import type { Product } from "../../../common/types/chat";
import React from "react";
interface FPProductMessageViewProps {
  products: Product[];
  formatCurrency: (amount: number) => string;
}

export default function FPProductMessageView({
  products,
  formatCurrency,
}: FPProductMessageViewProps): React.JSX.Element | null {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        maxWidth: "100%",
        width: "100%",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Recommended products heading */}
      <div
        style={{
          fontSize: "14px",
          fontWeight: 500,
          color: "#6C7985",
          textAlign: "left",
        }}
      >
        Recommended products
      </div>

      {/* Horizontal scrollable row - each product as separate card */}
      <div
        className="fp-product-scroll"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "12px",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          paddingBottom: "4px",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {products.map((p, index) => {
          const productName = p.title || "Product";
          const productImage =
            (p as Product & { image?: string; imageUrl?: string }).image ||
            (p as Product & { image?: string; imageUrl?: string }).image_url;
          const currentPrice = p.selling_amount || p.actual_amount || 0;
          const originalPrice =
            p.actual_amount &&
            p.selling_amount &&
            p.actual_amount !== p.selling_amount
              ? p.actual_amount
              : null;

          return (
            <div
              key={p.action_id || `${p.title}-${index}`}
              style={{
                display: "flex",
                flexDirection: "row",
                gap: "12px",
                background: "#e5e7eb",
                borderRadius: "8px",
                padding: "6px",
                boxShadow: "0px 1px 3px 0px rgba(0, 0, 0, 0.1)",
                cursor: "pointer",
                width: "280px",
                minWidth: "280px",
                flexShrink: 0,
              }}
              onClick={() => {
                // Handle product click - redirect to product URL
                if (p.rediection_url) {
                  window.open(
                    p.rediection_url,
                    "_blank",
                    "noopener,noreferrer"
                  );
                } else {
                }
              }}
            >
              {/* Product Image - Left Side with White Background */}
              <div
                style={{
                  width: "112px",
                  height: "140px",
                  minWidth: "80px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "#F3F4F6",
                  border: "1px solid #E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {productImage ? (
                  <>
                    <img
                      src={productImage}
                      alt={productName}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                          const placeholder = parent.querySelector(
                            ".product-image-placeholder"
                          ) as HTMLElement;
                          if (placeholder) {
                            placeholder.style.display = "flex";
                          }
                        }
                      }}
                    />
                    <div
                      className="product-image-placeholder"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "none",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#9CA3AF",
                        fontSize: "24px",
                      }}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{ marginBottom: "4px" }}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span style={{ fontSize: "10px", fontWeight: 500 }}>
                        No Image
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#9CA3AF",
                      fontSize: "24px",
                    }}
                  >
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ marginBottom: "4px" }}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span style={{ fontSize: "10px", fontWeight: 500 }}>
                      No Image
                    </span>
                  </div>
                )}
              </div>

              {/* Product Info - Right Side */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  overflow: "hidden",
                  gap: "4px",
                  position: "relative",
                  textAlign: "left",
                }}
              >
                {/* Title */}
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    lineHeight: "1.2em",
                    color: "#0A1F34",
                    marginBottom: "4px",
                  }}
                >
                  {productName}
                </div>

                {/* Description - max 2 lines, ellipsis, must not overflow into price */}
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 400,
                    lineHeight: "1.4em",
                    color: "#6C7985",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginBottom: "8px",
                    maxHeight: "2.8em",
                    flexShrink: 0,
                  }}
                >
                  {p.description || ""}
                </div>

                {/* Bottom Row: Price on Left, Arrow on Right */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "auto",
                    flexShrink: 0,
                  }}
                >
                  {/* Price Section - Left */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        lineHeight: "1em",
                        color: "#0A1F34",
                      }}
                    >
                      {formatCurrency(currentPrice)}
                    </div>
                    {originalPrice && (
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 400,
                          lineHeight: "1em",
                          color: "#6C7985",
                          textDecoration: "line-through",
                        }}
                      >
                        {formatCurrency(originalPrice)}
                      </div>
                    )}
                  </div>

                  {/* CTA Button or Arrow - Right */}
                  {p.cta_details?.text ||
                  (p.cta_details?.text_color &&
                    (!p.cta_details?.text ||
                      p.cta_details.text.trim() === "")) ? (
                    (() => {
                      // Button text: use text if available and not empty, otherwise use text_color as fallback
                      const buttonText =
                        p.cta_details?.text && p.cta_details.text.trim() !== ""
                          ? p.cta_details.text
                          : p.cta_details?.text_color || "View";

                      // Background color: use bg_color from cta_details with fallback
                      const bgColor = p.cta_details?.bg_color || "#2563eb";

                      // Text color logic:
                      // - If text exists and is not empty: text_color is the actual text color
                      // - If text doesn't exist or is empty: text_color is the button label, so determine text color based on background
                      let textColor = "#FFFFFF"; // Default

                      if (
                        p.cta_details?.text &&
                        p.cta_details.text.trim() !== ""
                      ) {
                        // text exists and is not empty, so text_color is the actual text color
                        textColor = p.cta_details.text_color || "#FFFFFF";
                      } else {
                        // text doesn't exist or is empty, text_color is the button label
                        // Determine text color based on background brightness
                        const isLightBackground =
                          !bgColor ||
                          bgColor === "" ||
                          bgColor === "#FFFFFF" ||
                          bgColor === "#FFF" ||
                          bgColor.toLowerCase() === "white";
                        textColor = isLightBackground ? "#000000" : "#FFFFFF";
                      }

                      // Calculate hover color (darker shade of bg_color)
                      const getHoverColor = (color: string): string => {
                        if (
                          !color ||
                          color === "" ||
                          color === "#FFFFFF" ||
                          color === "#FFF" ||
                          color.toLowerCase() === "white"
                        ) {
                          return "#e5e7eb"; // Light gray hover for white/empty buttons
                        }
                        // Convert hex to RGB and darken by 10%
                        try {
                          const hex = color.replace("#", "");
                          if (
                            hex.length === 6 &&
                            /^[0-9A-Fa-f]{6}$/.test(hex)
                          ) {
                            const r = parseInt(hex.substring(0, 2), 16);
                            const g = parseInt(hex.substring(2, 4), 16);
                            const b = parseInt(hex.substring(4, 6), 16);
                            const darken = (val: number) =>
                              Math.max(0, Math.floor(val * 0.9));
                            return `rgb(${darken(r)}, ${darken(g)}, ${darken(
                              b
                            )})`;
                          }
                        } catch {
                          // If parsing fails, return default
                        }
                        return "#0d7a0d"; // Default hover color
                      };

                      const hoverColor = getHoverColor(bgColor);

                      return (
                        <button
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 500,
                            background: bgColor,
                            color: textColor,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            transition: "all 0.2s",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: "vertical" as const,
                            lineHeight: "1.4",
                            wordBreak: "break-word",
                            minWidth: 0,
                            maxHeight: "none",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle redirect - navigate to product URL
                            if (p.rediection_url) {
                              if (
                                p.rediection_url.startsWith("http://") ||
                                p.rediection_url.startsWith("https://")
                              ) {
                                window.open(
                                  p.rediection_url,
                                  "_blank",
                                  "noopener,noreferrer"
                                );
                              } else {
                                window.location.href = p.rediection_url;
                              }
                            } else {
                            }
                          }}
                          onMouseEnter={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = hoverColor;
                          }}
                          onMouseLeave={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = bgColor;
                          }}
                          aria-label={buttonText}
                        >
                          {buttonText}
                        </button>
                      );
                    })()
                  ) : (
                    <button
                      style={{
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle redirect - navigate to product URL
                        if (p.rediection_url) {
                          window.open(
                            p.rediection_url,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        } else {
                        }
                      }}
                      aria-label="View product details"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6 4L10 8L6 12"
                          stroke="#232534"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
