import { createStore } from "./store-utils";

type UIState = {
  isDebugPanelOpen: boolean;
  isSessionSidebarOpen: boolean;
};

const store = createStore<UIState>({
  isDebugPanelOpen: true,
  isSessionSidebarOpen: true,
});

export const uiStore = {
  subscribe: store.subscribe,
  getState: store.getState,
  useStore: store.useStore,
  toggleDebugPanel() {
    store.setState((prev) => ({ ...prev, isDebugPanelOpen: !prev.isDebugPanelOpen }));
  },
  toggleSessionSidebar() {
    store.setState((prev) => ({
      ...prev,
      isSessionSidebarOpen: !prev.isSessionSidebarOpen,
    }));
  },
};
