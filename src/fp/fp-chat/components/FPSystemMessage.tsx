import type { Message } from "../../common/types/chat";
import React from "react";
import FPCoachAssignedView from "./messages/FPCoachAssignedView";
import FPCoachDetailsView from "./messages/FPCoachDetailsView";
import FPMealPlanUpdatedView from "./messages/FPMealPlanUpdatedView";
import FPDefaultSystemMessageView from "./messages/FPDefaultSystemMessageView";

interface FPSystemMessageProps {
  msg: Message;
}

export default function FPSystemMessage({
  msg,
}: FPSystemMessageProps): React.JSX.Element {
  // Special handling for new_nutritionist messages
  // Route based on action_type: coach_assigned or coach_details
  if (msg.system?.kind === "new_nutritionist") {
    const actionType = msg.system?.payload?.action_type as string | undefined;

    if (actionType === "coach_assigned") {
      return <FPCoachAssignedView msg={msg} />;
    }

    if (actionType === "coach_details") {
      return <FPCoachDetailsView msg={msg} />;
    }

    // Fallback to coach_details if action_type is not specified
    return <FPCoachDetailsView msg={msg} />;
  }

  // Special handling for meal_plan_updated with icons
  if (msg.system?.kind === "meal_plan_updated") {
    return <FPMealPlanUpdatedView msg={msg} />;
  }

  // Other system messages
  return <FPDefaultSystemMessageView msg={msg} />;
}
