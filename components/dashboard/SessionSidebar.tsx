"use client";

import { ChatSession } from "@/stores/sessionStore";
import { Button } from "@/components/ui/button";

type SessionSidebarProps = {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export function SessionSidebar({
  sessions,
  activeSessionId,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
}: SessionSidebarProps) {
  return (
    <aside className="w-72 border-r border-zinc-200 bg-white p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Sessions</h2>
        <Button onClick={onCreateSession} className="h-8 px-2 text-xs">
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`rounded-md border p-2 ${activeSessionId === session.id ? "border-zinc-900 bg-zinc-100" : "border-zinc-200 bg-white"}`}
          >
            <button
              className="w-full text-left"
              onClick={() => onSelectSession(session.id)}
              type="button"
            >
              <p className="text-sm font-medium truncate">{session.name}</p>
              <p className="text-xs text-zinc-500">
                {new Date(session.createdAt).toLocaleString()}
              </p>
            </button>
            <Button
              type="button"
              className="mt-2 h-7 px-2 text-xs bg-red-600 hover:bg-red-700"
              onClick={() => onDeleteSession(session.id)}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </aside>
  );
}
