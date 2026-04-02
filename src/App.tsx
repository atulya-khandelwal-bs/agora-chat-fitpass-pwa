import React from "react";
import FPChatApp from "./fp/fp-chat/FPChatApp.tsx";

// Sample patient id
const userId = 220044;

function App(): React.JSX.Element {
  // Use URL params or defaults
  const finalUserId = String(userId);
  const finalConversationId = "333"; // Default conversation ID

  // Only pass required props - dietitian details (name, photo, profile) are fetched automatically
  return (
    <FPChatApp
      userId={finalUserId}
      conversationId={finalConversationId}
      onLogout={() => {
        console.log("User logged out from chat");
      }}
    />
  );
}

export default App;