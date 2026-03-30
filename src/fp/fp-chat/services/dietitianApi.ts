import axios from "axios";

export interface DietitianDetails {
  dietitian_name: string;
  avg_rating: number;
  dietitian_experience: string;
  dietitian_photo: string;
  dietitian_profile: string;
  number_consultations: string;
  health_coach_id: number;
}

export interface HealthCoachSchedule {
  date: string;
  slots: Array<{
    health_coach_schedule_id: number;
    start_time: string;
    available: number;
    schedule_call_id?: number;
  }>;
  meta: {
    title?: string;
    description?: string;
    icon?: string;
    bg_color?: string;
  };
}

export interface DietitianApiResponse {
  code: number;
  message: string;
  meta: Record<string, unknown>;
  result: {
    dietitian_details: DietitianDetails;
    description: string;
    call_schedule: {
      title: {
        label: string;
        font_color: string;
        string_to_replace: string;
      };
      choose_timing: {
        title: string;
        description: string;
      };
    };
    tags: string[];
    rating_tags: Array<{
      rating: number;
      rating_text: string;
      tags: string[];
    }>;
    next_available_slot: number[];
    is_public_holiday: number;
    health_coach_schedules: HealthCoachSchedule[];
  };
  status: string;
}

/**
 * Fetches dietitian details from the API
 * @param callDate - Epoch timestamp (in seconds) for the call date. Defaults to today's date.
 * @returns Promise with the dietitian details response
 */
export async function fetchDietitianDetails(
  callDate?: number
): Promise<DietitianApiResponse> {
  // If no date provided, use today's date as epoch timestamp
  if (!callDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    callDate = Math.floor(today.getTime() / 1000);
  }

  const response = await axios.post<DietitianApiResponse>(
    "https://services.fitpass.dev/customers/fitfeast/get-dietitian-details",
    {
      request_source: "call_schedule",
      call_date: callDate,
    },
    {
      headers: {
        "X-FITPASS-PAYLOAD":
          "960Q8XJxoh/dlIBO9Yh55EXQiWiKjgHhvqi15eicHeGY8yo1ZwZbrSDPXp4e+TTn+ftbh/iGVtQyBYM7DpwZTQ8YRzK7k2bxnUqywCeuRylFmfiCdWxZYYsiCNWsjruSBfu5q8c38kGJoH7aapXAjOjP2jV1IsZHYp+RhbAk6aS3bKknPTw8YKtshnkVgbJitD2JLrrfFOkA+y9/CSr5cLJLkgI5CqfnRtebsS/oepbti0XTLochPgJL5P9lH+ACkBa8DAzy+wlfC0CGIAe8GLfl6d30+hkCg6IK/VlpcuV43BRC71qbPHv7V5HLghQAfRiQKrQ/kGpbw5mp3gdwJtpmBcs20IHwYk6QpoMZf3OBCukVCMVt9LquCGq4vNKm1H2o3U3DoFJzGzqDjTJ5tjk9MUYOQhs861z9AegnPg75ir64cT4JFAhjqsNa4RUB",
        "X-FITPASS-APP-KEY": "fhskjdhfkjsdahgkjadsfmgbasdiughdiag",
        "X-AUTH-TOKEN": "l9xGmxeF6GU4djgsMDBWG9ui0xeDhvR7qxbWq1M9",
        "X-ACCEPT-HEADERS": "Yes",
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

export interface ScheduleCallRequest {
  call_type: string;
  call_date_time: number; // Epoch timestamp in seconds
  call_purpose: string;
  health_coach_schedule_id: number;
  health_coach_id: number;
  start_time: string;
}

export interface ScheduleCallResponse {
  code: number;
  message: string;
  status: string;
  result?: unknown;
}

/**
 * Schedules a call with a dietitian
 * @param scheduleData - The schedule call request data
 * @returns Promise with the schedule call response
 */
export async function scheduleCallWithDietitian(
  scheduleData: ScheduleCallRequest
): Promise<ScheduleCallResponse> {
  const response = await axios.post<ScheduleCallResponse>(
    "https://services.fitpass.dev/customers/fitfeast/schedule-call-with-dieticians",
    scheduleData,
    {
      headers: {
        "X-FITPASS-PAYLOAD":
          "960Q8XJxoh/dlIBO9Yh55EXQiWiKjgHhvqi15eicHeGY8yo1ZwZbrSDPXp4e+TTn+ftbh/iGVtQyBYM7DpwZTQ8YRzK7k2bxnUqywCeuRylFmfiCdWxZYYsiCNWsjruSBfu5q8c38kGJoH7aapXAjOjP2jV1IsZHYp+RhbAk6aS3bKknPTw8YKtshnkVgbJitD2JLrrfFOkA+y9/CSr5cLJLkgI5CqfnRtebsS/oepbti0XTLochPgJL5P9lH+ACkBa8DAzy+wlfC0CGIAe8GLfl6d30+hkCg6IK/VlpcuV43BRC71qbPHv7V5HLghQAfRiQKrQ/kGpbw5mp3gdwJtpmBcs20IHwYk6QpoMZf3OBCukVCMVt9LquCGq4vNKm1H2o3U3DoFJzGzqDjTJ5tjk9MUYOQhs861z9AegnPg75ir64cT4JFAhjqsNa4RUB",
        "X-FITPASS-APP-KEY": "fhskjdhfkjsdahgkjadsfmgbasdiughdiag",
        "X-ACCEPT-HEADERS": "Yes",
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

export interface CancelCallRequest {
  schedule_call_id: number;
}

export interface CancelCallResponse {
  code: number;
  message: string;
  status: string;
  result?: unknown;
}

/**
 * Cancels a scheduled call with a dietitian
 * @param scheduleCallId - The schedule_call_id of the call to cancel
 * @returns Promise with the cancel call response
 */
export async function cancelCallWithDietitian(
  scheduleCallId: number
): Promise<CancelCallResponse> {
  const response = await axios.post<CancelCallResponse>(
    "https://services.fitpass.dev/customers/fitfeast/cancel-call-with-dieticians",
    {
      schedule_call_id: scheduleCallId,
    },
    {
      headers: {
        "X-FITPASS-PAYLOAD":
          "960Q8XJxoh/dlIBO9Yh55EXQiWiKjgHhvqi15eicHeGY8yo1ZwZbrSDPXp4e+TTn+ftbh/iGVtQyBYM7DpwZTQ8YRzK7k2bxnUqywCeuRylFmfiCdWxZYYsiCNWsjruSBfu5q8c38kGJoH7aapXAjOjP2jV1IsZHYp+RhbAk6aS3bKknPTw8YKtshnkVgbJitD2JLrrfFOkA+y9/CSr5cLJLkgI5CqfnRtebsS/oepbti0XTLochPgJL5P9lH+ACkBa8DAzy+wlfC0CGIAe8GLfl6d30+hkCg6IK/VlpcuV43BRC71qbPHv7V5HLghQAfRiQKrQ/kGpbw5mp3gdwJtpmBcs20IHwYk6QpoMZf3OBCukVCMVt9LquCGq4vNKm1H2o3U3DoFJzGzqDjTJ5tjk9MUYOQhs861z9AegnPg75ir64cT4JFAhjqsNa4RUB",
        "X-FITPASS-APP-KEY": "fhskjdhfkjsdahgkjadsfmgbasdiughdiag",
        "X-AUTH-TOKEN": "l9xGmxeF6GU4djgsMDBWG9ui0xeDhvR7qxbWq1M9",
        "X-ACCEPT-HEADERS": "Yes",
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}
