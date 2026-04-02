import React from "react";
import AgoraRTC, { AgoraRTCProvider } from "agora-rtc-react";
import type { IAgoraRTCClient, UID } from "agora-rtc-react";
import FPCallUI from "./FPCallUI.tsx";
import {
  useIsConnected,
  useJoin,
  useLocalMicrophoneTrack,
  useLocalCameraTrack,
  usePublish,
  useRemoteUsers,
} from "agora-rtc-react";
import { useEffect, useMemo, useRef, useState } from "react";
import config from "../../common/config.ts";
import type { FPVideoCallingProps } from "../../common/types/call";
import { shouldProceedWithRemoteUsers } from "../../fp-chat/utils/blockedUIDs";
import { generateRtcToken } from "../services/rtcApi.ts";

interface FPVideoCallingInnerProps extends FPVideoCallingProps {
  client: IAgoraRTCClient;
  peerPresenceStatus?: "offline" | "waiting" | "in_call" | null;
  localUserName?: string;
  localUserPhoto?: string;
  peerName?: string;
  peerAvatar?: string;
}

// Inner component that uses Agora hooks - must be wrapped by AgoraRTCProvider
const FPVideoCallingInner = ({
  userId,
  peerId: _peerId,
  channel: propChannel,
  isInitiator: _isInitiator,
  onEndCall,
  isAudioCall = false,
  client: _client,
  peerPresenceStatus,
  localUserName,
  localUserPhoto,
  peerName,
  peerAvatar,
}: FPVideoCallingInnerProps): React.JSX.Element => {
  // State management
  const [calling, setCalling] = useState<boolean>(false);
  const isConnected = useIsConnected();
  const isStandalone = !userId || !propChannel;
  const [appId, setAppId] = useState<string>(config.agora.rtcAppId);
  const [channel, setChannel] = useState<string>(propChannel || "second-time");
  const [token, setToken] = useState<string>("");

  // Generate UID from userId (convert string to number hash)
  const generateUidFromUserId = (userId: string): number => {
    const num = Number(userId);

    // Check validity and 32-bit signed int range
    if (Number.isInteger(num) && num >= -2147483648 && num <= 2147483647) {
      return num | 0; // force 32-bit signed int
    }

    // fallback random 32-bit signed integer
    return (Math.random() * 0x7fffffff) | 0;
    // if (!userId) return 0;
    // let hash = 0;
    // for (let i = 0; i < userId.length; i++) {
    //   const char = userId.charCodeAt(i);
    //   hash = (hash << 5) - hash + char;
    //   hash = hash & hash; // Convert to 32bit integer
    // }
    // return Math.abs(hash);
  };

  const initialUid = userId ? generateUidFromUserId(userId) : 0;
  const [uid, setUid] = useState<string | number>(initialUid);
  const [generatingToken, setGeneratingToken] = useState<boolean>(false);
  const [pendingJoin, setPendingJoin] = useState<boolean>(false);
  // Track if we've already attempted to join to prevent re-joining on re-renders
  const hasAttemptedJoinRef = useRef<boolean>(false);
  // Prevent multiple simultaneous token generation requests
  const isGeneratingTokenRef = useRef<boolean>(false);
  // Prevent token-ready useEffect from running multiple times
  const hasJoinedRef = useRef<boolean>(false);

  // Media controls state
  const [micOn, setMic] = useState<boolean>(true);
  const [cameraOn, setCamera] = useState<boolean>(!isAudioCall);
  const [speakerOn, setSpeakerOn] = useState<boolean>(true);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [mainUserId, setMainUserId] = useState<UID | null>(null);

  // Flip camera state
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);

  // Refs
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const remoteUserEverJoinedRef = useRef<boolean>(false);
  // Track recovery attempts to prevent duplicate subscriptions and infinite loops
  const recoveryAttemptsRef = useRef<
    Map<string | number, { audio: number; video: number }>
  >(new Map());
  // Track video fallback attempts to prevent spam subscriptions
  const videoFallbackAttemptedRef = useRef<Set<string | number>>(new Set());

  // Agora hooks
  // Always create microphone track (don't recreate when micOn changes)
  // We'll control mute/unmute via setMuted instead of recreating the track
  // This prevents the published track from becoming invalid
  // CRITICAL: Only create tracks when call is active (calling=true)
  // This prevents tracks from being created after call ends
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(calling);
  // Create camera track conditionally based on cameraOn state
  // When camera is off, track is not created (unpublished) - remote side sees camera is off
  // When camera is on, track is created and published - remote side sees video
  const { localCameraTrack } = useLocalCameraTrack(
    calling && cameraOn && !isAudioCall
  );
  const allRemoteUsers = useRemoteUsers();

  // Helper function to stop MediaStreamTrack (system device)
  const stopMediaStreamTrack = (
    track: {
      getMediaStreamTrack?: () => MediaStreamTrack | null;
      getTrack?: () => MediaStreamTrack | null;
    } | null,
    _trackName: string // Parameter kept for API compatibility but not used
  ): void => {
    if (!track) {
      return;
    }

    try {
      // Get the underlying MediaStreamTrack
      let mediaStreamTrack: MediaStreamTrack | null = null;
      if (typeof track.getMediaStreamTrack === "function") {
        mediaStreamTrack = track.getMediaStreamTrack();
      } else if (typeof track.getTrack === "function") {
        mediaStreamTrack = track.getTrack();
      } else if ("track" in track && track.track instanceof MediaStreamTrack) {
        mediaStreamTrack = track.track as MediaStreamTrack;
      }

      // Stop the MediaStreamTrack to turn off system device
      if (mediaStreamTrack) {
        if (mediaStreamTrack.readyState !== "ended") {
          mediaStreamTrack.stop();
        } else {
        }
      } else {
      }
    } catch (error) {}
  };

  // Comprehensive function to stop ALL video tracks from DOM elements
  // This ensures we catch any tracks that might not be in the Agora track objects
  const stopAllVideoTracksFromDOM = (): void => {
    try {
      let stoppedCount = 0;

      // Method 1: Get all video elements in the DOM
      const videoElements = document.querySelectorAll("video");
      videoElements.forEach((element) => {
        if (element instanceof HTMLVideoElement) {
          const stream = element.srcObject;
          if (stream instanceof MediaStream) {
            stream.getTracks().forEach((track) => {
              if (track.kind === "video" && track.readyState !== "ended") {
                track.stop();
                stoppedCount++;
              }
            });
            // Clear the srcObject to release the stream
            element.srcObject = null;
          }
        }
      });

      // Method 2: Try to access MediaStreamTrack directly from any active streams
      // This is a more aggressive approach
      if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
      ) {
        // We can't directly enumerate active streams, but we can check all video elements again
        // and also check if there are any active tracks in the browser's internal state
        const allElements = document.querySelectorAll("*");
        allElements.forEach((element) => {
          if (
            element instanceof HTMLVideoElement ||
            element instanceof HTMLCanvasElement
          ) {
            // Check if element has any associated streams
            if (element instanceof HTMLVideoElement && element.srcObject) {
              const stream = element.srcObject as MediaStream;
              if (stream instanceof MediaStream) {
                stream.getTracks().forEach((track) => {
                  if (track.kind === "video" && track.readyState === "live") {
                    track.stop();
                    stoppedCount++;
                  }
                });
                element.srcObject = null;
              }
            }
          }
        });
      }

      // Also try to enumerate devices to check for active video tracks
      // This is a fallback for tracks that might be active but not attached to elements
      if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.enumerateDevices === "function"
      ) {
        // Enumerate all media devices to find active video tracks
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            const videoDevices = devices.filter(
              (device) => device.kind === "videoinput"
            );
            if (videoDevices.length > 0) {
            }
          })
          .catch((_err) => {});
      }

      if (stoppedCount > 0) {
      }
    } catch (error) {}
  };

  // Filter out blocked UIDs (Recorder and RTST Agent) - ignore all events for these users
  const remoteUsers = allRemoteUsers.filter((user) => {
    return shouldProceedWithRemoteUsers(user.uid);
  });

  // Log all connected users details
  useEffect(() => {
    if (isConnected && calling) {
      // This effect ensures the component re-renders when connection state changes
      // User details tracking can be added here if needed for logging/debugging
    }
  }, [
    isConnected,
    calling,
    userId,
    uid,
    localUserName,
    localUserPhoto,
    localMicrophoneTrack,
    localCameraTrack,
    micOn,
    cameraOn,
    remoteUsers,
    channel,
  ]);

  // Get available cameras
  const getCameras = async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await AgoraRTC.getDevices();
      return devices.filter((d) => d.kind === "videoinput");
    } catch (error) {
      return [];
    }
  };

  // Load cameras on mount (only for video calls) - lazy load on first user interaction for PWA
  useEffect(() => {
    if (isAudioCall || !calling) return;

    const loadCameras = async () => {
      const cams = await getCameras();
      setCameras(cams);
    };

    loadCameras();
  }, [isAudioCall, calling]);

  // Flip camera function
  const flipCamera = async (): Promise<void> => {
    if (!localCameraTrack) {
      return;
    }

    try {
      // Lazy init for iOS PWA - load cameras if not already loaded
      if (cameras.length === 0) {
        const cams = await getCameras();
        setCameras(cams);
        if (cams.length < 2) {
          return;
        }
      }

      if (cameras.length < 2) {
        return;
      }

      // Switch to next camera
      const nextIndex = (currentCameraIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];

      await localCameraTrack.setDevice(nextCamera.deviceId);
      setCurrentCameraIndex(nextIndex);
    } catch (error) {}
  };

  // Suppress Agora analytics errors
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    const isAgoraAnalyticsError = (message: unknown): boolean => {
      if (typeof message === "string") {
        return (
          message.includes("statscollector") ||
          message.includes("ERR_CONNECTION_RESET") ||
          message.includes("events/messages") ||
          message.includes("net::ERR_CONNECTION_RESET")
        );
      }
      return false;
    };

    const errorHandler = (message: unknown, ...args: unknown[]): void => {
      if (
        isAgoraAnalyticsError(message) ||
        (args.length > 0 &&
          typeof args[0] === "string" &&
          isAgoraAnalyticsError(args[0]))
      ) {
        return;
      }
      originalError(message, ...args);
    };

    const warnHandler = (message: unknown, ...args: unknown[]): void => {
      if (
        isAgoraAnalyticsError(message) ||
        (args.length > 0 &&
          typeof args[0] === "string" &&
          isAgoraAnalyticsError(args[0]))
      ) {
        return;
      }
      originalWarn(message, ...args);
    };

    console.error = errorHandler;
    console.warn = warnHandler;

    const handleRejection = (event: PromiseRejectionEvent): void => {
      const reason = event.reason?.message || event.reason?.toString() || "";
      if (isAgoraAnalyticsError(reason)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // Track call start time
  useEffect(() => {
    if (isConnected && !callStartTimeRef.current) {
      callStartTimeRef.current = Date.now();
    }
  }, [isConnected]);

  // Track previous calling state to detect call end
  const prevCallingRef = useRef<boolean>(calling);

  // Stop system camera and mic when call ends (calling becomes false)
  useEffect(() => {
    // When calling changes from true to false, stop the system devices
    if (prevCallingRef.current && !calling) {
      stopMediaStreamTrack(localCameraTrack, "camera");
      stopMediaStreamTrack(localMicrophoneTrack, "microphone");

      // Comprehensive fallback: Stop ALL video tracks from DOM
      stopAllVideoTracksFromDOM();

      // Also close the Agora tracks to fully release resources
      try {
        if (localCameraTrack && typeof localCameraTrack.close === "function") {
          localCameraTrack.close();
        }
        if (
          localMicrophoneTrack &&
          typeof localMicrophoneTrack.close === "function"
        ) {
          localMicrophoneTrack.close();
        }
      } catch (error) {}

      // Additional cleanup after a delay
      setTimeout(() => {
        stopAllVideoTracksFromDOM();
      }, 200);
    }
    prevCallingRef.current = calling;
  }, [calling, localCameraTrack, localMicrophoneTrack]);

  // Cleanup on component unmount - stop all tracks
  // Only clean up when component is truly unmounting, not when tracks change
  useEffect(() => {
    return () => {
      // Only clean up if call has ended (calling is false) or component is unmounting
      // Don't clean up during remounts when call is still active
      if (calling) {
        return;
      }

      stopMediaStreamTrack(localCameraTrack, "camera");
      stopMediaStreamTrack(localMicrophoneTrack, "microphone");

      // Comprehensive fallback: Stop ALL video tracks from DOM
      stopAllVideoTracksFromDOM();

      // Also close the Agora tracks
      try {
        if (localCameraTrack && typeof localCameraTrack.close === "function") {
          localCameraTrack.close();
        }
        if (
          localMicrophoneTrack &&
          typeof localMicrophoneTrack.close === "function"
        ) {
          localMicrophoneTrack.close();
        }
      } catch (error) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on true unmount

  // Handle remote user events and subscribe to their tracks
  useEffect(() => {
    if (!_client) return;

    // Ignore user-joined event for blocked UIDs
    const handleUserJoined = (user: { uid: string | number }): void => {
      if (!shouldProceedWithRemoteUsers(user.uid)) {
        return;
      }
    };

    // Ignore user-left event for blocked UIDs
    const handleUserLeft = (user: { uid: string | number }): void => {
      if (!shouldProceedWithRemoteUsers(user.uid)) {
        return;
      }
    };

    // Helper function to handle track setup after subscription
    const handleTrackAfterSubscription = async (
      uid: string | number,
      mediaType: "audio" | "video"
    ): Promise<void> => {
      // Get the remote user object to verify track availability
      const remoteUser = _client.remoteUsers.find((u) => u.uid === uid);

      if (mediaType === "audio") {
        // Verify audio track is available and play it
        if (remoteUser && remoteUser.audioTrack) {
          // Ensure audio track is played
          try {
            if (!remoteUser.audioTrack.isPlaying) {
              await remoteUser.audioTrack.play();
            }
            // Set volume based on speaker state
            if (typeof remoteUser.audioTrack.setVolume === "function") {
              remoteUser.audioTrack.setVolume(speakerOn ? 100 : 0);
            }
          } catch (playError) {}
        } else {
          // Don't retry here - let the recovery logic in useEffect handle it
        }
      } else if (mediaType === "video") {
        // Verify video track is available
        if (remoteUser && remoteUser.videoTrack) {
          // Log detailed video track info
        } else {
          // Log what we do have
          if (remoteUser) {
          } else {
          }
          // Don't retry here - let the recovery logic in useEffect handle it
        }
      }
    };

    // Subscribe to remote user tracks when they publish (critical for seeing/hearing remote users)
    const handleUserPublished = async (
      user: { uid: string | number; hasAudio?: boolean; hasVideo?: boolean },
      mediaType: "audio" | "video"
    ): Promise<void> => {
      if (!shouldProceedWithRemoteUsers(user.uid)) {
        return;
      }

      // For video tracks, be more aggressive - try subscribing immediately
      // The user-published event means the track is available, even if user isn't in remoteUsers yet
      const subscribeWithRetry = async (
        uid: string | number,
        type: "audio" | "video",
        retryCount = 0,
        maxRetries = 3
      ): Promise<void> => {
        try {
          await _client.subscribe(uid, type);

          // Wait a bit for the track to be available after subscription
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Handle track setup
          await handleTrackAfterSubscription(uid, type);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const isInvalidUserError =
            errorMessage.includes("INVALID_REMOTE_USER") ||
            errorMessage.includes("user is not in the channel");

          if (isInvalidUserError && retryCount < maxRetries) {
            // User might not be fully in channel yet, retry after a delay
            setTimeout(
              () => subscribeWithRetry(uid, type, retryCount + 1, maxRetries),
              500 * (retryCount + 1) // Exponential backoff
            );
          } else if (isInvalidUserError) {
          } else {
            // For non-INVALID_REMOTE_USER errors, also retry
            if (retryCount < maxRetries) {
              setTimeout(
                () => subscribeWithRetry(uid, type, retryCount + 1, maxRetries),
                500 * (retryCount + 1)
              );
            }
          }
        }
      };

      // Start subscription with retry logic
      subscribeWithRetry(user.uid, mediaType);
    };

    // Handle user-unpublished event for blocked UIDs (mute/unmute)
    const handleUserUnpublished = (user: { uid: string | number }): void => {
      if (!shouldProceedWithRemoteUsers(user.uid)) {
        return;
      }
    };

    // Add event listeners
    _client.on("user-joined", handleUserJoined);
    _client.on("user-left", handleUserLeft);
    _client.on("user-published", handleUserPublished);
    _client.on("user-unpublished", handleUserUnpublished);

    // Cleanup
    return () => {
      _client.off("user-joined", handleUserJoined);
      _client.off("user-left", handleUserLeft);
      _client.off("user-published", handleUserPublished);
      _client.off("user-unpublished", handleUserUnpublished);
    };
  }, [_client]);

  // Aggressively subscribe to all published tracks when remote users join
  // This ensures we don't miss any video tracks
  useEffect(() => {
    if (!isConnected || !calling || remoteUsers.length === 0) return;

    remoteUsers.forEach(async (user) => {
      // Check if user has published video but we don't have the track
      if (user.hasVideo && !user.videoTrack) {
        try {
          await _client.subscribe(user.uid, "video");
          // Wait a bit for track to be available
          // setTimeout(() => {
          //   const updatedUser = _client.remoteUsers.find(
          //     (u) => u.uid === user.uid
          //   );
          //   if (updatedUser?.videoTrack) {
          //   } else {
          //   }
          // },);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const isInvalidUserError =
            errorMessage.includes("INVALID_REMOTE_USER") ||
            errorMessage.includes("user is not in the channel");

          if (!isInvalidUserError) {
          }
        }
      } else if (!user.hasVideo && !user.videoTrack && !isAudioCall) {
        // Fallback: Try subscribing to video even if hasVideo is false
        // This catches cases where:
        // 1. The hasVideo flag is incorrect/stale
        // 2. Video was just published but flag hasn't updated yet
        // 3. The user-published event was missed
        // Only try once per user to avoid spam
        if (!videoFallbackAttemptedRef.current.has(user.uid)) {
          videoFallbackAttemptedRef.current.add(user.uid);
          try {
            await _client.subscribe(user.uid, "video");
            // Wait a bit and check if track is now available
            setTimeout(() => {
              const updatedUser = _client.remoteUsers.find(
                (u) => u.uid === user.uid
              );
              if (updatedUser?.videoTrack) {
                // Reset hasVideo flag tracking since we found the track
                videoFallbackAttemptedRef.current.delete(user.uid);
              } else {
              }
            }, 300);
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const isInvalidUserError =
              errorMessage.includes("INVALID_REMOTE_USER") ||
              errorMessage.includes("user is not in the channel");

            if (isInvalidUserError) {
            } else {
            }
          }
        }
      }

      // Check if user has published audio but we don't have the track
      if (user.hasAudio && !user.audioTrack) {
        try {
          await _client.subscribe(user.uid, "audio");
          const updatedUser = _client.remoteUsers.find(
            (u) => u.uid === user.uid
          );
          if (updatedUser?.audioTrack) {
            if (!updatedUser.audioTrack.isPlaying) {
              await updatedUser.audioTrack.play();
            }
            if (typeof updatedUser.audioTrack.setVolume === "function") {
              updatedUser.audioTrack.setVolume(speakerOn ? 100 : 0);
            }
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const isInvalidUserError =
            errorMessage.includes("INVALID_REMOTE_USER") ||
            errorMessage.includes("user is not in the channel");

          if (!isInvalidUserError) {
          }
        }
      }
    });
  }, [remoteUsers, isConnected, calling, _client, speakerOn]);

  // Periodic check to ensure all published video tracks are subscribed
  // This catches cases where user-published events were missed
  useEffect(() => {
    if (!isConnected || !calling) return;

    const checkInterval = setInterval(() => {
      if (remoteUsers.length === 0) return;

      remoteUsers.forEach(async (user) => {
        // If user has published video but we don't have the track, subscribe
        if (user.hasVideo && !user.videoTrack) {
          try {
            await _client.subscribe(user.uid, "video");
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const isInvalidUserError =
              errorMessage.includes("INVALID_REMOTE_USER") ||
              errorMessage.includes("user is not in the channel");

            if (!isInvalidUserError) {
            }
          }
        } else if (!user.hasVideo && !user.videoTrack && !isAudioCall) {
          // Fallback: Try subscribing even if hasVideo is false (only once per user)
          // This helps catch cases where the flag is incorrect
          if (!videoFallbackAttemptedRef.current.has(user.uid)) {
            videoFallbackAttemptedRef.current.add(user.uid);
            try {
              await _client.subscribe(user.uid, "video");
              setTimeout(() => {
                const updatedUser = _client.remoteUsers.find(
                  (u) => u.uid === user.uid
                );
                if (updatedUser?.videoTrack) {
                  videoFallbackAttemptedRef.current.delete(user.uid);
                }
              }, 300);
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              const isInvalidUserError =
                errorMessage.includes("INVALID_REMOTE_USER") ||
                errorMessage.includes("user is not in the channel");

              if (isInvalidUserError) {
                // User hasn't published video, this is expected
              }
            }
          }
        }
      });
    }, 3000); // Check every 3 seconds

    return () => clearInterval(checkInterval);
  }, [isConnected, calling, remoteUsers, _client, isAudioCall]);

  // Track if remote user ever joined (excluding recorder) and log video track status
  // Also control remote audio tracks based on speakerOn state
  // CRITICAL: Verify and ensure tracks are available even if hasAudio/hasVideo flags are false
  useEffect(() => {
    // Only run recovery logic if we're connected and in a call
    if (!isConnected || !calling || remoteUsers.length === 0) return;

    remoteUserEverJoinedRef.current = true;

    // Log remote user video track status for debugging
    remoteUsers.forEach((user) => {
      // Check actual track presence, not just hasAudio/hasVideo flags
      const hasActualAudioTrack = !!user.audioTrack;
      const hasActualVideoTrack = !!user.videoTrack;

      // Helper function to verify user is in channel before subscribing
      const isUserInChannel = (uid: string | number): boolean => {
        const userInChannel = _client.remoteUsers.find((u) => u.uid === uid);
        return !!userInChannel;
      };

      // Helper function to check if we should attempt recovery
      const shouldAttemptRecovery = (
        uid: string | number,
        mediaType: "audio" | "video"
      ): boolean => {
        // Don't attempt if user is not in channel
        if (!isUserInChannel(uid)) {
          return false;
        }

        // Limit recovery attempts to prevent infinite loops
        const attempts = recoveryAttemptsRef.current.get(uid) || {
          audio: 0,
          video: 0,
        };
        const maxAttempts = 2; // Only try twice per user per media type

        if (mediaType === "audio" && attempts.audio >= maxAttempts) {
          return false;
        }
        if (mediaType === "video" && attempts.video >= maxAttempts) {
          return false;
        }

        return true;
      };

      // If audio track is missing but hasAudio is true, try to subscribe again
      if (!hasActualAudioTrack && user.hasAudio) {
        if (shouldAttemptRecovery(user.uid, "audio")) {
          // Increment attempt counter
          const attempts = recoveryAttemptsRef.current.get(user.uid) || {
            audio: 0,
            video: 0,
          };
          recoveryAttemptsRef.current.set(user.uid, {
            ...attempts,
            audio: attempts.audio + 1,
          });

          setTimeout(async () => {
            // Double-check user is still in channel before subscribing
            if (!isUserInChannel(user.uid)) {
              return;
            }

            try {
              await _client.subscribe(user.uid, "audio");
              const updatedUser = _client.remoteUsers.find(
                (u) => u.uid === user.uid
              );
              if (updatedUser?.audioTrack) {
                if (!updatedUser.audioTrack.isPlaying) {
                  await updatedUser.audioTrack.play();
                }
                if (typeof updatedUser.audioTrack.setVolume === "function") {
                  updatedUser.audioTrack.setVolume(speakerOn ? 100 : 0);
                }
                // Reset attempt counter on success
                recoveryAttemptsRef.current.set(user.uid, {
                  ...attempts,
                  audio: 0,
                });
              }
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              const isInvalidUserError =
                errorMessage.includes("INVALID_REMOTE_USER") ||
                errorMessage.includes("user is not in the channel");

              if (isInvalidUserError) {
                // Don't retry if user is not in channel
                recoveryAttemptsRef.current.set(user.uid, {
                  ...attempts,
                  audio: 999,
                });
              } else {
              }
            }
          }, 500); // Increased delay to allow channel state to stabilize
        }
      }

      // If video track is missing but hasVideo is true, try to subscribe again
      if (!hasActualVideoTrack && user.hasVideo) {
        if (shouldAttemptRecovery(user.uid, "video")) {
          // Increment attempt counter
          const attempts = recoveryAttemptsRef.current.get(user.uid) || {
            audio: 0,
            video: 0,
          };
          recoveryAttemptsRef.current.set(user.uid, {
            ...attempts,
            video: attempts.video + 1,
          });

          setTimeout(async () => {
            // Double-check user is still in channel before subscribing
            if (!isUserInChannel(user.uid)) {
              return;
            }

            try {
              await _client.subscribe(user.uid, "video");
              const updatedUser = _client.remoteUsers.find(
                (u) => u.uid === user.uid
              );
              if (updatedUser?.videoTrack) {
                // Reset attempt counter on success
                recoveryAttemptsRef.current.set(user.uid, {
                  ...attempts,
                  video: 0,
                });
              }
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              const isInvalidUserError =
                errorMessage.includes("INVALID_REMOTE_USER") ||
                errorMessage.includes("user is not in the channel");

              if (isInvalidUserError) {
                // Don't retry if user is not in channel
                recoveryAttemptsRef.current.set(user.uid, {
                  ...attempts,
                  video: 999,
                });
              } else {
              }
            }
          }, 500); // Increased delay to allow channel state to stabilize
        }
      }

      // Control remote audio track based on speakerOn state
      if (user.audioTrack) {
        try {
          // Set volume to 0 when speaker is off, 100 when speaker is on
          if (typeof user.audioTrack.setVolume === "function") {
            user.audioTrack.setVolume(speakerOn ? 100 : 0);
          }
          // Also control playback - stop playing when speaker is off
          if (speakerOn) {
            if (!user.audioTrack.isPlaying) {
              user.audioTrack.play();
            }
          } else {
            if (user.audioTrack.isPlaying) {
              user.audioTrack.stop();
            }
          }
        } catch (error) {}
      } else if (user.hasAudio) {
        // Track should exist but doesn't - try to subscribe (only if user is in channel)
        if (shouldAttemptRecovery(user.uid, "audio")) {
          // Increment attempt counter
          const attempts = recoveryAttemptsRef.current.get(user.uid) || {
            audio: 0,
            video: 0,
          };
          recoveryAttemptsRef.current.set(user.uid, {
            ...attempts,
            audio: attempts.audio + 1,
          });

          setTimeout(async () => {
            // Double-check user is still in channel before subscribing
            if (!isUserInChannel(user.uid)) {
              return;
            }

            try {
              await _client.subscribe(user.uid, "audio");
              const updatedUser = _client.remoteUsers.find(
                (u) => u.uid === user.uid
              );
              if (updatedUser?.audioTrack) {
                if (!updatedUser.audioTrack.isPlaying) {
                  await updatedUser.audioTrack.play();
                }
                if (typeof updatedUser.audioTrack.setVolume === "function") {
                  updatedUser.audioTrack.setVolume(speakerOn ? 100 : 0);
                }
                // Reset attempt counter on success
                recoveryAttemptsRef.current.set(user.uid, {
                  ...attempts,
                  audio: 0,
                });
              }
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              const isInvalidUserError =
                errorMessage.includes("INVALID_REMOTE_USER") ||
                errorMessage.includes("user is not in the channel");

              if (isInvalidUserError) {
                // Don't retry if user is not in channel
                recoveryAttemptsRef.current.set(user.uid, {
                  ...attempts,
                  audio: 999,
                });
              } else {
              }
            }
          }, 500); // Increased delay to allow channel state to stabilize
        }
      }
    });
  }, [remoteUsers, speakerOn, _client, isConnected, calling]);

  // Reset mainUserId when number of users changes
  useEffect(() => {
    if (remoteUsers.length !== 1) {
      setMainUserId(null);
    } else if (mainUserId !== null) {
      const userExists = remoteUsers.some((user) => user.uid === mainUserId);
      if (!userExists) {
        setMainUserId(null);
      }
    }
  }, [remoteUsers.length, mainUserId, remoteUsers]);

  // Auto-hide controls on mobile
  useEffect(() => {
    if (!isConnected || !videoContainerRef.current) return;

    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const container = videoContainerRef.current;

    const resetTimer = () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      setControlsVisible(true);
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 10000);
    };

    resetTimer();

    const handleUserInteraction = (e: Event): void => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".control-bar") || target?.closest(".call-header")) {
        resetTimer();
        return;
      }
      resetTimer();
    };

    container.addEventListener("click", handleUserInteraction);
    container.addEventListener("touchstart", handleUserInteraction);
    container.addEventListener("mousemove", handleUserInteraction);

    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      container.removeEventListener("click", handleUserInteraction);
      container.removeEventListener("touchstart", handleUserInteraction);
      container.removeEventListener("mousemove", handleUserInteraction);
    };
  }, [isConnected]);

  // Agora join and publish hooks
  useJoin(
    {
      appid: appId,
      channel,
      token: token || null,
      uid:
        (typeof uid === "number" && uid > 0) ||
        (typeof uid === "string" && uid)
          ? String(uid)
          : undefined,
    },
    calling
  );
  // Only publish tracks that are not null and the call is active
  // Use useMemo to stabilize the array reference and prevent unnecessary unpublish/republish cycles
  // CRITICAL: Only publish when call is active AND connected to prevent track from being stopped
  const tracksToPublish = useMemo(() => {
    // Don't publish if call is not active or not connected - this prevents tracks from being stopped
    if (!calling || !isConnected) {
      return [];
    }

    if (isAudioCall) {
      return localMicrophoneTrack ? [localMicrophoneTrack] : [];
    }
    return [localMicrophoneTrack, localCameraTrack].filter(
      (track) => track !== null
    );
  }, [
    isAudioCall,
    localMicrophoneTrack,
    localCameraTrack,
    calling,
    isConnected,
  ]);
  usePublish(tracksToPublish);

  // Ensure microphone track is enabled and unmuted when published (critical for remote users to hear audio)
  useEffect(() => {
    if (!localMicrophoneTrack || !isConnected || !calling) return;

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const configureMicrophoneTrack = (): void => {
      if (!isMounted || !localMicrophoneTrack) return;

      try {
        // Get underlying MediaStreamTrack to check its state
        let mediaStreamTrack: MediaStreamTrack | null = null;
        if (typeof localMicrophoneTrack.getMediaStreamTrack === "function") {
          mediaStreamTrack = localMicrophoneTrack.getMediaStreamTrack();
        }

        // Check if MediaStreamTrack is still active - if not, don't try to configure
        if (mediaStreamTrack && mediaStreamTrack.readyState === "ended") {
          return;
        }

        // Ensure track is enabled based on micOn state
        if (typeof localMicrophoneTrack.setEnabled === "function") {
          localMicrophoneTrack.setEnabled(micOn);
        }

        // Ensure track is NOT muted when micOn is true (setMuted(false) means unmuted)
        // This is critical - muted tracks will cause AgoraAudioRemoteStateFailed
        if (typeof localMicrophoneTrack.setMuted === "function") {
          localMicrophoneTrack.setMuted(!micOn);
        }

        // Set volume to maximum when mic is on
        if (typeof localMicrophoneTrack.setVolume === "function" && micOn) {
          localMicrophoneTrack.setVolume(100);
        }

        // CRITICAL: Ensure the underlying MediaStreamTrack is also enabled and not muted
        // The Agora track can be unmuted while the MediaStreamTrack is muted, which prevents audio transmission
        if (mediaStreamTrack && micOn) {
          if (mediaStreamTrack.enabled === false) {
            mediaStreamTrack.enabled = true;
          }
          if (mediaStreamTrack.muted === true) {
            // Note: MediaStreamTrack.muted is read-only, but we can check it
            // If it's muted, it might be due to browser/system settings
          }
        }

        // Track state verification - can be used for debugging if needed
        // const trackState = {
        //   enabled: localMicrophoneTrack.enabled,
        //   muted: localMicrophoneTrack.muted,
        //   hasTrack: !!localMicrophoneTrack,
        //   micOn: micOn,
        //   trackId: localMicrophoneTrack.getTrackId?.() || "unknown",
        //   mediaStreamTrackReadyState: mediaStreamTrack?.readyState || "N/A",
        //   mediaStreamTrackEnabled: mediaStreamTrack?.enabled ?? "N/A",
        //   mediaStreamTrackMuted: mediaStreamTrack?.muted ?? "N/A",
        //   mediaStreamTrackConstraints: mediaStreamTrack?.getConstraints?.() || "N/A",
        //   mediaStreamTrackSettings: mediaStreamTrack?.getSettings?.() || "N/A",
        // };

        // CRITICAL: Verify the track is actually ready to send audio
        if (micOn && mediaStreamTrack) {
          if (mediaStreamTrack.readyState !== "live") {
          }
          if (mediaStreamTrack.enabled === false) {
          }
          if (mediaStreamTrack.muted === true) {
          }
        }

        // If track is still muted when it should be unmuted, retry
        if (micOn && localMicrophoneTrack.muted && retryCount < maxRetries) {
          retryCount++;
          setTimeout(configureMicrophoneTrack, 200);
        } else if (micOn && localMicrophoneTrack.muted) {
        }
      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(configureMicrophoneTrack, 200);
        }
      }
    };

    // Initial configuration with small delay to ensure track is ready
    const timeoutId1 = setTimeout(configureMicrophoneTrack, 50);
    // Also configure after a longer delay to catch any late initialization
    const timeoutId2 = setTimeout(configureMicrophoneTrack, 200);

    // Listen for track state changes
    let trackStateCheckInterval: NodeJS.Timeout | null = null;
    if (isConnected && calling) {
      trackStateCheckInterval = setInterval(() => {
        if (localMicrophoneTrack && micOn) {
          // Periodically check and fix track state
          if (localMicrophoneTrack.muted) {
            if (typeof localMicrophoneTrack.setMuted === "function") {
              localMicrophoneTrack.setMuted(false);
            }
          }
          if (!localMicrophoneTrack.enabled) {
            if (typeof localMicrophoneTrack.setEnabled === "function") {
              localMicrophoneTrack.setEnabled(true);
            }
          }
        }
      }, 2000); // Check every 2 seconds
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      if (trackStateCheckInterval) {
        clearInterval(trackStateCheckInterval);
      }
    };
  }, [localMicrophoneTrack, isConnected, calling, micOn]);

  // Ensure camera track is enabled/disabled based on cameraOn state
  // When camera is off: disable the track (remote sees camera is off) and stop MediaStreamTrack (system camera off)
  // When camera is on: enable the track (remote sees video) and ensure MediaStreamTrack is running
  useEffect(() => {
    if (!localCameraTrack || !isConnected || !calling || isAudioCall) {
      // If camera is off and we have a track, make sure it's disabled
      if (localCameraTrack && !cameraOn && !isAudioCall) {
        try {
          if (typeof localCameraTrack.setEnabled === "function") {
            localCameraTrack.setEnabled(false);
          }
        } catch (error) {}
      }
      return;
    }

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const configureCameraTrack = (): void => {
      if (!isMounted || !localCameraTrack) return;

      try {
        // Get underlying MediaStreamTrack to control system camera
        let mediaStreamTrack: MediaStreamTrack | null = null;
        if (typeof localCameraTrack.getMediaStreamTrack === "function") {
          mediaStreamTrack = localCameraTrack.getMediaStreamTrack();
        } else if (
          "track" in localCameraTrack &&
          localCameraTrack.track instanceof MediaStreamTrack
        ) {
          mediaStreamTrack = localCameraTrack.track as MediaStreamTrack;
        }

        // Control track enabled state (this affects what remote side sees)
        if (typeof localCameraTrack.setEnabled === "function") {
          localCameraTrack.setEnabled(cameraOn);
        }

        // Control underlying MediaStreamTrack to turn system camera on/off
        if (mediaStreamTrack) {
          if (cameraOn) {
            // Camera on: ensure MediaStreamTrack is enabled and running
            if (mediaStreamTrack.enabled === false) {
              mediaStreamTrack.enabled = true;
            }
            // If track was stopped, we can't restart it - track will need to be recreated
            // But since we always create the track, this shouldn't happen
          } else {
            // Camera off: disable MediaStreamTrack (stops capturing frames)
            // Note: Setting enabled=false stops capturing but the system camera indicator may stay on
            // This is a browser limitation - we can't fully turn off the camera while keeping the track
            if (mediaStreamTrack.enabled === true) {
              mediaStreamTrack.enabled = false;
            }
            // Also try to stop the track to turn off system camera completely
            // This will make the track unusable, but when camera is turned back on, the track will be recreated
            if (mediaStreamTrack.readyState === "live") {
              try {
                mediaStreamTrack.stop();
              } catch (error) {}
            }
          }
        }

        // Track state verification - can be used for debugging if needed
        // const trackState = {
        //   enabled: localCameraTrack.enabled,
        //   hasTrack: !!localCameraTrack,
        //   cameraOn: cameraOn,
        //   trackId: localCameraTrack.getTrackId?.() || "unknown",
        //   mediaStreamTrackReadyState: mediaStreamTrack?.readyState || "N/A",
        //   mediaStreamTrackEnabled: mediaStreamTrack?.enabled ?? "N/A",
        // };

        // If track is not in correct state, retry
        if (cameraOn && !localCameraTrack.enabled && retryCount < maxRetries) {
          retryCount++;
          setTimeout(configureCameraTrack, 200);
        } else if (cameraOn && !localCameraTrack.enabled) {
        }
      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(configureCameraTrack, 200);
        }
      }
    };

    // Initial configuration with small delay to ensure track is ready
    const timeoutId1 = setTimeout(configureCameraTrack, 50);
    // Also configure after a longer delay to catch any late initialization
    const timeoutId2 = setTimeout(configureCameraTrack, 200);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [localCameraTrack, isConnected, calling, cameraOn, isAudioCall]);

  // Generate token from API
  const generateToken = async (): Promise<string | null> => {
    if (!channel || typeof uid !== "number") {
      if (!isStandalone) {
      } else {
        alert("Please enter channel name and UID");
      }
      return null;
    }

    // Prevent multiple simultaneous token generation requests
    if (isGeneratingTokenRef.current) {
      return null;
    }

    isGeneratingTokenRef.current = true;
    setGeneratingToken(true);
    try {
      const newToken = await generateRtcToken({
        channelName: channel,
        username: userId ? String(userId) : String(uid),
        expireInSecs: 7200,
      });
      setToken(newToken);
      isGeneratingTokenRef.current = false;
      setGeneratingToken(false);
      return newToken;
    } catch (error) {
      isGeneratingTokenRef.current = false;
      setGeneratingToken(false);
      alert(
        `Failed to generate token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    }
  };

  // Handle join call
  const handleJoinCall = async (): Promise<void> => {
    if (!token && channel && typeof uid === "number") {
      setPendingJoin(true);
      const generatedToken = await generateToken();
      if (!generatedToken) {
        setPendingJoin(false);
        alert("Failed to generate token. Cannot join call.");
        return;
      }
    } else if (token) {
      setCalling(true);
    } else {
      alert("Token is required to join the call");
    }
  };

  // Auto-join when props are provided - only run once to prevent re-joining on re-renders
  useEffect(() => {
    // Prevent re-running if we've already attempted to join or if conditions aren't met
    // CRITICAL: Check hasJoinedRef first to prevent re-running after successful join
    if (
      hasJoinedRef.current ||
      hasAttemptedJoinRef.current ||
      isStandalone ||
      !propChannel ||
      !userId ||
      calling ||
      token ||
      pendingJoin ||
      generatingToken ||
      isGeneratingTokenRef.current ||
      typeof uid !== "number" ||
      uid <= 0
    ) {
      return;
    }

    hasAttemptedJoinRef.current = true;
    const autoJoin = async () => {
      setPendingJoin(true);
      const generatedToken = await generateToken();
      if (generatedToken) {
        setToken(generatedToken);
      } else {
        setPendingJoin(false);
        hasAttemptedJoinRef.current = false; // Reset on failure to allow retry
      }
    };
    autoJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isStandalone,
    propChannel,
    userId,
    uid,
    calling,
    token,
    pendingJoin,
    generatingToken,
  ]);

  // Handle join when token is ready
  useEffect(() => {
    // Only join if we have all required conditions and haven't already joined
    if (
      pendingJoin &&
      token &&
      !hasJoinedRef.current &&
      !calling &&
      !isGeneratingTokenRef.current &&
      appId &&
      channel &&
      typeof uid === "number"
    ) {
      hasJoinedRef.current = true; // Set ref to prevent re-running
      setPendingJoin(false);
      // Set calling immediately to show call UI
      setCalling(true);
    }
  }, [token, pendingJoin, appId, channel, uid, calling]);

  // Reset pendingJoin when connected
  useEffect(() => {
    if (isConnected && pendingJoin) {
      setPendingJoin(false);
    }
  }, [isConnected, pendingJoin]);

  // Cleanup refs when call ends to allow new calls
  // Only reset when call is fully ended (not just paused)
  useEffect(() => {
    if (!calling && !pendingJoin && !generatingToken && !token) {
      // Only reset if we're truly not in a call state
      // Add a small delay to ensure all state updates have completed
      const resetTimer = setTimeout(() => {
        if (!calling && !pendingJoin && !generatingToken && !token) {
          hasJoinedRef.current = false;
          hasAttemptedJoinRef.current = false;
          isGeneratingTokenRef.current = false;
          recoveryAttemptsRef.current.clear();
          videoFallbackAttemptedRef.current.clear();
        }
      }, 500);
      return () => clearTimeout(resetTimer);
    }
  }, [calling, pendingJoin, generatingToken, token]);

  // Close more options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        !target?.closest(".more-options-menu") &&
        !target?.closest(".more-options-button")
      ) {
        setShowMoreOptions(false);
      }
    };

    if (showMoreOptions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showMoreOptions]);

  // Handlers

  const handleEndCall = (): void => {
    // CRITICAL: Set calling to false FIRST to prevent new tracks from being created
    // This ensures the hooks stop creating new tracks immediately
    setCalling(false);
    // Also reset camera state to ensure no new camera tracks are created
    setCamera(false);

    // Get current track references before state updates
    const currentCameraTrack = localCameraTrack;
    const currentMicTrack = localMicrophoneTrack;

    // Stop MediaStreamTracks immediately (turns off system devices)
    stopMediaStreamTrack(currentCameraTrack, "camera");
    stopMediaStreamTrack(currentMicTrack, "microphone");

    // Comprehensive fallback: Stop ALL video tracks from DOM elements
    // This catches any tracks that might not be in the Agora track objects
    stopAllVideoTracksFromDOM();

    // Also close the Agora tracks to fully release resources
    try {
      if (
        currentCameraTrack &&
        typeof currentCameraTrack.close === "function"
      ) {
        currentCameraTrack.close();
      }
      if (currentMicTrack && typeof currentMicTrack.close === "function") {
        currentMicTrack.close();
      }
    } catch (error) {}

    // Multiple cleanup passes to ensure all tracks are stopped
    // Pass 1: Immediate cleanup
    setTimeout(() => {
      stopAllVideoTracksFromDOM();
      // Also try to stop tracks from the current references again
      stopMediaStreamTrack(currentCameraTrack, "camera");
    }, 50);

    // Pass 2: Delayed cleanup to catch any tracks created during transition
    setTimeout(() => {
      stopAllVideoTracksFromDOM();
    }, 200);

    // Pass 3: Final cleanup after a longer delay
    setTimeout(() => {
      stopAllVideoTracksFromDOM();
    }, 500);

    if (onEndCall) {
      const callEndTime = Date.now();
      const callStartTime = callStartTimeRef.current;
      const duration = callStartTime
        ? Math.floor((callEndTime - callStartTime) / 1000)
        : 0;
      const bothUsersConnected = remoteUserEverJoinedRef.current;

      onEndCall({
        duration,
        bothUsersConnected,
        callStartTime,
        callEndTime,
      });

      callStartTimeRef.current = null;
      remoteUserEverJoinedRef.current = false;
    }
  };

  return (
    <div>
      <FPCallUI
        // Connection state
        isConnected={isConnected}
        isStandalone={isStandalone}
        calling={calling}
        // Media tracks
        localMicrophoneTrack={localMicrophoneTrack}
        localCameraTrack={localCameraTrack}
        remoteUsers={remoteUsers}
        // Media controls
        micOn={micOn}
        setMic={setMic}
        cameraOn={cameraOn}
        setCamera={setCamera}
        speakerOn={speakerOn}
        setSpeakerOn={setSpeakerOn}
        // Flip camera
        flipCamera={flipCamera}
        canFlipCamera={cameras.length >= 2}
        // UI state
        showMoreOptions={showMoreOptions}
        setShowMoreOptions={setShowMoreOptions}
        controlsVisible={controlsVisible}
        setControlsVisible={setControlsVisible}
        mainUserId={mainUserId}
        setMainUserId={setMainUserId}
        // Refs
        videoContainerRef={videoContainerRef}
        hideControlsTimerRef={hideControlsTimerRef}
        // Standalone mode props
        appId={appId}
        setAppId={setAppId}
        channel={channel}
        setChannel={setChannel}
        uid={uid}
        setUid={setUid}
        token={token}
        setToken={setToken}
        generatingToken={generatingToken}
        generateToken={generateToken}
        handleJoinCall={handleJoinCall}
        // Other props
        isAudioCall={isAudioCall}
        onEndCall={handleEndCall}
        peerPresenceStatus={peerPresenceStatus}
        // User info
        localUserId={userId}
        localUserName={localUserName}
        localUserPhoto={localUserPhoto}
        peerName={peerName}
        peerAvatar={peerAvatar}
      />
    </div>
  );
};

// Outer component that creates client and wraps with provider
export const FPVideoCalling = ({
  userId,
  peerId,
  channel: propChannel,
  isInitiator,
  onEndCall,
  isAudioCall = false,
  peerPresenceStatus,
  localUserName,
  localUserPhoto,
  peerName,
  peerAvatar,
}: FPVideoCallingProps): React.JSX.Element => {
  // Create Agora client
  const client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8",
  });

  return (
    <AgoraRTCProvider client={client}>
      <FPVideoCallingInner
        userId={userId}
        peerId={peerId}
        channel={propChannel}
        isInitiator={isInitiator}
        onEndCall={onEndCall}
        isAudioCall={isAudioCall}
        client={client}
        peerPresenceStatus={peerPresenceStatus}
        localUserName={localUserName}
        localUserPhoto={localUserPhoto}
        peerName={peerName}
        peerAvatar={peerAvatar}
      />
    </AgoraRTCProvider>
  );
};
