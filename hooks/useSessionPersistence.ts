"use client";

import { useEffect } from "react";
import { sessionStore } from "@/stores/sessionStore";

export function useSessionPersistence() {
  useEffect(() => {
    sessionStore.hydrate();
  }, []);
}
