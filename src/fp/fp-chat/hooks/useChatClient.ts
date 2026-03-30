import { useEffect, useRef, RefObject } from "react";
import { createChatClient } from "../services/chatClient";
import type { Connection, MessageBody } from "agora-chat";

interface MessageHandlers {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onTextMessage?: (msg: MessageBody) => void;
  onCustomMessage?: (msg: MessageBody) => void;
  onModifiedMessage?: (msg: MessageBody) => void; // Agora SDK uses onModifiedMessage, not onMessageChanged
  onTokenWillExpire?: () => Promise<void>;
  onTokenExpired?: () => Promise<void>;
  onError?: (error: { message: string }) => void;
  onPresenceStatus?: (presenceData: {
    userId: string;
    description: string;
  }) => void;
}

export function useChatClient(
  appKey: string,
  handlers?: MessageHandlers
): RefObject<Connection | null> {
  const clientRef = useRef<Connection | null>(null);
  const handlersRef = useRef<MessageHandlers | undefined>(handlers);

  // Create client and register initial handlers
  useEffect(() => {
    clientRef.current = createChatClient(appKey);
    if (handlers && clientRef.current) {
      clientRef.current.addEventHandler("app_handlers", handlers);
      handlersRef.current = handlers;
    }
    return () => {
      if (clientRef.current) {
        clientRef.current.removeEventHandler("app_handlers");
        clientRef.current.close();
      }
    };
  }, [appKey]);

  // Re-register handlers when they change (but client already exists)
  // This ensures handlers are always up-to-date after component re-renders
  // (e.g., after call ends, handlers are recreated and need to be re-registered)
  useEffect(() => {
    if (clientRef.current) {
      // Always remove old handlers first (if any)
      clientRef.current.removeEventHandler("app_handlers");
      // Add new handlers if provided
      if (handlers) {
        clientRef.current.addEventHandler("app_handlers", handlers);
        handlersRef.current = handlers;
      }
    }
  }, [handlers]);

  return clientRef;
}
