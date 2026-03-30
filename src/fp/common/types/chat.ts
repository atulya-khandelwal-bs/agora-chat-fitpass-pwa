// Chat-related type definitions

export interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastSeen?: string;
  lastMessage?: string | object;
  timestamp?: Date | null;
  lastMessageFrom?: string | null;
  conversationId?: string;
  messageCount?: number;
  unreadCount?: number;
  filterState?: string;
  description?: string;
  replyCount?: number;
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  isIncoming: boolean;
  messageType?: string;
  imageUrl?: string;
  imageData?: string;
  audioUrl?: string;
  audioDurationMs?: number;
  fileUrl?: string;
  fileName?: string;
  fileMime?: string;
  fileSizeBytes?: number;
  fileSize?: string;
  products?: Product[];
  callType?: string;
  callDurationSeconds?: number | undefined;
  audioTranscription?: string;
  label?: string;
  avatar?: string;
  system?: SystemMessageData;
  createdAt?: string | Date;
  peerId?: string;
  callAction?: string;
  channel?: string;
  isEdited?: boolean;
  mid?: string; // Message ID from delivery receipt (for editing)
  serverMsgId?: string; // Server message ID for matching edited messages
}

export interface MealPlanIconsDetails {
  left_icon?: string;
  right_icon?: string;
}

export interface MealPlanRedirectionDetail {
  cta_details?: Record<string, unknown>;
  redirect_url?: string;
  action_id?: string;
}

export interface MealPlanPayload {
  action_type?: string;
  title?: string;
  description?: string;
  icons_details?: MealPlanIconsDetails;
  redirection_details?: MealPlanRedirectionDetail[];
}

export interface SystemMessageData {
  kind?: string;
  name?: string;
  title?: string;
  profilePhoto?: string;
  payload?: {
    id?: string;
    name?: string;
    title?: string;
    profilePhoto?: string;
    action_type?: string;
    description?: string;
    icons_details?: MealPlanIconsDetails;
    redirection_details?: MealPlanRedirectionDetail[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  actual_amount: number;
  selling_amount: number;
  image_url: string;
  action_id: string;
  rediection_url: string; // Note: API uses "rediection" (typo) instead of "redirection"
  cta_details: {
    text: string;
    text_color: string;
    bg_color: string;
  };
}

export interface DraftAttachment {
  type: "image" | "audio" | "file";
  url: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  duration?: number;
}

export interface CoachInfo {
  coachName: string;
  profilePhoto: string;
}

export interface LogEntry {
  log?: string;
  message?: string; // Alternative to log for structured messages
  timestamp?: Date;
  serverMsgId?: string; // Server message ID from Agora (for editing messages)
  mid?: string; // Message ID from delivery receipt (for editing messages)
  isEdited?: boolean; // Flag to indicate this is an edited message
}
