import AgoraChat from "agora-chat";
import type { Connection } from "agora-chat";

export function createChatClient(appKey: string): Connection {
  return new AgoraChat.connection({ appKey }) as unknown as Connection;
}
