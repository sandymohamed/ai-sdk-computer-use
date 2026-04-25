"use client";

import { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { eventStore } from "@/stores/eventStore";
import { DashboardEvent } from "@/types/events";

const now = () => new Date().toISOString();

export function useEventCapture(messages: UIMessage[]) {
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newEvents: DashboardEvent[] = [];

    for (const message of messages) {
      if (
        (message.role === "user" || message.role === "assistant") &&
        !seenIdsRef.current.has(message.id)
      ) {
        newEvents.push({
          id: `msg-${message.id}`,
          timestamp: now(),
          type: "agent_message",
          payload: {
            content:
              typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content),
            role: message.role,
          },
        });
        seenIdsRef.current.add(message.id);
      }

      for (const part of message.parts ?? []) {
        if (part.type !== "tool-invocation") continue;
        const inv = part.toolInvocation;
        const callId = inv.toolCallId;
        const status =
          inv.state === "call"
            ? "running"
            : inv.state === "result"
              ? "success"
              : "pending";
        const eventId = `tool-${callId}-${status}`;
        if (seenIdsRef.current.has(eventId)) continue;

        const output =
          inv.state === "result" && "result" in inv
            ? (inv as { result?: unknown }).result
            : undefined;

        newEvents.push({
          id: eventId,
          timestamp: now(),
          type: "tool_call",
          payload: {
            toolName: inv.toolName,
            input: inv.args,
            output,
          },
          status,
        });
        seenIdsRef.current.add(eventId);
      }
    }

    if (newEvents.length) {
      const { events } = eventStore.getState();
      eventStore.replaceEvents([...events, ...newEvents]);
    }
  }, [messages]);
}
