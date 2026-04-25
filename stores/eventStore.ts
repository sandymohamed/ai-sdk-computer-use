import { DashboardEvent, EventCounts } from "@/types/events";
import { createStore } from "./store-utils";

type EventState = {
  events: DashboardEvent[];
};

const initialState: EventState = {
  events: [],
};

const store = createStore(initialState);

export const eventStore = {
  subscribe: store.subscribe,
  getState: store.getState,
  useStore: store.useStore,
  addEvent(event: DashboardEvent) {
    store.setState((prev) => ({ ...prev, events: [...prev.events, event] }));
  },
  clearEvents() {
    store.setState((prev) => ({ ...prev, events: [] }));
  },
  replaceEvents(events: DashboardEvent[]) {
    store.setState((prev) => ({ ...prev, events }));
  },
};

export const getEventCounts = (events: DashboardEvent[]): EventCounts => {
  return events.reduce<EventCounts>(
    (acc, event) => {
      acc[event.type] += 1;
      return acc;
    },
    {
      tool_call: 0,
      agent_message: 0,
      agent_thinking: 0,
      system: 0,
    },
  );
};

export const getAgentStatus = (events: DashboardEvent[]) => {
  const lastToolCall = [...events].reverse().find((event) => event.type === "tool_call");
  if (!lastToolCall) return "idle";
  if (lastToolCall.status === "running" || lastToolCall.status === "pending") {
    return "running";
  }
  if (lastToolCall.status === "error") return "error";
  return "ready";
};
