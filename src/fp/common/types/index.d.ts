// Global type definitions

// Agora Chat SDK type declarations
declare module "agora-chat" {
  export interface Connection {
    addEventHandler(event: string, handlers: unknown): void;
    removeEventHandler(event: string): void;
    close(): void;
    open?: (options: { user: string; accessToken: string }) => void;
    isOpened?: () => boolean;
    send?: (msg: unknown) => Promise<void>;
    [key: string]: unknown;
  }

  export interface MessageBody {
    from?: string;
    to?: string;
    type?: string;
    msg?: string;
    body?: string | object;
    ext?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface Message {
    create(options: unknown): unknown;
  }

  export class connection {
    constructor(options: { appKey: string });
  }

  export const message: Message;

  interface AgoraChatNamespace {
    Connection: Connection;
    MessageBody: MessageBody;
    connection: typeof connection;
    message: Message;
  }

  const AgoraChat: AgoraChatNamespace;
  export default AgoraChat;
}

// Declare global namespace for AgoraChat types
declare namespace AgoraChat {
  interface Connection {
    addEventHandler(event: string, handlers: unknown): void;
    removeEventHandler(event: string): void;
    close(): void;
    open?: (options: { user: string; accessToken: string }) => void;
    isOpened?: () => boolean;
    send?: (msg: unknown) => Promise<void>;
    [key: string]: unknown;
  }

  interface MessageBody {
    from?: string;
    to?: string;
    type?: string;
    msg?: string;
    body?: string | object;
    ext?: Record<string, unknown>;
    [key: string]: unknown;
  }
}

// Extend Window interface if needed
declare global {
  interface Window {
    // Add any global window properties here if needed
  }
}

// Export empty object to make this a module
export {};
