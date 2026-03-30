import React, { useEffect, useState, useRef, useCallback } from "react";
import "./FPChatApp.css";
import FPChatInterface from "./components/FPChatInterface.tsx";
import FPCallApp from "../fp-call/FPCallApp.tsx";
import FP404Error from "./components/FP404Error.tsx";
import AgoraChat from "agora-chat";
import { useChatClient } from "./hooks/useChatClient.ts";
import config from "../common/config.ts";
import { buildCustomExts } from "./utils/buildCustomExts.ts";
import { createMessageHandlers } from "./utils/messageHandlers.ts";
import type { Contact, Message, LogEntry } from "../common/types/chat";
import type { CallEndData } from "../common/types/call";
import type { MessageBody } from "agora-chat";
import { fetchDietitianDetails } from "./services/dietitianApi";
import {
  generateChatToken,
  registerUser as registerUserApi,
} from "./services/chatApi";

interface FPChatAppProps {
  userId: string;
  conversationId: string; // Required: the coach/user ID to chat with
  name?: string; // Optional: fallback name (will be replaced by API dietitian_name)
  profilePhoto?: string; // Optional: fallback photo (will be replaced by API dietitian_photo)
  designation?: string; // Optional: fallback designation (will be replaced by API dietitian_profile)
  onLogout?: () => void;
}

interface ActiveCall {
  userId: string;
  peerId: string;
  channel: string;
  isInitiator: boolean;
  callType: "video" | "audio";
  localUserName: string;
  localUserPhoto?: string;
  peerName: string;
  peerAvatar?: string;
}

interface IncomingCall {
  from: string;
  channel: string;
  callId?: string;
  callType?: "video" | "audio";
}

function FPChatApp({
  userId,
  conversationId,
  name,
  profilePhoto,
  designation,
  onLogout,
}: FPChatAppProps): React.JSX.Element {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [isGeneratingToken, setIsGeneratingToken] = useState<boolean>(false);
  const appKey = config.agora.appKey;
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [peerId, setPeerId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [logs, setLogs] = useState<(string | LogEntry)[]>([]);

  // Call state management
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [, setIncomingCall] = useState<IncomingCall | null>(null);

  // Scheduled call from API
  const [scheduledCallFromApi, setScheduledCallFromApi] = useState<{
    date: string;
    start_time: string;
    call_date_time: number; // epoch timestamp
    schedule_call_id: number;
    call_type?: "video" | "audio"; // Type of call scheduled
  } | null>(null);

  // 404 Error state
  const [show404Error, setShow404Error] = useState<boolean>(false);

  // 🔹 Global message ID tracker to prevent duplicates
  const isSendingRef = useRef<boolean>(false);
  // 🔹 Track if call end message has been sent to prevent duplicates
  const callEndMessageSentRef = useRef<boolean>(false);

  // 🔹 Track processed message IDs to avoid duplicates in polling
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  // 🔹 Track last poll time to avoid too frequent polling
  const lastPollTimeRef = useRef<number>(0);
  // 🔹 Track if direct chat has been initialized to prevent multiple initializations
  const directChatInitializedRef = useRef<boolean>(false);
  // 🔹 Track which contact ID has been updated with dietitian details
  const contactDetailsUpdatedRef = useRef<string | null>(null);

  const addLog = (log: string | LogEntry): void =>
    setLogs((prev) => {
      // Always add log entries, even if they're duplicates
      // This allows users to send the same message multiple times consecutively
      return [...prev, log];
    });

  // Helper function to generate a new token
  const generateNewToken = async (): Promise<string | null> => {
    if (!userId) {
      addLog("Cannot renew token: No user ID");
      return null;
    }

    try {
      addLog(`Renewing chat token for ${userId}...`);
      const newToken = await generateChatToken(
        userId,
        config.token.expireInSecs
      );
      setToken(newToken); // Update token state
      addLog(`Chat token renewed successfully`);
      return newToken;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog(`Token renewal failed: ${errorMessage}`);
      console.error("Token renewal error:", error);
      return null;
    }
  };

  // Function to validate dietitian ID
  const validateDietitianId = useCallback(async (): Promise<boolean> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const callDate = Math.floor(today.getTime() / 1000);

      const data = await fetchDietitianDetails(callDate);

      // Check if the API response indicates an error or invalid dietitian
      // API returns code 200 for success, other codes indicate errors
      if (data?.code !== undefined && data.code !== 200) {
        // If code is 404 or indicates not found, return false
        if (
          data.code === 404 ||
          data.message?.toLowerCase().includes("not found") ||
          data.status?.toLowerCase() === "error"
        ) {
          return false;
        }
      }

      // If we get valid data with result, dietitian ID is valid
      if (data?.result) {
        return true;
      }

      // If no result, assume invalid
      return false;
    } catch (error) {
      // Check if it's a 404 error
      const axiosError = error as { response?: { status?: number } };
      if (axiosError?.response?.status === 404) {
        return false;
      }
      // For other errors, assume valid (don't block on network issues)
      // This allows the app to continue even if there's a temporary network issue
      console.error("Error validating dietitian ID:", error);
      return true;
    }
  }, []);

  // Function to fetch scheduled call from API (reusable)
  // Memoized with useCallback to prevent unnecessary re-renders
  const fetchScheduledCall = useCallback(async (): Promise<void> => {
    if (!isLoggedIn || !selectedContact) {
      setScheduledCallFromApi(null);
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const callDate = Math.floor(today.getTime() / 1000);

      const data = await fetchDietitianDetails(callDate);

      // Check if the API response indicates an error
      if (data?.code && data.code === 404) {
        setShow404Error(true);
        setScheduledCallFromApi(null);
        return;
      }

      // Find first slot with schedule_call_id != null
      let foundScheduledSlot: {
        date: string;
        start_time: string;
        call_date_time: number;
        schedule_call_id: number;
        call_type?: "video" | "audio";
      } | null = null;

      if (data?.result?.health_coach_schedules) {
        for (const schedule of data.result.health_coach_schedules) {
          if (schedule.slots) {
            const scheduledSlot = schedule.slots.find(
              (slot) => slot.schedule_call_id != null
            );
            if (scheduledSlot && scheduledSlot.schedule_call_id) {
              // Calculate call_date_time from date and start_time
              const [year, month, day] = schedule.date.split("-").map(Number);
              const date = new Date(year, month - 1, day);

              // Parse time
              const [time, period] = scheduledSlot.start_time.split(" ");
              const [hours, minutes] = time.split(":").map(Number);
              let hour24 = hours;
              if (period === "pm" && hours !== 12) hour24 += 12;
              if (period === "am" && hours === 12) hour24 = 0;

              date.setHours(hour24, minutes, 0, 0);
              const call_date_time = Math.floor(date.getTime() / 1000);

              foundScheduledSlot = {
                date: schedule.date,
                start_time: scheduledSlot.start_time,
                call_date_time: call_date_time,
                schedule_call_id: scheduledSlot.schedule_call_id,
                call_type: "video", // Default to video, will be updated when scheduling
              };
              break; // Found first scheduled slot, exit
            }
          }
        }
      }

      setScheduledCallFromApi(foundScheduledSlot);
      setShow404Error(false); // Clear 404 error if we successfully fetched data
    } catch (error) {
      console.error("Error fetching scheduled call:", error);
      // Check if it's a 404 error
      if (
        (error as { response?: { status?: number } })?.response?.status === 404
      ) {
        setShow404Error(true);
      }
      setScheduledCallFromApi(null);
    }
  }, [isLoggedIn, selectedContact]);

  // Function to update contact with dietitian details from API
  const updateContactWithDietitianDetails =
    useCallback(async (): Promise<void> => {
      if (!selectedContact) {
        return;
      }

      // Skip if we've already updated this contact
      if (contactDetailsUpdatedRef.current === selectedContact.id) {
        return;
      }

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const callDate = Math.floor(today.getTime() / 1000);

        const data = await fetchDietitianDetails(callDate);

        // Check if we have valid dietitian details
        if (data?.code === 200 && data?.result?.dietitian_details) {
          const dietitianDetails = data.result.dietitian_details;

          // Mark this contact as updated before updating state
          contactDetailsUpdatedRef.current = selectedContact.id;

          // Update selectedContact with dietitian details
          setSelectedContact((prevContact) => {
            if (!prevContact) return prevContact;
            return {
              ...prevContact,
              name: dietitianDetails.dietitian_name || prevContact.name,
              avatar: dietitianDetails.dietitian_photo || prevContact.avatar,
              description:
                dietitianDetails.dietitian_profile || prevContact.description,
            };
          });
        }
      } catch (error) {
        console.error("Error updating contact with dietitian details:", error);
        // Don't throw error - keep using initial contact data if API fails
      }
    }, [selectedContact]);

  // Validate dietitian ID on mount
  useEffect(() => {
    const checkDietitianId = async (): Promise<void> => {
      const isValid = await validateDietitianId();
      if (!isValid) {
        setShow404Error(true);
      }
    };
    checkDietitianId();
  }, [validateDietitianId, conversationId]);

  // Update contact with dietitian details when contact is selected
  useEffect(() => {
    updateContactWithDietitianDetails();
  }, [updateContactWithDietitianDetails]);

  // Fetch scheduled call from API on mount
  // Fetch scheduled call from API when logged in and contact is selected
  useEffect(() => {
    fetchScheduledCall();
  }, [fetchScheduledCall]);

  // Poll for scheduled call updates every 10 seconds to detect backend cancellations
  useEffect(() => {
    if (!isLoggedIn || !selectedContact) {
      return;
    }

    // Poll every 10 seconds to check for scheduled call updates
    const pollInterval = setInterval(() => {
      fetchScheduledCall();
    }, 10000); // Poll every 10 seconds

    // Cleanup interval on unmount or when dependencies change
    return () => {
      clearInterval(pollInterval);
    };
  }, [isLoggedIn, selectedContact, fetchScheduledCall]);

  // Create a ref to store clientRef for handlers
  const clientRefForHandlers = useRef<unknown>(null);

  // Handle incoming call - defined early so it can be used in handlers
  const handleIncomingCall = (callData: IncomingCall): void => {
    setIncomingCall(callData);
  };

  // Helper function to register user (for usernotfound error handling)
  const registerUser = async (username: string): Promise<boolean> => {
    try {
      await registerUserApi(username);
      return true;
    } catch (registerError) {
      const errorMessage =
        registerError instanceof Error
          ? registerError.message
          : String(registerError);
      // Check if it's a "user already exists" scenario - we can proceed
      if (errorMessage.includes("400") || errorMessage.includes("409")) {
        return true;
      }
      throw registerError;
    }
  };

  // Create handlers - they will use clientRefForHandlers.current
  const handlers = createMessageHandlers({
    userId,
    setIsLoggedIn,
    setIsLoggingIn: () => {},
    addLog,
    setConversations: () => {},
    generateNewToken,
    handleIncomingCall,
    registerUser,
    get clientRef() {
      return clientRefForHandlers;
    },
  });

  const clientRef = useChatClient(appKey, handlers);

  // Update the ref that handlers use
  useEffect(() => {
    clientRefForHandlers.current = clientRef.current;
  }, [clientRef]);

  // Auto-login when userId and token are provided
  // Flow: 1. Generate Token (done in initializeDirectChat), 2. Login Into Agora SDK
  // If usernotfound error occurs, onError handler will: 3. Call register API, 4. Retry login
  useEffect(() => {
    if (userId && token && !isLoggedIn && clientRef.current) {
      // Step 2: Login Into Agora SDK
      // Errors (including usernotfound) will be handled by onError handler
      if (
        typeof (
          clientRef.current as unknown as {
            open: (options: { user: string; accessToken: string }) => void;
          }
        ).open === "function"
      ) {
        (
          clientRef.current as unknown as {
            open: (options: { user: string; accessToken: string }) => void;
          }
        ).open({ user: userId, accessToken: token });
      }
    }
  }, [userId, token, isLoggedIn, clientRef]);

  // Initialize direct chat mode: always open chat interface with the conversationId
  useEffect(() => {
    const initializeDirectChat = async (): Promise<void> => {
      try {
        addLog(
          `Initializing direct chat with conversation ID: ${conversationId}`
        );

        // Create a contact object from conversationId with fallback values
        // Note: name, avatar, and description will be updated from API dietitian details
        // The conversationId is the coach/user ID to chat with
        const contact: Contact = {
          id: String(conversationId),
          name: name || `User ${conversationId}`, // Fallback name (will be replaced by API)
          avatar: profilePhoto || config.defaults.avatar, // Fallback photo (will be replaced by API)
          description: designation, // Fallback designation (will be replaced by API)
          lastMessage: undefined,
          timestamp: null,
          lastMessageFrom: null,
        };

        // If already initialized, just update the contact info (name/avatar/designation)
        if (directChatInitializedRef.current && selectedContact) {
          setSelectedContact({
            ...selectedContact,
            name: contact.name,
            avatar: contact.avatar,
            description: contact.description,
          });
          return;
        }

        // Generate token if not already available
        if (!token && !isLoggedIn) {
          const newToken = await ensureToken();
          if (!newToken) {
            addLog("Failed to generate token. Cannot connect to chat.");
            console.error("Failed to generate token. Cannot connect to chat.");
            return;
          }
        }

        // Set selected contact and peerId to open chat interface
        setSelectedContact(contact);
        setPeerId(contact.id);

        // Reset contact details updated ref when conversation changes
        contactDetailsUpdatedRef.current = null;

        // Mark as initialized to prevent re-initialization
        directChatInitializedRef.current = true;

        addLog(`Direct chat initialized with ${contact.id}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        addLog(`Error initializing direct chat: ${errorMessage}`);
        console.error("Error initializing direct chat:", error);
      }
    };

    initializeDirectChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, userId, name, profilePhoto, designation]);

  // Internal function to generate token for the coach
  const generateToken = async (): Promise<string | null> => {
    setIsGeneratingToken(true);
    try {
      addLog(`Generating chat token for ${userId}...`);
      const newToken = await generateChatToken(
        userId,
        config.token.expireInSecs
      );
      setToken(newToken);
      addLog(`Chat token generated successfully`);
      setIsGeneratingToken(false);
      return newToken;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addLog(`Token generation failed: ${errorMessage}`);
      console.error("Token generation error:", error);
      setIsGeneratingToken(false);
      return null;
    }
  };

  // Helper function to ensure token exists before connecting
  const ensureToken = async (): Promise<string | null> => {
    if (token) {
      return token;
    }

    // Generate token internally
    return await generateToken();
  };

  // Note: userId is now a patient, not a coach
  // coachInfo is not needed for patients - it will be set when a coach is selected

  // Poll for recent messages to catch backend-sent messages that might not trigger handlers
  useEffect(() => {
    if (!peerId || !clientRef.current || !isLoggedIn) {
      return;
    }

    // Clear processed message IDs when peerId changes to start fresh
    processedMessageIdsRef.current.clear();

    const POLL_INTERVAL = 3000; // Poll every 3 seconds
    const MIN_POLL_INTERVAL = 1000; // Minimum 1 second between polls
    const INITIAL_POLL_DELAY = 3000; // Delay before first poll to allow fetchInitialMessages to complete

    const pollForMessages = async (): Promise<void> => {
      const now = Date.now();
      // Throttle polling to avoid too frequent requests
      if (now - lastPollTimeRef.current < MIN_POLL_INTERVAL) {
        return;
      }
      lastPollTimeRef.current = now;

      try {
        const targetId = peerId.startsWith("user_")
          ? peerId.replace("user_", "")
          : peerId;

        const client = clientRef.current as {
          getHistoryMessages?: (options: {
            targetId: string;
            chatType: string;
            pageSize: number;
            searchDirection: string;
          }) => Promise<{
            messages?: unknown[];
            cursor?: string;
          }>;
        };

        if (!client.getHistoryMessages) {
          return;
        }

        // Fetch only the most recent message to check for new ones
        const result = await client.getHistoryMessages({
          targetId,
          chatType: "singleChat",
          pageSize: 1,
          searchDirection: "up",
        });

        const messages = (result?.messages || []) as Array<{
          id?: string;
          mid?: string;
          from?: string;
          to?: string;
          time?: number;
          type?: string;
          msg?: string;
          customExts?: unknown;
          "v2:customExts"?: unknown;
          body?: unknown;
          ext?: unknown;
        }>;

        if (messages.length > 0) {
          const latestMessage = messages[0];
          // Generate all possible message ID formats to check against processed set
          const messageId =
            latestMessage.id ||
            latestMessage.mid ||
            `${latestMessage.from}-${latestMessage.time}`;
          const messageIdAlt1 = latestMessage.id || null;
          const messageIdAlt2 = latestMessage.mid || null;
          const messageIdAlt3 =
            latestMessage.from && latestMessage.time
              ? `${latestMessage.from}-${latestMessage.time}`
              : null;

          // Check if we've already processed this message (in any ID format)
          const isAlreadyProcessed =
            processedMessageIdsRef.current.has(messageId) ||
            (messageIdAlt1 &&
              processedMessageIdsRef.current.has(messageIdAlt1)) ||
            (messageIdAlt2 &&
              processedMessageIdsRef.current.has(messageIdAlt2)) ||
            (messageIdAlt3 &&
              processedMessageIdsRef.current.has(messageIdAlt3));

          if (isAlreadyProcessed) {
            // Message is already processed (likely from fetchInitialMessages)
            // Skip it to prevent duplicates

            return;
          }

          // Check if this message is already in logs
          const messageInLogs = logs.some((log) => {
            if (typeof log === "string") {
              return log.includes(messageId);
            }
            return (
              log.serverMsgId === messageId ||
              log.serverMsgId === messageIdAlt1 ||
              log.serverMsgId === messageIdAlt2 ||
              log.serverMsgId === messageIdAlt3
            );
          });

          if (!messageInLogs) {
            // Mark all ID formats as processed BEFORE processing
            processedMessageIdsRef.current.add(messageId);
            if (messageIdAlt1) {
              processedMessageIdsRef.current.add(messageIdAlt1);
            }
            if (messageIdAlt2) {
              processedMessageIdsRef.current.add(messageIdAlt2);
            }
            if (messageIdAlt3) {
              processedMessageIdsRef.current.add(messageIdAlt3);
            }

            // This is a new message that wasn't caught by handlers
            // Process it through the handlers manually

            // Trigger the appropriate handler based on message type
            if (latestMessage.type === "custom" && handlers.onCustomMessage) {
              handlers.onCustomMessage(latestMessage as MessageBody);
            } else if (latestMessage.type === "txt" && handlers.onTextMessage) {
              handlers.onTextMessage(latestMessage as MessageBody);
            }
          } else {
            // Message is in logs, mark as processed but don't process again
            processedMessageIdsRef.current.add(messageId);
            if (messageIdAlt1) {
              processedMessageIdsRef.current.add(messageIdAlt1);
            }
            if (messageIdAlt2) {
              processedMessageIdsRef.current.add(messageIdAlt2);
            }
            if (messageIdAlt3) {
              processedMessageIdsRef.current.add(messageIdAlt3);
            }
          }
        }
      } catch (error) {
        console.error("Error polling for messages:", error);
      }
    };

    // Delay the first poll to allow fetchInitialMessages to complete
    // This prevents duplicate messages from appearing on page load/refresh
    let intervalId: NodeJS.Timeout | null = null;
    const initialTimeoutId = setTimeout(() => {
      pollForMessages();
      intervalId = setInterval(pollForMessages, POLL_INTERVAL);
    }, INITIAL_POLL_DELAY);

    return () => {
      clearTimeout(initialTimeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId, isLoggedIn, clientRef, logs.length]);

  const handleLogout = (): void => {
    if (
      clientRef.current &&
      typeof (clientRef.current as { close: () => void }).close === "function"
    ) {
      (clientRef.current as { close: () => void }).close();
    }
    setIsLoggedIn(false);
    setSelectedContact(null);
    setPeerId("");
    setMessage("");
    // Call parent's logout handler if provided
    if (onLogout) {
      onLogout();
    }
  };

  // Handle call initiation (video or audio)
  const handleInitiateCall = async (
    callType: "video" | "audio" = "video"
  ): Promise<void> => {
    if (!peerId || !userId) {
      addLog("Cannot initiate call: Missing user or peer ID");
      return;
    }

    // Generate channel name using format: fp_rtc_call_CALLTYPE_USERID_DIETITIANID
    // CALLTYPE => video or voice
    // USERID => userId (the user's ID)
    // DIETITIANID => peerId (the dietitian/coach ID)
    const callTypeStr = callType === "video" ? "video" : "voice";
    const channel = `fp_rtc_call_${callTypeStr}_${userId}_${peerId}`;

    // Reset call end message sent flag for new call
    callEndMessageSentRef.current = false;

    // DO NOT send initiate message - only send end message with duration

    // Ensure message is cleared
    setMessage("");

    // Set active call state
    setActiveCall({
      peerId,
      userId,
      channel,
      isInitiator: true,
      callType: callType,
      localUserName: userId, // userId is now the patient - will be used as fallback
      localUserPhoto: undefined, // Local user photo - can be fetched from user profile if available
      peerName: selectedContact?.name || peerId,
      peerAvatar: selectedContact?.avatar,
    });

    addLog(`Initiating ${callType} call with ${userId}`);
  };

  // Handle schedule call - refetch dietitian details after scheduling
  const handleScheduleCall = async (
    date: Date,
    time: string,
    _topic: string,
    callType: "video" | "audio" = "video"
  ): Promise<void> => {
    if (!selectedContact) {
      addLog("Cannot schedule call: No contact selected");
      return;
    }

    addLog(`Call scheduled for ${date.toLocaleDateString()} at ${time}`);

    // Refetch dietitian details to get the updated scheduled call info
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const callDate = Math.floor(today.getTime() / 1000);

      const data = await fetchDietitianDetails(callDate);

      // Find first slot with schedule_call_id != null
      let foundScheduledSlot: {
        date: string;
        start_time: string;
        call_date_time: number;
        schedule_call_id: number;
        call_type?: "video" | "audio";
      } | null = null;

      if (data?.result?.health_coach_schedules) {
        for (const schedule of data.result.health_coach_schedules) {
          if (schedule.slots) {
            const scheduledSlot = schedule.slots.find(
              (slot) => slot.schedule_call_id != null
            );
            if (scheduledSlot && scheduledSlot.schedule_call_id) {
              // Calculate call_date_time from date and start_time
              const [year, month, day] = schedule.date.split("-").map(Number);
              const dateObj = new Date(year, month - 1, day);

              // Parse time
              const [timePart, period] = scheduledSlot.start_time.split(" ");
              const [hours, minutes] = timePart.split(":").map(Number);
              let hour24 = hours;
              if (period === "pm" && hours !== 12) hour24 += 12;
              if (period === "am" && hours === 12) hour24 = 0;

              dateObj.setHours(hour24, minutes, 0, 0);
              const call_date_time = Math.floor(dateObj.getTime() / 1000);

              foundScheduledSlot = {
                date: schedule.date,
                start_time: scheduledSlot.start_time,
                call_date_time: call_date_time,
                schedule_call_id: scheduledSlot.schedule_call_id,
                call_type: callType, // Store the call type from scheduling
              };
              break; // Found first scheduled slot, exit
            }
          }
        }
      }

      setScheduledCallFromApi(foundScheduledSlot);
    } catch (error) {
      console.error("Error refetching scheduled call after scheduling:", error);
    }
  };

  // Handle end call
  const handleEndCall = async (
    callInfo: CallEndData | null = null
  ): Promise<void> => {
    // Prevent duplicate call end messages
    if (callEndMessageSentRef.current) {
      // Clear call state even if message was already sent
      setActiveCall(null);
      setIncomingCall(null);
      setMessage("");
      return;
    }

    if (!activeCall || !callInfo) {
      setActiveCall(null);
      setIncomingCall(null);
      setMessage("");
      return;
    }

    // Clear call state
    setActiveCall(null);
    setIncomingCall(null);
    // Clear any call message that might be in the input box
    setMessage("");
  };

  // Function to update conversation's last message from history (conversation list removed - no-op)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- callback signature required by FPChatInterface
  const updateLastMessageFromHistory = (peerId: string, formattedMsg: Message): void => {};

  const handleSendMessage = async (
    messageOverride: string | object | null = null
  ): Promise<void> => {
    // Prevent multiple simultaneous sends
    if (isSendingRef.current) {
      return;
    }

    if (!peerId) {
      addLog("No recipient selected");
      return;
    }

    // Use the override message if provided, otherwise use the message prop
    // This ensures we get the exact message value without race conditions
    const messageToSend = messageOverride !== null ? messageOverride : message;

    // Check if message is empty (for text messages)
    if (
      !messageToSend ||
      (typeof messageToSend === "string" && messageToSend.trim() === "")
    ) {
      addLog("Message cannot be empty");
      return;
    }

    // Clear message immediately to prevent duplicate sends
    setMessage("");

    // Mark as sending to prevent duplicate calls
    isSendingRef.current = true;

    try {
      // Verify connection before sending
      if (
        !clientRef.current ||
        (typeof (clientRef.current as unknown as { isOpened: () => boolean })
          .isOpened === "function" &&
          !(
            clientRef.current as unknown as { isOpened: () => boolean }
          ).isOpened())
      ) {
        addLog(`Send failed: Connection not established`);
        setMessage(
          typeof messageToSend === "string"
            ? messageToSend
            : JSON.stringify(messageToSend as object)
        ); // Restore message
        isSendingRef.current = false; // Reset flag on error
        return;
      }

      // Handle both string and object messages
      let parsedPayload: { type?: string; [key: string]: unknown } | null =
        null;
      let isCustomMessage = false;
      let messageString = "";

      // Only allow specific message types: text, image, file, audio, video_call, voice_call
      if (typeof messageToSend === "object") {
        // Already an object, use it directly
        parsedPayload = messageToSend as {
          type?: string;
          [key: string]: unknown;
        };
        messageString = JSON.stringify(messageToSend);
        if (
          parsedPayload &&
          typeof parsedPayload === "object" &&
          parsedPayload.type
        ) {
          const messageType = String(parsedPayload.type).toLowerCase();
          // Only allow: image, file, audio, video_call, voice_call
          if (
            messageType === "image" ||
            messageType === "file" ||
            messageType === "audio" ||
            messageType === "video_call" ||
            messageType === "voice_call"
          ) {
            isCustomMessage = true;
          }
        }
      } else {
        // String message - try to parse as JSON
        messageString = messageToSend;
        try {
          parsedPayload = JSON.parse(messageToSend) as {
            type?: string;
            [key: string]: unknown;
          };
          if (
            parsedPayload &&
            typeof parsedPayload === "object" &&
            parsedPayload.type
          ) {
            const messageType = String(parsedPayload.type).toLowerCase();
            // Only allow: image, file, audio, video_call, voice_call
            if (
              messageType === "image" ||
              messageType === "file" ||
              messageType === "audio" ||
              messageType === "video_call" ||
              messageType === "voice_call"
            ) {
              isCustomMessage = true;
            }
          }
        } catch {
          // Not JSON, treat as plain text
          isCustomMessage = false;
        }
      }

      // Prepare ext properties with sender info
      const extProperties = {
        senderName: userId, // userId is now the patient
        senderProfile: config.defaults.avatar,
        isFromUser: true, // Patient is the user
      };

      let options: {
        type: string;
        to: string;
        chatType: string;
        customEvent?: string;
        customExts?: unknown;
        msg?: string;
        ext?: typeof extProperties;
      };

      // Only allow specific custom message types: image, file, audio, video_call, voice_call
      if (isCustomMessage && parsedPayload && parsedPayload.type) {
        // Build customExts based on message type
        const customExts = buildCustomExts(
          parsedPayload as { type: string; [key: string]: unknown }
        );

        if (!customExts) {
          addLog("Invalid custom message payload");
          setMessage(messageString); // Restore message
          isSendingRef.current = false; // Reset flag on error
          return;
        }

        // Custom message - all custom messages use type: "custom"
        options = {
          type: "custom",
          to: peerId,
          chatType: "singleChat",
          customEvent: "customEvent",
          customExts,
          ext: extProperties,
        };
      } else {
        // Plain text message
        options = {
          chatType: "singleChat",
          type: "txt",
          to: peerId,
          msg: messageString,
          ext: extProperties,
        };
      }

      // Create and send message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = AgoraChat.message.create(options as any);

      if (
        clientRef.current &&
        typeof (
          clientRef.current as unknown as {
            send: (msg: unknown) => Promise<void>;
          }
        ).send === "function"
      ) {
        const response = await (
          clientRef.current as unknown as {
            send: (msg: unknown) => Promise<{ serverMsgId?: string }>;
          }
        ).send(msg);

        // Capture serverMsgId from response for message editing
        const serverMsgId = (response as { serverMsgId?: string })?.serverMsgId;
        if (serverMsgId) {
          // Add serverMsgId to the log entry so it can be used when creating messages
          addLog({
            log: `You → ${peerId}: ${messageString}`,
            timestamp: new Date(),
            serverMsgId: serverMsgId, // Store serverMsgId with the log
          });
        } else {
          // Fallback: add log without serverMsgId if not available
          // Log already added above with serverMsgId if available
        }
      } else {
        // If send failed, still add to log
        addLog(`You → ${peerId}: ${messageString}`);
      }

      // Conversation list removed - no need to generate preview or update conversation

      // Force a small delay to ensure state update propagates
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Reset the flag after successful send
      isSendingRef.current = false;
    } catch (sendError) {
      console.error("Error sending message:", sendError);
      const errorMessage =
        sendError instanceof Error
          ? sendError.message
          : (sendError as { code?: string; message?: string }).code ||
            (sendError as { code?: string; message?: string }).message ||
            String(sendError);
      addLog(`Send failed: ${errorMessage}`);
      setMessage(
        typeof messageToSend === "string"
          ? messageToSend
          : JSON.stringify(messageToSend as object)
      ); // Restore message on error
      isSendingRef.current = false; // Reset flag on error
    }
  };

  // Show 404 error if dietitian ID is invalid
  if (show404Error) {
    return (
      <div className="fp-chat-wrapper">
        <FP404Error
          message={`Dietitian ID "${conversationId}" not found`}
          onRetry={async () => {
            setShow404Error(false);
            const isValid = await validateDietitianId();
            if (!isValid) {
              setShow404Error(true);
            } else {
              // If valid, try to fetch scheduled call again
              await fetchScheduledCall();
            }
          }}
        />
      </div>
    );
  }

  // Show call interface if there's an active call
  if (activeCall) {
    return (
      <div className="fp-chat-wrapper app-container">
        <FPCallApp
          userId={activeCall.userId}
          peerId={activeCall.peerId}
          channel={activeCall.channel}
          isInitiator={activeCall.isInitiator}
          onEndCall={handleEndCall}
          isAudioCall={activeCall.callType === "audio"}
          chatClient={clientRef.current}
          localUserName={activeCall.localUserName}
          localUserPhoto={activeCall.localUserPhoto}
          peerName={activeCall.peerName}
          peerAvatar={activeCall.peerAvatar}
        />
      </div>
    );
  }

  // Determine if chat interface should show loading state
  const isChatConnecting = (token && !isLoggedIn) || isGeneratingToken;

  return (
    <div className="fp-chat-wrapper app-container">
      <div className="main-layout">
        {/* Chat Panel - always full width, no conversation list */}
        <div className="chat-panel full-width">
          {selectedContact ? (
            isChatConnecting ? (
              <div className="chat-loading-container">
                <div className="chat-loading-spinner" />
                <div className="chat-loading-text">
                  {isGeneratingToken
                    ? "Generating token..."
                    : "Connecting to chat..."}
                </div>
              </div>
            ) : (
              <FPChatInterface
                userId={userId}
                peerId={peerId || null}
                setPeerId={(id: string | null) => setPeerId(id || "")}
                message={message}
                setMessage={setMessage}
                onSend={handleSendMessage}
                onLogout={handleLogout}
                logs={logs}
                selectedContact={selectedContact}
                chatClient={clientRef.current}
                onBackToConversations={null}
                onInitiateCall={handleInitiateCall}
                onSchedule={handleScheduleCall}
                onUpdateLastMessageFromHistory={updateLastMessageFromHistory}
                onMessagesLoadedFromHistory={(messageIds) => {
                  // Mark all message IDs from history as processed to prevent polling from processing them again
                  messageIds.forEach((id) => {
                    processedMessageIdsRef.current.add(id);
                  });
                }}
                coachInfo={{ coachName: "", profilePhoto: "" }}
                scheduledCallFromApi={scheduledCallFromApi}
                onRefreshScheduledCall={fetchScheduledCall}
              />
            )
          ) : (
            <div className="chat-loading-container">
              <div className="chat-loading-spinner" />
              <div className="chat-loading-text">Initializing chat...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FPChatApp;
