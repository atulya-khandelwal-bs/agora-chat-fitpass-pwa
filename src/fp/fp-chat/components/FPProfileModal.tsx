import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Contact } from "../../common/types/chat";
import {
  fetchDietitianDetails,
  type DietitianApiResponse,
} from "../services/dietitianApi";
import config from "../../common/config.ts";

interface FPProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContact: Contact | null;
  scheduledCallFromApi?: {
    date: string;
    start_time: string;
    call_date_time: number;
    schedule_call_id: number;
    call_type?: "video" | "audio";
  } | null;
  onCancelCall?: () => void;
  onScheduleCall?: () => void;
}

export default function FPProfileModal({
  isOpen,
  onClose,
  selectedContact,
  scheduledCallFromApi,
  onCancelCall,
  onScheduleCall,
}: FPProfileModalProps): React.JSX.Element | null {
  const [dietitianData, setDietitianData] =
    useState<DietitianApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(true);
  const [imageError, setImageError] = useState<boolean>(false);

  // Fetch dietitian details when modal opens
  useEffect(() => {
    if (isOpen && selectedContact) {
      loadDietitianDetails();
      // Reset image loading state when modal opens
      setImageLoading(true);
      setImageError(false);
    }
  }, [isOpen, selectedContact]);

  const loadDietitianDetails = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchDietitianDetails();
      setDietitianData(data);
    } catch (err) {
      console.error("Error fetching dietitian details:", err);
      setError("Failed to load dietitian details");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !selectedContact) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Format scheduled date and time from scheduledCallFromApi
  const formatScheduledDateTime = (): string => {
    if (!scheduledCallFromApi) return "";

    const scheduledDate = new Date(scheduledCallFromApi.call_date_time * 1000);
    const now = new Date();

    // Only show if scheduled time is in the future
    if (scheduledDate <= now) return "";

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const day = scheduledDate.getDate();
    const month = monthNames[scheduledDate.getMonth()];
    const year = scheduledDate.getFullYear();
    const hours = scheduledDate.getHours();
    const minutes = scheduledDate.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const displayMinutes = minutes.toString().padStart(2, "0");

    return `${day} ${month}, ${year} ${displayHours}:${displayMinutes} ${period}`;
  };

  // Check if there's a valid scheduled call (exists and is in the future)
  // Must match the same validation as getScheduledCall() in FPChatInterface
  const hasScheduledCall = (): boolean => {
    if (
      !scheduledCallFromApi ||
      !scheduledCallFromApi.call_date_time ||
      !scheduledCallFromApi.date ||
      !scheduledCallFromApi.start_time
    ) {
      return false;
    }
    const scheduledDate = new Date(scheduledCallFromApi.call_date_time * 1000);
    const now = new Date();
    return scheduledDate > now;
  };

  // Get profile photo URL from API or selectedContact
  const getProfilePhotoUrl = (): string | null => {
    // First try to get from API response
    const apiPhoto = dietitianData?.result?.dietitian_details?.dietitian_photo;
    if (apiPhoto && apiPhoto.trim() !== "" && apiPhoto !== "image_url") {
      return apiPhoto;
    }

    // Fallback to selectedContact avatar
    if (
      selectedContact?.avatar &&
      selectedContact.avatar.trim() !== "" &&
      selectedContact.avatar !== "image_url"
    ) {
      return selectedContact.avatar;
    }

    return null;
  };

  const profilePhotoUrl = getProfilePhotoUrl();
  // Show loader if:
  // 1. API is still loading, OR
  // 2. We have a photo URL but image is still loading, OR
  // 3. We have a photo URL but image failed to load (show loader as fallback), OR
  // 4. We don't have a photo URL and API is done loading (no photo available from API)
  const shouldShowLoader =
    loading ||
    (profilePhotoUrl
      ? imageLoading || imageError
      : !loading && !error && !profilePhotoUrl);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 10000,
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={handleBackdropClick}
      />
      {/* Modal - Bottom Sheet */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          zIndex: 10001,
          padding: "2rem 1.5rem",
          paddingBottom: "2rem",
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
          animation: "slideUpFromBottom 0.3s ease-out",
          maxHeight: "70%",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "1.5rem",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Profile Photo or Loading Spinner */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100px",
              height: "100px",
              marginBottom: "1.5rem",
            }}
          >
            {/* Dotted green circle */}
            <div
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                border: "3px dashed #10b981",
                padding: "3px",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {profilePhotoUrl ? (
                <>
                  {/* Profile Photo - positioned absolutely to fill the circle */}
                  <img
                    src={profilePhotoUrl}
                    alt={
                      dietitianData?.result?.dietitian_details
                        ?.dietitian_name || selectedContact.name
                    }
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onLoad={() => {
                      setImageLoading(false);
                      setImageError(false);
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      setImageLoading(false);
                      if (target.src !== config.defaults.avatar) {
                        target.src = config.defaults.avatar;
                        setImageError(false);
                      } else {
                        setImageError(true);
                        target.style.display = "none";
                      }
                    }}
                  />
                  {/* Loading spinner - centered by flexbox */}
                  {shouldShowLoader && (
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        border: "3px solid #e5e7eb",
                        borderTopColor: "#9ca3af",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  )}
                </>
              ) : (
                /* Show loader if no photo URL available */
                shouldShowLoader && (
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      border: "3px solid #e5e7eb",
                      borderTopColor: "#9ca3af",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )
              )}
            </div>
          </div>

          {/* Name */}
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              color: "#111827",
              textAlign: "center",
              marginBottom: "1.5rem",
            }}
          >
            {dietitianData?.result?.dietitian_details?.dietitian_name ||
              selectedContact.name}
          </h2>

          {/* Statistics */}
          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "2rem",
                color: "#6b7280",
              }}
            >
              Loading...
            </div>
          ) : error ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "2rem",
                color: "#dc2626",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          ) : dietitianData?.result?.dietitian_details ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0",
                marginBottom: "1.5rem",
                flexWrap: "nowrap",
              }}
            >
              {dietitianData.result.dietitian_details.avg_rating !==
                undefined && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0 1rem",
                    borderRight: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {dietitianData.result.dietitian_details.avg_rating.toFixed(
                      2
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    Ratings
                  </div>
                </div>
              )}
              {dietitianData.result.dietitian_details.number_consultations && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0 1.5rem",
                    borderRight: dietitianData.result.dietitian_details
                      .dietitian_experience
                      ? "1px solid #e5e7eb"
                      : "none",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {
                      dietitianData.result.dietitian_details
                        .number_consultations
                    }
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    Consultations
                  </div>
                </div>
              )}
              {dietitianData.result.dietitian_details.dietitian_experience && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0 1.5rem",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {
                      dietitianData.result.dietitian_details
                        .dietitian_experience
                    }
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    Experience
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Horizontal Line */}
          {dietitianData?.result?.dietitian_details && (
            <div
              style={{
                width: "100%",
                height: "1px",
                backgroundColor: "#e5e7eb",
                marginBottom: "1.5rem",
              }}
            />
          )}

          {/* Schedule Call Button or Scheduled Call Confirmation */}
          {hasScheduledCall() ? (
            <>
              {/* Scheduled Call Confirmation */}
              <div
                style={{
                  marginBottom: "1.5rem",
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "#111827",
                    lineHeight: "1.5",
                  }}
                >
                  Your call has been scheduled with{" "}
                  <strong>
                    {dietitianData?.result?.dietitian_details?.dietitian_name ||
                      selectedContact.name}{" "}
                    at {formatScheduledDateTime()}
                  </strong>
                </p>
              </div>

              {/* Cancel Call Button */}
              {onCancelCall && (
                <button
                  onClick={async () => {
                    try {
                      await onCancelCall();
                    } catch (error) {
                      console.error("Error cancelling call:", error);
                      // You might want to show an error message to the user here
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.875rem 2rem",
                    border: "none",
                    borderRadius: "8px",
                    backgroundColor: "#DC4144",
                    color: "#ffffff",
                    fontSize: "16px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#b91c1c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#dc2626";
                  }}
                >
                  Cancel Call
                </button>
              )}
            </>
          ) : (
            /* Schedule Call Button */
            onScheduleCall && (
              <button
                onClick={onScheduleCall}
                style={{
                  width: "100%",
                  padding: "0.875rem 2rem",
                  border: "none",
                  borderRadius: "8px",
                  backgroundColor: "#DC4144",
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#b91c1c";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#dc2626";
                }}
              >
                Schedule a Call
              </button>
            )
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUpFromBottom {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
