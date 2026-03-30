import React, { useEffect, useRef, useState, memo } from "react";
import { FPVideoCalling } from "./components/FPVideoCalling.tsx";
import "./FPCallApp.css";
import type { Connection } from "agora-chat";

interface FPCallAppProps {
  userId: string;
  peerId: string;
  channel: string;
  isInitiator: boolean;
  onEndCall: () => void;
  isAudioCall?: boolean;
  chatClient?: Connection | null;
  localUserName?: string;
  localUserPhoto?: string;
  peerName?: string;
  peerAvatar?: string;
}

type PresenceStatus = "offline" | "waiting" | "in_call" | null;

function FPCallApp({
  userId,
  peerId,
  channel,
  isInitiator,
  onEndCall,
  isAudioCall = false,
  chatClient,
  localUserName,
  localUserPhoto,
  peerName,
  peerAvatar,
}: FPCallAppProps): React.JSX.Element {
  const hasPublishedPresence = useRef(false);
  const hasSubscribedPresence = useRef(false);
  const presenceStatusRef = useRef<string>("");
  const [peerPresenceStatus, setPeerPresenceStatus] =
    useState<PresenceStatus>(null);

  // Helper function to publish presence
  const publishPresenceStatus = async (description: string): Promise<void> => {
    if (!chatClient) return;

    try {
      const presenceOptions = {
        description: description,
        userId: peerId,
      };

      // Type assertion for publishPresence method
      const client = chatClient as Connection & {
        publishPresence?: (options: {
          description: string;
          userId: string;
        }) => Promise<unknown>;
      };

      if (client.publishPresence) {
        await client.publishPresence(presenceOptions);
        presenceStatusRef.current = description;
        hasPublishedPresence.current = true;
      }
    } catch (error) {
    }
  };

  // Publish "waiting" status when user enters call screen
  useEffect(() => {
    if (!chatClient || hasPublishedPresence.current) return;
    const presenceData = {
      status: "in_the_call",
      userId: peerId,
    };

    publishPresenceStatus(JSON.stringify(presenceData));
  }, [chatClient, peerId]);

  // Subscribe to peer's presence
  useEffect(() => {
    if (!chatClient || !peerId || hasSubscribedPresence.current) return;

    const subscribePresence = async (): Promise<void> => {
      try {
        const client = chatClient as Connection & {
          subscribePresence?: (options: {
            usernames: string[];
            expiry: number;
          }) => Promise<unknown>;
        };

        if (client.subscribePresence) {
          await client.subscribePresence({
            usernames: [peerId],
            expiry: 3600, // Subscription duration in seconds (1 hour)
          });
          hasSubscribedPresence.current = true;
        }
      } catch (error) {
      }
    };

    subscribePresence();
  }, [chatClient, peerId]);

  // Listen for presence status updates
  useEffect(() => {
    if (!chatClient) return;

    const handlePresenceStatus = (presenceData: {
      userId: string;
      description: string;
    }): void => {
      if (presenceData.userId === peerId) {
        const status = presenceData.description as PresenceStatus;
        setPeerPresenceStatus(status);
      }
    };

    // Add event listener for presence status
    const client = chatClient as Connection & {
      addEventHandler?: (
        name: string,
        handlers: {
          onPresenceStatus?: (data: {
            userId: string;
            description: string;
          }) => void;
        }
      ) => void;
    };

    if (client.addEventHandler) {
      client.addEventHandler("presence_handlers", {
        onPresenceStatus: handlePresenceStatus,
      });
    }

    return () => {
      // Cleanup event listener
      const cleanupClient = chatClient as Connection & {
        removeEventHandler?: (name: string) => void;
      };
      if (cleanupClient.removeEventHandler) {
        cleanupClient.removeEventHandler("presence_handlers");
      }
    };
  }, [chatClient, peerId]);

  // Cleanup: Publish "offline" when leaving call
  useEffect(() => {
    return () => {
      if (!chatClient || !hasPublishedPresence.current) return;

      const cleanupPresence = async (): Promise<void> => {
        try {
          const client = chatClient as Connection & {
            publishPresence?: (options: {
              description: string;
              userId: string;
            }) => Promise<unknown>;
          };

          if (client.publishPresence) {
            await client.publishPresence({
              description: "offline",
              userId: peerId,
            });
          }
        } catch (error) {
        }
      };

      cleanupPresence();
    };
  }, [chatClient, userId]);

  return (
    <div>
      <FPVideoCalling
        userId={userId}
        peerId={peerId}
        channel={channel}
        isInitiator={isInitiator}
        onEndCall={onEndCall}
        isAudioCall={isAudioCall}
        peerPresenceStatus={peerPresenceStatus}
        localUserName={localUserName}
        localUserPhoto={localUserPhoto}
        peerName={peerName}
        peerAvatar={peerAvatar}
      />
    </div>
  );
}

// Memoize FPCallApp to prevent unnecessary re-renders from parent component
// This ensures that window resize events in FPChatApp don't cause re-renders
export default memo(FPCallApp);
