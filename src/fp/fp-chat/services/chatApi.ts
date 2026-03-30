import axios from "axios";
import config from "../../common/config.ts";

/**
 * Chat API Service
 * Centralized service for all chat-related API calls
 */

export interface GenerateTokenRequest {
  username: string;
  expireInSecs: number;
}

export interface GenerateTokenResponse {
  token: string;
  error?: string;
}

/**
 * Generates Agora Chat token for authentication
 * @param username - User ID/username
 * @param expireInSecs - Token expiration time in seconds
 * @returns Promise with token string (throws error on failure)
 */
export async function generateChatToken(
  username: string,
  expireInSecs: number = config.token.expireInSecs
): Promise<string> {
  try {
    const response = await fetch(config.api.generateToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        expireInSecs,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Token generation failed: ${response.status}`
      );
    }

    const tokenData: GenerateTokenResponse = await response.json();
    if (!tokenData.token) {
      throw new Error("Token not found in response");
    }
    return tokenData.token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Token generation error:", error);
    throw new Error(`Token generation failed: ${errorMessage}`);
  }
}

export interface RegisterUserRequest {
  username: string;
}

export interface RegisterUserResponse {
  success?: boolean;
  error?: string;
}

/**
 * Registers a user with Agora Chat service
 * @param username - User ID/username to register
 * @returns Promise with boolean indicating success
 */
export async function registerUser(username: string): Promise<boolean> {
  try {
    const response = await fetch(config.api.registerUserEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });

    if (response.ok) {
      await response.json().catch(() => ({})); // Consume response body
      return true;
    } else {
      // User might already be registered
      const errorData: RegisterUserResponse = await response
        .json()
        .catch(() => ({}));

      if (response.status === 400 || response.status === 409) {
        // User exists, can proceed
        return true;
      } else {
        throw new Error(
          errorData.error || `Registration failed: ${response.status}`
        );
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Registration error:", error);
    throw new Error(`Registration failed: ${errorMessage}`);
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

export interface SendCustomMessageRequest {
  conversation_id: string;
  from_user: string;
  to_user: string;
  message_type: string;
  body: {
    messageType: string;
    payload: Record<string, unknown>;
  };
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
    const { data } = await axios.post<SendCustomMessageResponse>(
      config.api.customMessage,
      request
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
  sender_name?: string;
  sender_photo?: string;
  message_type?: string;
  body?: string | object;
  created_at?: string | number;
  created_at_ms?: number;
  chat_type?: string;
}

export interface FetchMessagesRequest {
  conversationId: string;
  userId: string;
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface FetchMessagesResponse {
  messages: ApiMessage[];
  cursor?: string;
  has_more?: boolean;
}

/**
 * Fetches messages from backend API
 * @param request - Fetch messages request parameters
 * @returns Promise with messages array and cursor
 */
export async function fetchMessagesFromApi(
  request: FetchMessagesRequest
): Promise<FetchMessagesResponse> {
  try {
    const { conversationId, userId, page = 1, pageSize = 20, cursor } = request;

    const params = new URLSearchParams({
      conversation_id: conversationId,
      user_id: userId,
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const apiUrl = new URL(config.api.fetchMessages);
    apiUrl.search = params.toString();

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
