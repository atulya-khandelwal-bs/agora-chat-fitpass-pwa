// Call-related type definitions

import type {
  IAgoraRTCRemoteUser,
  ILocalAudioTrack,
  ILocalVideoTrack,
  UID,
} from "agora-rtc-react";
import type { RefObject } from "react";

export interface BackgroundOption {
  id: string;
  name: string;
  type: "blur" | "image";
  url?: string;
}

export interface CallEndData {
  duration: number;
  bothUsersConnected: boolean;
  callStartTime: number | null;
  callEndTime: number;
}

export interface FPCallUIProps {
  // Connection state
  isConnected: boolean;
  isStandalone: boolean;
  calling: boolean;
  // Media tracks
  localMicrophoneTrack: ILocalAudioTrack | null;
  localCameraTrack: ILocalVideoTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  // Media controls
  micOn: boolean;
  setMic: (value: boolean | ((prev: boolean) => boolean)) => void;
  cameraOn: boolean;
  setCamera: (value: boolean | ((prev: boolean) => boolean)) => void;
  speakerOn: boolean;
  setSpeakerOn: (value: boolean | ((prev: boolean) => boolean)) => void;
  // Flip camera
  flipCamera?: () => Promise<void>;
  canFlipCamera: boolean;
  // UI state
  showMoreOptions: boolean;
  setShowMoreOptions: (value: boolean | ((prev: boolean) => boolean)) => void;
  controlsVisible: boolean;
  setControlsVisible: (value: boolean) => void;
  mainUserId: UID | null;
  setMainUserId: (value: UID | null) => void;
  // Refs
  videoContainerRef: RefObject<HTMLDivElement | null>;
  hideControlsTimerRef: RefObject<NodeJS.Timeout | null>;
  // Standalone mode props
  appId: string;
  setAppId: (value: string) => void;
  channel: string;
  setChannel: (value: string) => void;
  uid: string | number;
  setUid: (value: string | number) => void;
  token: string;
  setToken: (value: string) => void;
  generatingToken: boolean;
  generateToken: () => Promise<string | null>;
  handleJoinCall: () => Promise<void>;
  // Other props
  isAudioCall: boolean;
  onEndCall: (data?: CallEndData) => void;
  peerPresenceStatus?: "offline" | "waiting" | "in_call" | null;
  // User info for avatar display
  localUserName?: string;
  localUserPhoto?: string;
  localUserId?: string;
  peerName?: string;
  peerAvatar?: string;
}

export interface FPVideoCallingProps {
  userId: string;
  peerId: string;
  channel: string;
  isInitiator: boolean;
  onEndCall: (data?: CallEndData) => void;
  isAudioCall?: boolean;
  peerPresenceStatus?: "offline" | "waiting" | "in_call" | null;
  localUserName?: string;
  localUserPhoto?: string;
  peerName?: string;
  peerAvatar?: string;
}
