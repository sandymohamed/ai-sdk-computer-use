"use client";

import { DashboardEvent } from "@/types/events";
import { EventTimeline } from "./EventTimeline";

type DebugPanelProps = {
  events: DashboardEvent[];
  isOpen: boolean;
};

export function DebugPanel({ events, isOpen }: DebugPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="border-t border-zinc-200 p-3 bg-zinc-50">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 mb-2">
        Debug Events
      </h3>
      <div className="max-h-64 overflow-y-auto">
        <EventTimeline events={events} />
      </div>
    </div>
  );
}
