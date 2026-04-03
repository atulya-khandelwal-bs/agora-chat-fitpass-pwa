import axios from "axios";
import config from "../../common/config.ts";

/**
 * Chat API Service
 * Centralized service for all chat-related API calls
 */

export interface GetDietitianTokenRequest {
  user_id: number;
  dietitian_id: number;
  /** Existing group conversation id from the conversation list, or null for a new thread */
  group_id: string | null;
}

export interface GetDietitianTokenResponse {
  token: string;
  group_id: string;
}

/**
 * Chat login: returns Agora Chat token and group id from the backend.
 */
export async function getDietitianToken(
  params: GetDietitianTokenRequest
): Promise<GetDietitianTokenResponse> {
  try {
    const response = await fetch(config.api.getDietitianToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: params.user_id,
        dietitian_id: params.dietitian_id,
        group_id: params.group_id,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(
        errorData.error || `getDietitianToken failed: ${response.status}`
      );
    }

    const raw = (await response.json()) as {
      token?: string;
      group_id?: string | number;
    };
    if (!raw.token) {
      throw new Error("Token not found in response");
    }
    const groupId =
      raw.group_id !== undefined && raw.group_id !== null
        ? String(raw.group_id)
        : "";
    if (!groupId) {
      throw new Error("group_id not found in response");
    }
    return { token: raw.token, group_id: groupId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("getDietitianToken error:", error);
    throw new Error(`getDietitianToken failed: ${errorMessage}`);
  }
}

export interface GeneratePresignUrlRequest {
  objectKey: string;
  expiresInMinutes: number;
}

export interface GeneratePresignUrlResponse {
  url: string; // Presigned upload URL
  fileUrl: string; // Public file URL after upload
}

/**
 * Generates a presigned URL for S3 file upload
 * @param objectKey - S3 object key/path
 * @param expiresInMinutes - URL expiration time in minutes
 * @returns Promise with presigned URL and file URL
 */
export async function generatePresignUrl(
  objectKey: string,
  expiresInMinutes: number = config.upload.expiresInMinutes
): Promise<GeneratePresignUrlResponse> {
  try {
    const { data } = await axios.post<GeneratePresignUrlResponse>(
      config.api.generatePresignUrl,
      {
        objectKey,
        expiresInMinutes,
      }
    );

    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Presigned URL generation error:", error);
    throw new Error(`Presigned URL generation failed: ${errorMessage}`);
  }
}

export interface UploadFileOptions {
  file: File | Blob;
  uploadUrl: string;
  contentType: string;
  onUploadProgress?: (progress: number) => void;
}

/**
 * Uploads a file to S3 using presigned URL
 * @param options - Upload options including file, URL, content type, and progress callback
 * @returns Promise that resolves when upload completes
 */
export async function uploadFileToS3(
  options: UploadFileOptions
): Promise<void> {
  const { file, uploadUrl, contentType, onUploadProgress } = options;

  try {
    await axios.put(uploadUrl, file, {
      headers: { "Content-Type": contentType },
      onUploadProgress: (event) => {
        if (onUploadProgress && event.total) {
          const percent = Math.round((event.loaded * 100) / event.total);
          onUploadProgress(percent);
        }
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("File upload error:", error);
    throw new Error(`File upload failed: ${errorMessage}`);
  }
}

/**
 * POST `/api/chat/send-custom-message-to-group` body.
 * `targetUserId` and `receiverId` are the same: dietitian / coach id.
 */
export interface SendCustomMessageRequest {
  from: string;
  groupId: string;
  /** Dietitian id (same as `receiverId`) */
  targetUserId: string;
  /** Default true (patient). Use false for call_scheduled / scheduled_call_canceled only. */
  isFromUser?: boolean;
  /** Dietitian id (same as `targetUserId`) */
  receiverId: string;
  type: string;
  data: Record<string, unknown>;
}

export interface SendCustomMessageResponse {
  success?: boolean;
  error?: string;
}

/**
 * Sends a custom message via backend API
 * @param request - Custom message request data
 * @returns Promise with response
 */
export async function sendCustomMessage(
  request: SendCustomMessageRequest
): Promise<SendCustomMessageResponse> {
  try {
    const body = {
      from: request.from,
      groupId: request.groupId,
      type: request.type,
      isFromUser: request.isFromUser ?? true,
      targetUserId: request.targetUserId,
      receiverId: request.receiverId,
      data: request.data,
    };
    const { data } = await axios.post<SendCustomMessageResponse>(
      config.api.customMessage,
      body
    );

    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Custom message send error:", error);
    throw new Error(`Custom message send failed: ${errorMessage}`);
  }
}

export interface ApiMessage {
  message_id?: string;
  conversation_id?: string;
  from_user?: string;
  to_user?: string;
  isFromUser?: boolean;
  /** Some backends return snake_case */
  is_from_user?: boolean;
  sender_name?: string;
  sender_photo?: string;
  message_type?: string;
  body?: string | object;
  created_at?: string | number;
  created_at_ms?: number;
  chat_type?: string;
  target_user_id?: number;
  chat_group_id?: string;
}

export interface FetchMessagesRequest {
  conversationId: string;
  limit?: number;
  cursor?: string;
}

export interface FetchMessagesResponse {
  messages: ApiMessage[];
  cursor?: string;
  has_more?: boolean;
}

/**
 * Fetches messages from backend API
 * @param request - conversationId (groupId), limit (page size), cursor (last timestamp)
 */
export async function fetchMessagesFromApi(
  request: FetchMessagesRequest
): Promise<FetchMessagesResponse> {
  try {
    const { conversationId, limit = 20, cursor } = request;

    const apiUrl = new URL(config.api.fetchMessages);
    apiUrl.searchParams.append("conversationId", conversationId);
    apiUrl.searchParams.append("limit", String(limit));
    if (cursor) {
      apiUrl.searchParams.append("cursor", cursor);
    }

    const response = await fetch(apiUrl.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }

    const data = await response.json();

    return {
      messages: data.messages || [],
      cursor: data.cursor,
      has_more: data.has_more || false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fetch messages error:", error);
    throw new Error(`Fetch messages failed: ${errorMessage}`);
  }
}
