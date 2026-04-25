export type ToolCallStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "aborted";

export type ToolCallEvent = {
  id: string;
  timestamp: string;
  type: "tool_call";
  payload: {
    toolName: string;
    input: unknown;
    output?: unknown;
  };
  status: ToolCallStatus;
  duration?: number;
};

export type AgentMessageEvent = {
  id: string;
  timestamp: string;
  type: "agent_message";
  payload: {
    content: string;
    role: "assistant" | "user";
  };
};

export type AgentThinkingEvent = {
  id: string;
  timestamp: string;
  type: "agent_thinking";
  payload: {
    content: string;
  };
};

export type SystemEvent = {
  id: string;
  timestamp: string;
  type: "system";
  payload: {
    message: string;
    level: "info" | "warn" | "error";
  };
};

export type DashboardEvent =
  | ToolCallEvent
  | AgentMessageEvent
  | AgentThinkingEvent
  | SystemEvent;

export type EventCounts = Record<DashboardEvent["type"], number>;
