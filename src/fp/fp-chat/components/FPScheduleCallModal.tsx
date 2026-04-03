import React, { useState, useEffect, useRef } from "react";
import { X, Phone, Calendar } from "lucide-react";

const MODAL_FONT =
  '"Figtree", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const C1 = "#0A1F34";
const C2 = "#6C7985";
const C4 = "#E7E9EB";
const BRAND_RED = "#DC4144";
const GREEN = "#109310";
const TOPIC_BORDER = "rgba(10, 31, 52, 0.08)";
const MODAL_PAD_X = "calc(20px + env(safe-area-inset-left, 0px))";
const MODAL_PAD_RIGHT = "calc(20px + env(safe-area-inset-right, 0px))";
import type { Contact } from "../../common/types/chat";
import config from "../../common/config.ts";
import {
  fetchDietitianDetails,
  scheduleCallWithDietitian,
  type DietitianApiResponse,
} from "../services/dietitianApi";
import { sendCustomMessage } from "../services/chatApi";

interface FPScheduleCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (
    date: Date,
    time: string,
    topics: string[],
    callType: "video" | "audio"
  ) => void;
  selectedContact: Contact | null;
  userId: string;
  /** Peer (dietitian) id — same value for `targetUserId` and `receiverId` on send-custom-message. */
  peerId: string;
  /** Agora group id — required to notify chat when scheduling. */
  groupId: string | null;
  scheduledCallFromApi?: {
    date: string;
    start_time: string;
    call_date_time: number;
    schedule_call_id: number;
  } | null;
  onCancelCall?: () => void;
}

export default function FPScheduleCallModal({
  isOpen,
  onClose,
  onSchedule,
  selectedContact,
  userId,
  peerId,
  groupId,
  scheduledCallFromApi,
  onCancelCall,
}: FPScheduleCallModalProps): React.JSX.Element | null {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [callType, setCallType] = useState<"Video" | "Voice">("Video");
  const [dietitianData, setDietitianData] =
    useState<DietitianApiResponse | null>(null);
  const [_loading, setLoading] = useState<boolean>(false); // Loading state kept for potential future UI use
  const [scheduling, setScheduling] = useState<boolean>(false);
  const scrollableContentRef = useRef<HTMLDivElement>(null);

  // Fetch when the modal opens for this contact — use contact id only so parent re-renders
  // (new Contact object references) and scheduled-call polling do not retrigger this API in a loop.
  useEffect(() => {
    if (!isOpen || !selectedContact?.id) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    const load = async (): Promise<void> => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const callDate = Math.floor(today.getTime() / 1000);
        const data = await fetchDietitianDetails(callDate);
        if (!cancelled) {
          setDietitianData(data);
        }
      } catch {
        // keep prior dietitianData on failure
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedContact?.id]);

  // Available topics from API only
  const topics = dietitianData?.result?.tags || [];

  const toggleTopic = (topic: string): void => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  // Generate dates from health_coach_schedules (include ALL dates, including those with no slots)
  const getDates = (): Array<{
    date: Date;
    dayLabel: string;
    dayNumber: number;
    month: string;
    isToday: boolean;
  }> => {
    const dates: Array<{
      date: Date;
      dayLabel: string;
      dayNumber: number;
      month: string;
      isToday: boolean;
    }> = [];

    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use health_coach_schedules from API - include ALL dates (with or without slots)
    if (
      dietitianData?.result?.health_coach_schedules &&
      dietitianData.result.health_coach_schedules.length > 0
    ) {
      // Use all schedules, do not filter by available slots
      const allSchedules = dietitianData.result.health_coach_schedules;

      // Convert date strings to Date objects and sort
      const sortedDates = allSchedules
        .map((schedule) => {
          // Parse YYYY-MM-DD and create Date object
          const [year, month, day] = schedule.date.split("-").map(Number);
          return new Date(year, month - 1, day);
        })
        .sort((a, b) => a.getTime() - b.getTime());

      sortedDates.forEach((date) => {
        const isToday = date.toDateString() === today.toDateString();
        const dayLabel = isToday ? "TODAY" : dayNames[date.getDay()];
        const dayNumber = date.getDate();
        const month = monthNames[date.getMonth()];

        dates.push({ date, dayLabel, dayNumber, month, isToday });
      });
    }

    return dates;
  };

  const dates = getDates();

  // Helper function to parse time string to minutes for sorting
  const parseTime = (timeStr: string): number => {
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let totalMinutes = hours * 60 + minutes;
    if (period === "pm" && hours !== 12) {
      totalMinutes += 12 * 60;
    } else if (period === "am" && hours === 12) {
      totalMinutes -= 12 * 60;
    }
    return totalMinutes;
  };

  // Helper function to format date as YYYY-MM-DD without timezone issues
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get time slots from API based on selected date using health_coach_schedules
  const getTimeSlots = (): string[] => {
    if (!selectedDate) return [];

    // Format selected date as YYYY-MM-DD (avoid timezone issues with toISOString)
    const selectedDateStr = formatDateString(selectedDate);

    // Use health_coach_schedules from API
    if (dietitianData?.result?.health_coach_schedules) {
      const scheduleForDate = dietitianData.result.health_coach_schedules.find(
        (schedule) => schedule.date === selectedDateStr
      );

      if (
        scheduleForDate &&
        scheduleForDate.slots &&
        scheduleForDate.slots.length > 0
      ) {
        const timeSlots = scheduleForDate.slots.map((slot) => slot.start_time);
        // Sort time slots to ensure correct order
        return timeSlots.sort((a, b) => {
          const timeA = parseTime(a);
          const timeB = parseTime(b);
          return timeA - timeB;
        });
      }
    }

    // No time slots available
    return [];
  };

  const timeSlots = getTimeSlots();

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(null);
      setSelectedTime("");
      setSelectedTopics([]);
      setCallType("Video");
    }
  }, [isOpen]);

  // Auto-select first available date when data loads
  useEffect(() => {
    if (isOpen && !selectedDate && dietitianData) {
      const availableDates = getDates();
      if (availableDates.length > 0) {
        setSelectedDate(availableDates[0].date);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dietitianData, selectedDate]);

  // Auto-scroll to bottom when time is selected to show topic selection
  useEffect(() => {
    if (selectedTime && scrollableContentRef.current) {
      // Use setTimeout to ensure the DOM has updated with the topic selection section
      setTimeout(() => {
        if (scrollableContentRef.current) {
          scrollableContentRef.current.scrollTo({
            top: scrollableContentRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);
    }
  }, [selectedTime]);

  if (!isOpen || !selectedContact) return null;

  // Get the selected slot's health_coach_schedule_id
  const getSelectedSlotId = (): number | null => {
    if (
      !selectedDate ||
      !selectedTime ||
      !dietitianData?.result?.health_coach_schedules
    ) {
      return null;
    }

    const selectedDateStr = formatDateString(selectedDate);
    const scheduleForDate = dietitianData.result.health_coach_schedules.find(
      (schedule) => schedule.date === selectedDateStr
    );

    if (scheduleForDate && scheduleForDate.slots) {
      const selectedSlot = scheduleForDate.slots.find(
        (slot) => slot.start_time === selectedTime
      );
      return selectedSlot?.health_coach_schedule_id || null;
    }

    return null;
  };

  const handleSchedule = async (): Promise<void> => {
    if (!selectedTime || selectedTopics.length === 0 || !selectedDate) return;

    const health_coach_schedule_id = getSelectedSlotId();
    if (!health_coach_schedule_id) {
      return;
    }

    const health_coach_id =
      dietitianData?.result?.dietitian_details?.health_coach_id;
    if (!health_coach_id) {
      return;
    }

    // Combine date and time
    const [time, period] = selectedTime.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let hour24 = hours;
    if (period === "pm" && hours !== 12) hour24 += 12;
    if (period === "am" && hours === 12) hour24 = 0;

    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hour24, minutes, 0, 0);

    // Convert to epoch seconds
    const call_date_time = Math.floor(scheduledDateTime.getTime() / 1000);

    setScheduling(true);
    try {
      // Map UI call type to API call type
      const apiCallType = callType === "Video" ? "video_call" : "normal_call";

      await scheduleCallWithDietitian({
        call_type: apiCallType,
        call_date_time: call_date_time,
        call_purpose: selectedTopics.join(", "),
        health_coach_schedule_id: health_coach_schedule_id,
        health_coach_id: health_coach_id,
        start_time: selectedTime,
      });

      if (selectedContact && groupId) {
        try {
          await sendCustomMessage({
            from: userId,
            groupId,
            targetUserId: peerId,
            isFromUser: false,
            receiverId: peerId,
            type: "call_scheduled",
            data: {
              type: "call_scheduled",
              time: call_date_time,
            },
          });
        } catch {
          // Don't block the scheduling flow if this fails
        }
      }

      // Call the onSchedule callback for any additional handling
      // Convert "Video"/"Voice" to "video"/"audio" for the callback
      const callTypeForCallback: "video" | "audio" =
        callType === "Video" ? "video" : "audio";
      onSchedule(
        scheduledDateTime,
        selectedTime,
        selectedTopics,
        callTypeForCallback
      );
      onClose();
    } catch (error) {
      // You might want to show an error message to the user here
    } finally {
      setScheduling(false);
    }
  };

  // Format date for footer display
  const formatFooterDate = (): string => {
    if (!selectedDate) return "";

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
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateOnly = new Date(selectedDate);
    selectedDateOnly.setHours(0, 0, 0, 0);
    const isToday = selectedDateOnly.getTime() === today.getTime();

    if (isToday) {
      return `Today, ${selectedDate.getDate()} ${
        monthNames[selectedDate.getMonth()]
      }`;
    }
    return `${dayNames[selectedDate.getDay()]}, ${selectedDate.getDate()} ${
      monthNames[selectedDate.getMonth()]
    }`;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Time must belong to the currently selected date (stale time from another date must not show topics/footer state)
  const hasDateAndTime =
    selectedTime !== "" && timeSlots.includes(selectedTime);

  // Format scheduled date and time for display
  const formatScheduledDateTime = (): string => {
    if (!scheduledCallFromApi) return "";

    const scheduledDate = new Date(scheduledCallFromApi.call_date_time * 1000);
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

    // Format time (convert to 12-hour format)
    const hours = scheduledDate.getHours();
    const minutes = scheduledDate.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
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

  // If there's a scheduled call in the future, show confirmation view
  if (hasScheduledCall()) {
    const dietitianName =
      selectedContact?.name ||
      dietitianData?.result?.dietitian_details?.dietitian_name ||
      "Nutritionist";
    const scheduledDateTimeText = formatScheduledDateTime();

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
            zIndex: 9998,
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
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            fontFamily: MODAL_FONT,
            animation: "slideUpFromBottom 0.3s ease-out",
            overflow: "hidden",
            maxHeight: "90%",
            boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — Figma action bar 56px */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              minHeight: "56px",
              paddingTop: "12px",
              paddingBottom: "12px",
              paddingLeft: MODAL_PAD_X,
              paddingRight: MODAL_PAD_RIGHT,
              boxSizing: "border-box",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                width: "32px",
                height: "32px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C1,
              }}
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              paddingTop: "24px",
              paddingBottom: "24px",
              paddingLeft: MODAL_PAD_X,
              paddingRight: MODAL_PAD_RIGHT,
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 400,
                color: C1,
                lineHeight: 1.4285714285714286,
                textAlign: "left",
              }}
            >
              Your call has been scheduled with{" "}
              <strong style={{ fontWeight: 700 }}>
                {dietitianName} at {scheduledDateTimeText}
              </strong>
            </div>

            {onCancelCall && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onCancelCall();
                    onClose();
                  } catch {
                    // optional error UI
                  }
                }}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  border: "none",
                  borderRadius: "100px",
                  backgroundColor: BRAND_RED,
                  color: "#ffffff",
                  fontFamily: MODAL_FONT,
                  fontSize: "14px",
                  fontWeight: 700,
                  lineHeight: 1,
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#c53a3d";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_RED;
                }}
              >
                Cancel Call
              </button>
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
        `}</style>
      </>
    );
  }

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
          zIndex: 9998,
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={handleBackdropClick}
      />
      {/* Modal within chat interface - Bottom Sheet */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          fontFamily: MODAL_FONT,
          animation: "slideUpFromBottom 0.3s ease-out",
          overflow: "hidden",
          maxHeight: "90%",
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Figma action bar 56px */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            minHeight: "56px",
            paddingTop: "12px",
            paddingBottom: "12px",
            paddingLeft: MODAL_PAD_X,
            paddingRight: MODAL_PAD_RIGHT,
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C1,
            }}
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable Content — horizontal inset 20px (Figma) */}
        <div
          ref={scrollableContentRef}
          style={{
            flex: 1,
            overflowY: "auto",
            paddingBottom: "16px",
            paddingLeft: MODAL_PAD_X,
            paddingRight: MODAL_PAD_RIGHT,
            marginTop: "-26px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            {/* Avatar 56×56, dashed ring 2px #109310 (Figma) */}
            <div
              style={{
                position: "relative",
                width: "56px",
                height: "56px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  border: `2px dashed ${GREEN}`,
                  boxSizing: "border-box",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <img
                  src={selectedContact.avatar || config.defaults.avatar}
                  alt={selectedContact.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                    display: "block",
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== config.defaults.avatar) {
                      target.src = config.defaults.avatar;
                    } else {
                      target.style.display = "none";
                    }
                  }}
                />
              </div>
              <div
                style={{
                  position: "absolute",
                  right: "-2px",
                  bottom: "-2px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: GREEN,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #FFFFFF",
                  boxSizing: "border-box",
                }}
              >
                <Phone size={12} color="#FFFFFF" strokeWidth={2} />
              </div>
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 700,
                color: C1,
                textAlign: "center",
                lineHeight: 1.2,
                maxWidth: "236px",
              }}
            >
              Schedule a call with
              <br />
              {selectedContact.name}
            </h2>

            <p
              style={{
                margin: 0,
                marginTop: "12px",
                fontSize: "14px",
                fontWeight: 400,
                color: C2,
                lineHeight: 1.4285714285714286,
                textAlign: "center",
                maxWidth: "320px",
              }}
            >
              Get 1-on-1 help with your diet and ask questions
            </p>
          </div>

          {/* Date row — cells 69×56, divider C4 */}
          <div
            style={{
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "0",
                overflowX: "auto",
                overflowY: "hidden",
                paddingBottom: "0",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                borderBottom: `1px solid ${C4}`,
                position: "relative",
              }}
              onWheel={(e) => {
                e.preventDefault();
                e.currentTarget.scrollLeft += e.deltaY;
              }}
            >
              {dates.map((dateItem, index) => {
                const isSelected =
                  selectedDate !== null &&
                  dateItem.date.toDateString() === selectedDate.toDateString();
                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDate(dateItem.date)}
                      style={{
                        width: "69px",
                        height: "56px",
                        padding: 0,
                        border: "none",
                        borderRadius: 0,
                        backgroundColor: "transparent",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: "2px",
                        transition: "opacity 0.2s",
                        position: "relative",
                        fontFamily: MODAL_FONT,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: C1,
                          opacity: 0.6,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          lineHeight: 1.2,
                        }}
                      >
                        {dateItem.dayLabel}
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: C1,
                          lineHeight: 1.1428571428571428,
                          opacity: isSelected ? 1 : 0.8,
                        }}
                      >
                        {dateItem.dayNumber}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: C1,
                          lineHeight: 1.1666666666666667,
                          opacity: isSelected ? 1 : 0.8,
                          marginTop: "2px",
                        }}
                      >
                        {dateItem.month}
                      </div>
                    </button>
                    {isSelected && (
                      <div
                        style={{
                          width: "69.2px",
                          height: "4px",
                          backgroundColor: BRAND_RED,
                          borderTopLeftRadius: "100px",
                          borderTopRightRadius: "100px",
                          marginTop: "0",
                          marginBottom: "-1px",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time grid — 3 columns, row/column gap 10px, 40px height */}
          <div
            style={{
              marginBottom: hasDateAndTime ? "16px" : "0",
            }}
          >
            {timeSlots.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                  width: "100%",
                }}
              >
                {timeSlots.map((time, index) => {
                  const isSelected = selectedTime === time;
                  return (
                    <button
                      type="button"
                      key={index}
                      onClick={() => setSelectedTime(time)}
                      style={{
                        height: "40px",
                        minHeight: "40px",
                        padding: "0 10px",
                        border: isSelected
                          ? `1px solid ${BRAND_RED}`
                          : `1px solid ${C4}`,
                        borderRadius: "10px",
                        backgroundColor: "#ffffff",
                        color: isSelected ? BRAND_RED : C1,
                        fontFamily: MODAL_FONT,
                        fontSize: "14px",
                        fontWeight: 600,
                        lineHeight: 1.2,
                        cursor: "pointer",
                        transition: "border-color 0.2s, color 0.2s",
                        textAlign: "center",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#cfd4d8";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = C4;
                        }
                      }}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            ) : selectedDate ? (
              /* Empty state when selected date has no available slots */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px 16px",
                  background: "#F9FAFB",
                  borderRadius: "12px",
                  textAlign: "center",
                  fontFamily: MODAL_FONT,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                    boxShadow: "0 4px 16px rgba(220, 65, 68, 0.35), 0 0 24px rgba(220, 65, 68, 0.2)",
                  }}
                >
                  <Calendar size={40} color={BRAND_RED} strokeWidth={1.5} />
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 700,
                    color: C1,
                    marginBottom: "8px",
                    lineHeight: 1.3,
                  }}
                >
                  Whoops, your bookings is empty!
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 400,
                    color: C2,
                    lineHeight: 1.4285714285714286,
                    maxWidth: "280px",
                  }}
                >
                  No slots available for this date. Please select another date.
                </p>
              </div>
            ) : null}
          </div>

          {/* Topic Selection - Only show when date and time are selected */}
          {hasDateAndTime && (
            <div style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: C1,
                    opacity: 0.6,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                  }}
                >
                  Select topic
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    backgroundColor: "#EFEFEF",
                    minWidth: "8px",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {topics.map((topic, index) => {
                  const isSelected = selectedTopics.includes(topic);
                  return (
                    <button
                      type="button"
                      key={index}
                      onClick={() => toggleTopic(topic)}
                      style={{
                        height: "32px",
                        minHeight: "32px",
                        padding: "10px 12px",
                        border: isSelected
                          ? `1px solid ${BRAND_RED}`
                          : `1px solid ${TOPIC_BORDER}`,
                        borderRadius: "100px",
                        backgroundColor: "#ffffff",
                        color: isSelected ? BRAND_RED : C1,
                        fontFamily: MODAL_FONT,
                        fontSize: "14px",
                        fontWeight: 500,
                        lineHeight: 1.2857142857142858,
                        cursor: "pointer",
                        transition: "border-color 0.2s, color 0.2s",
                        textAlign: "center",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        boxShadow: "0px 1px 3px 0px rgba(10, 31, 52, 0.06)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "rgba(10, 31, 52, 0.18)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = TOPIC_BORDER;
                        }
                      }}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer - hide when selected date has no available slots */}
        {!(selectedDate && timeSlots.length === 0) && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#FFFFFF",
            borderTop: `1px solid ${C4}`,
            paddingTop: "12px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            paddingLeft: MODAL_PAD_X,
            paddingRight: MODAL_PAD_RIGHT,
            zIndex: 10000,
            boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.06)",
            fontFamily: MODAL_FONT,
          }}
        >
          {/* Call type — not in Figma; kept for API, typography aligned */}
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: C1,
                opacity: 0.6,
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                lineHeight: 1.2,
                textAlign: "left",
              }}
            >
              Select call type
            </div>
            <div
              style={{
                display: "flex",
                borderRadius: "8px",
                background: "rgba(220, 65, 68, 0.35)",
                padding: "2px",
                width: "fit-content",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "2px",
                  bottom: "2px",
                  left: callType === "Video" ? "2px" : "50%",
                  right: callType === "Video" ? "50%" : "2px",
                  backgroundColor: BRAND_RED,
                  borderRadius: "6px",
                  transition: "left 0.3s ease-out, right 0.3s ease-out",
                  zIndex: 0,
                }}
              />
              <button
                type="button"
                onClick={() => setCallType("Video")}
                style={{
                  padding: "8px 24px",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: "transparent",
                  color: "#ffffff",
                  fontFamily: MODAL_FONT,
                  fontSize: "14px",
                  fontWeight: 600,
                  lineHeight: 1.2,
                  cursor: "pointer",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Video
              </button>
              <button
                type="button"
                onClick={() => setCallType("Voice")}
                style={{
                  padding: "8px 24px",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: "transparent",
                  color: "#ffffff",
                  fontFamily: MODAL_FONT,
                  fontSize: "14px",
                  fontWeight: 600,
                  lineHeight: 1.2,
                  cursor: "pointer",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Voice
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {hasDateAndTime ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: C1,
                        lineHeight: 1.4285714285714286,
                      }}
                    >
                      {formatFooterDate()}
                    </span>
                    <span
                      style={{
                        width: "2px",
                        height: "2px",
                        borderRadius: "50%",
                        backgroundColor: C1,
                        opacity: 0.6,
                        flexShrink: 0,
                      }}
                      aria-hidden
                    />
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: C1,
                        lineHeight: 1.4285714285714286,
                      }}
                    >
                      {selectedTime}
                    </span>
                  </div>
                  {selectedTopics.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "5px",
                      }}
                    >
                      {selectedTopics.map((t, i) => (
                        <React.Fragment key={t}>
                          {i > 0 && (
                            <span
                              style={{
                                width: "2px",
                                height: "2px",
                                borderRadius: "50%",
                                backgroundColor: C1,
                                opacity: 0.6,
                                flexShrink: 0,
                              }}
                              aria-hidden
                            />
                          )}
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 500,
                              color: C1,
                              lineHeight: 1.1666666666666667,
                            }}
                          >
                            {t}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: C1,
                    opacity: 0.45,
                    lineHeight: 1.4285714285714286,
                  }}
                >
                  Select date and time
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleSchedule}
              disabled={
                !hasDateAndTime || selectedTopics.length === 0 || scheduling
              }
              style={{
                width: "131px",
                height: "52px",
                flexShrink: 0,
                border: "none",
                borderRadius: "100px",
                backgroundColor: BRAND_RED,
                color: "#ffffff",
                fontFamily: MODAL_FONT,
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: 1,
                cursor:
                  hasDateAndTime && selectedTopics.length > 0 && !scheduling
                    ? "pointer"
                    : "not-allowed",
                transition: "background-color 0.2s, opacity 0.2s",
                whiteSpace: "nowrap",
                opacity:
                  scheduling ||
                  (hasDateAndTime && selectedTopics.length > 0)
                    ? 1
                    : 0.45,
              }}
              onMouseEnter={(e) => {
                if (hasDateAndTime && selectedTopics.length > 0 && !scheduling) {
                  e.currentTarget.style.backgroundColor = "#c53a3d";
                }
              }}
              onMouseLeave={(e) => {
                if (hasDateAndTime && selectedTopics.length > 0 && !scheduling) {
                  e.currentTarget.style.backgroundColor = BRAND_RED;
                }
              }}
            >
              {scheduling ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </div>
        )}
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

        /* Hide scrollbar for date selection */
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}
