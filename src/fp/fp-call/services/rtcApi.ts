import config from "../../common/config.ts";

/**
 * RTC API Service
 * Centralized service for RTC (Real-Time Communication) related API calls
 */

export interface GenerateRtcTokenRequest {
  channelName: string;
  uid: number | string;
  expireSecs?: number;
  role?: "publisher" | "subscriber";
}

export interface GenerateRtcTokenResponse {
  token: string;
  error?: string;
}

/**
 * Generates Agora RTC token for video/audio calling
 * @param request - RTC token generation request
 * @returns Promise with RTC token string
 */
export async function generateRtcToken(
  request: GenerateRtcTokenRequest
): Promise<string> {
  try {
    const { channelName, uid, expireSecs = 3600, role = "publisher" } = request;

    const response = await fetch(config.rtcToken.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelName,
        uid,
        expireSecs,
        role,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate token: ${response.statusText}`);
    }

    const data = (await response.json()) as GenerateRtcTokenResponse;

    if (!data.token) {
      throw new Error("Token not found in response");
    }

    return data.token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("RTC token generation error:", error);
    throw new Error(`RTC token generation failed: ${errorMessage}`);
  }
}





















