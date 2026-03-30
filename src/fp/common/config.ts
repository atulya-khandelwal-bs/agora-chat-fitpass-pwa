/**
 * Application Configuration
 *
 * For production, use environment variables to override these values.
 * Create a .env file in the root directory with:
 *
 * Required:
 * - VITE_AGORA_APP_KEY=your_chat_app_key (for Agora Chat SDK)
 * - VITE_RTC_APP_ID=your_rtc_app_id (for Agora RTC SDK - separate from Chat App Key)
 * - VITE_BACKEND_API_URL=your_backend_api_url (base URL only, no routes)
 */

interface Config {
  agora: {
    appKey: string;
    rtcAppId: string;
  };
  api: {
    backend: string;
    generateToken: string;
    generatePresignUrl: string;
    registerUserEndpoint: string;
    fetchCoaches: string;
    fetchConversations: string;
    fetchMessages: string;
    summary: string;
    latestSummary: string;
    customMessage: string;
  };
  defaults: {
    avatar: string;
    userAvatar: string;
  };
  token: {
    expireInSecs: number;
  };
  upload: {
    expiresInMinutes: number;
  };
  chat: {
    pageSize: number;
  };
  rtcToken: {
    apiUrl: string;
  };
}

const config: Config = {
  // Agora Chat Configuration
  agora: {
    // Chat App Key (for Agora Chat SDK)
    appKey: import.meta.env.VITE_AGORA_APP_KEY as string,

    // RTC App ID (for Agora RTC SDK - separate from Chat App Key)
    rtcAppId: import.meta.env.VITE_RTC_APP_ID as string,
  },

  // API Endpoints
  api: {
    // Backend API base URL
    backend: import.meta.env.VITE_BACKEND_API_URL as string,

    // Specific API endpoints (constructed from base URL)
    get generateToken(): string {
      return `${this.backend}/api/chat/generate-token`;
    },

    get generatePresignUrl(): string {
      return `${this.backend}/api/s3/generate-presign-url`;
    },

    get registerUserEndpoint(): string {
      return `${this.backend}/api/chat/register-user`;
    },

    get fetchCoaches(): string {
      // return `${this.backend}/api/fetch-coaches;
      return `${this.backend}/api/demo/fetch-coaches`;
    },

    get fetchConversations(): string {
      return `${this.backend}/api/chat/fetch-conversations`;
      // return `${this.backend}/api/fetch-conversations`;
    },

    get fetchMessages(): string {
      return `${this.backend}/api/chat/fetch-messages`;
    },

    get summary(): string {
      return `${this.backend}/api/v1/summary`;
    },
    get latestSummary(): string {
      return `${this.backend}/api/v1/summaries/latest`;
    },

    get customMessage(): string {
      return `${this.backend}/api/chat/send-custom-message`;
    },
  },

  // Default Images/Avatars
  defaults: {
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
    userAvatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face",
  },

  // Token Configuration
  token: {
    expireInSecs: 3600, // 1 hour
  },

  // S3 Upload Configuration
  upload: {
    expiresInMinutes: 15,
  },

  // Chat Configuration
  chat: {
    pageSize: 20, // Number of messages to fetch per page
  },

  // RTC Token API (constructed from backend base URL)
  rtcToken: {
    get apiUrl(): string {
      return `${config.api.backend}/api/rtc/generate-token`;
    },
  },
};

export default config;
