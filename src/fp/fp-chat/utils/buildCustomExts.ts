/**
 * Helper function to build customExts based on message payload
 * Used when sending custom messages (images, files, audio, etc.)
 */

interface ImagePayload {
  type: "image";
  url: string;
  height?: number;
  width?: number;
}

interface AudioPayload {
  type: "audio";
  url: string;
  duration?: number;
  transcription?: string;
}

interface FilePayload {
  type: "file";
  url: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
}

interface MealPlanIconsDetails {
  left_icon?: string;
  right_icon?: string;
}

interface MealPlanRedirectionDetail {
  cta_details?: Record<string, unknown>;
  redirect_url?: string;
  action_id?: string;
}

interface MealPlanPayload {
  type: "meal_plan_updated" | "meal_plan_update";
  action_type?: string;
  title?: string;
  description?: string;
  icons_details?: MealPlanIconsDetails;
  redirection_details?: MealPlanRedirectionDetail[];
  id?: string;
}

interface NutritionistPayload {
  type:
    | "new_nutritionist"
    | "new_nutrionist"
    | "coach_assigned"
    | "coach_details";
  id?: string;
  name?: string;
  title?: string;
  profilePhoto?: string;
  description?: string;
  action_type?: string;
  icons_details?: MealPlanIconsDetails;
}

interface ProductsPayload {
  type: "products";
  products?: unknown[];
}

interface CallPayload {
  type: "video_call" | "voice_call";
  title?: string;
  description?: string;
  icons_details?: MealPlanIconsDetails;
  call_details?: {
    call_url?: string;
  };
  redirection_details?: MealPlanRedirectionDetail[];
}

interface GeneralNotificationPayload {
  type: "general_notification" | "general-notification";
  action_type?: string;
  title?: string;
  description?: string;
  redirection_details?: MealPlanRedirectionDetail[];
}

interface DocumentsPayload {
  type: "documents";
  title?: string;
  description?: string;
  icons_details?: MealPlanIconsDetails;
  documents_details?: {
    document_url?: string;
    document_size?: number;
    document_type?: string;
  };
  redirection_details?: MealPlanRedirectionDetail[];
}

interface CallScheduledPayload {
  type: "call_scheduled" | "scheduled_call_canceled";
  time: number | string; // Epoch time in seconds (number or string)
}

type MessagePayload =
  | ImagePayload
  | AudioPayload
  | FilePayload
  | MealPlanPayload
  | NutritionistPayload
  | ProductsPayload
  | CallPayload
  | GeneralNotificationPayload
  | DocumentsPayload
  | CallScheduledPayload
  | { type: string; [key: string]: unknown };

interface CustomExts {
  type: string;
  [key: string]: string | unknown[] | undefined;
}

export function buildCustomExts(
  payload: MessagePayload | null | undefined
): CustomExts | null {
  if (!payload || typeof payload !== "object" || !payload.type) {
    return null;
  }

  const type = String(payload.type).toLowerCase();

  switch (type) {
    case "image": {
      const imagePayload = payload as ImagePayload;
      return {
        type: "image",
        url: imagePayload.url,
        height: (imagePayload.height ?? 720).toString(),
        width: (imagePayload.width ?? 1280).toString(),
      };
    }

    case "audio": {
      const audioPayload = payload as AudioPayload;
      // Convert duration to milliseconds if it appears to be in seconds (< 3600)
      let durationMs = audioPayload.duration;
      if (typeof durationMs === "number" && durationMs < 3600) {
        durationMs = durationMs * 1000; // Convert seconds to milliseconds
      }
      return {
        type: "audio",
        url: audioPayload.url,
        transcription: audioPayload.transcription || "",
        duration:
          typeof durationMs === "number" ? (durationMs / 1000).toString() : "0", // in milliseconds, default to 0 if not provided
      };
    }

    case "file": {
      const filePayload = payload as FilePayload;
      return {
        type: "file",
        url: filePayload.url,
        fileName: filePayload.fileName || "",
        mimeType: filePayload.mimeType || "application/octet-stream",
        size:
          typeof filePayload.size === "number"
            ? filePayload.size.toString()
            : "0", // in bytes
      };
    }

    case "meal_plan_updated":
    case "meal_plan_update": {
      const mealPlanPayload = payload as MealPlanPayload;
      return {
        type: "meal_plan_updated",
        action_type: mealPlanPayload.action_type || "meal_plan_update",
        title: mealPlanPayload.title || "",
        description: mealPlanPayload.description || "",
        icons_details: mealPlanPayload.icons_details
          ? JSON.stringify(mealPlanPayload.icons_details)
          : undefined,
        redirection_details: mealPlanPayload.redirection_details
          ? JSON.stringify(mealPlanPayload.redirection_details)
          : undefined,
        id: mealPlanPayload.id || "",
      };
    }

    case "new_nutritionist":
    case "new_nutrionist": // Handle typo variant
    case "coach_assigned":
    case "coach_details": {
      const nutritionistPayload = payload as NutritionistPayload;
      // For coach_assigned/coach_details, preserve the original type and structure
      return {
        type:
          nutritionistPayload.type === "coach_assigned"
            ? "coach_assigned"
            : nutritionistPayload.type === "coach_details"
            ? "coach_details"
            : "new_nutritionist",
        id: nutritionistPayload.id || "",
        name: nutritionistPayload.name || "",
        title: nutritionistPayload.title || "",
        profilePhoto:
          nutritionistPayload.profilePhoto ||
          nutritionistPayload.icons_details?.left_icon ||
          "",
        description: nutritionistPayload.description || "",
        action_type: nutritionistPayload.action_type || "",
        icons_details: nutritionistPayload.icons_details
          ? JSON.stringify(nutritionistPayload.icons_details)
          : undefined,
      };
    }

    case "products": {
      const productsPayload = payload as ProductsPayload;
      return {
        type: "products",
        products: Array.isArray(productsPayload.products)
          ? productsPayload.products
          : [],
      };
    }

    case "video_call":
    case "voice_call": {
      const callPayload = payload as CallPayload;
      return {
        type: type, // "video_call" or "voice_call"
        title: callPayload.title || "",
        description: callPayload.description || "",
        icons_details: callPayload.icons_details
          ? JSON.stringify(callPayload.icons_details)
          : undefined,
        call_details: callPayload.call_details
          ? JSON.stringify(callPayload.call_details)
          : undefined,
        redirection_details: callPayload.redirection_details
          ? JSON.stringify(callPayload.redirection_details)
          : undefined,
      };
    }

    case "general_notification":
    case "general-notification": {
      const notificationPayload = payload as GeneralNotificationPayload;
      return {
        type: "general_notification",
        action_type: notificationPayload.action_type || "general-notification",
        title: notificationPayload.title || "",
        description: notificationPayload.description || "",
        redirection_details: notificationPayload.redirection_details
          ? JSON.stringify(notificationPayload.redirection_details)
          : undefined,
      };
    }

    case "documents": {
      const documentsPayload = payload as DocumentsPayload;
      return {
        type: "documents",
        title: documentsPayload.title || "",
        description: documentsPayload.description || "",
        icons_details: documentsPayload.icons_details
          ? JSON.stringify(documentsPayload.icons_details)
          : undefined,
        documents_details: documentsPayload.documents_details
          ? JSON.stringify(documentsPayload.documents_details)
          : undefined,
        redirection_details: documentsPayload.redirection_details
          ? JSON.stringify(documentsPayload.redirection_details)
          : undefined,
      };
    }

    case "call_scheduled":
    case "scheduled_call_canceled": {
      const callScheduledPayload = payload as CallScheduledPayload;
      // Handle both number and string formats for time
      const timeValue =
        typeof callScheduledPayload.time === "number"
          ? callScheduledPayload.time.toString()
          : typeof callScheduledPayload.time === "string"
          ? callScheduledPayload.time
          : "";
      return {
        type: type, // "call_scheduled" or "scheduled_call_canceled"
        time: timeValue,
      };
    }

    default:
      // For unknown types, return the payload as-is
      return payload as CustomExts;
  }
}
