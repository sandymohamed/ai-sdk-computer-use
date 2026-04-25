import { UIMessage } from "ai";
import { DashboardEvent } from "@/types/events";
import { createStore } from "./store-utils";

const STORAGE_KEY = "ai-agent-dashboard-sessions-v1";

export type ChatSession = {
  id: string;
  name: string;
  createdAt: string;
  messages: UIMessage[];
  events: DashboardEvent[];
};

type SessionState = {
  sessions: ChatSession[];
  activeSessionId: string | null;
};

const store = createStore<SessionState>({
  sessions: [],
  activeSessionId: null,
});

const persist = (state: SessionState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const createNewSession = (name?: string): ChatSession => ({
  id: crypto.randomUUID(),
  name: name ?? `Session ${new Date().toLocaleTimeString()}`,
  createdAt: new Date().toISOString(),
  messages: [],
  events: [],
});

export const sessionStore = {
  subscribe: store.subscribe,
  getState: store.getState,
  useStore: store.useStore,
  hydrate() {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const first = createNewSession("Default Session");
      const state = { sessions: [first], activeSessionId: first.id };
      store.setState(state);
      persist(state);
      return;
    }
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed.sessions.length) {
      const first = createNewSession("Default Session");
      const state = { sessions: [first], activeSessionId: first.id };
      store.setState(state);
      persist(state);
      return;
    }
    store.setState(parsed);
  },
  createSession(name?: string) {
    const session = createNewSession(name);
    store.setState((prev) => {
      const next = {
        sessions: [session, ...prev.sessions],
        activeSessionId: session.id,
      };
      persist(next);
      return next;
    });
  },
  setActiveSession(sessionId: string) {
    store.setState((prev) => {
      const next = { ...prev, activeSessionId: sessionId };
      persist(next);
      return next;
    });
  },
  deleteSession(sessionId: string) {
    store.setState((prev) => {
      const sessions = prev.sessions.filter((session) => session.id !== sessionId);
      const fallback = sessions[0] ?? createNewSession("Default Session");
      const next = {
        sessions: sessions.length ? sessions : [fallback],
        activeSessionId:
          prev.activeSessionId === sessionId ? fallback.id : prev.activeSessionId,
      };
      persist(next);
      return next;
    });
  },
  patchActiveSession(patch: Partial<Pick<ChatSession, "messages" | "events" | "name">>) {
    store.setState((prev) => {
      if (!prev.activeSessionId) return prev;
      const sessions = prev.sessions.map((session) =>
        session.id === prev.activeSessionId ? { ...session, ...patch } : session,
      );
      const next = { ...prev, sessions };
      persist(next);
      return next;
    });
  },
};
