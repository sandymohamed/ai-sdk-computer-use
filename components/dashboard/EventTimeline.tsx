"use client";

import { DashboardEvent } from "@/types/events";

type EventTimelineProps = {
  events: DashboardEvent[];
};

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <p className="text-xs text-zinc-500">No events yet.</p>
      ) : null}
      {events.map((event) => (
        <div key={event.id} className="rounded-md border border-zinc-200 p-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{event.type}</span>
            <span className="text-zinc-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
          </div>
          {"status" in event ? (
            <p className="mt-1">status: {event.status}</p>
          ) : null}
          <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}
