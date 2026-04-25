import { useSyncExternalStore } from "react";

type Listener = () => void;

export function createStore<TState>(initialState: TState) {
  let state = initialState;
  const listeners = new Set<Listener>();

  const getState = () => state;

  const setState = (updater: TState | ((prev: TState) => TState)) => {
    state = updater instanceof Function ? updater(state) : updater;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const useStore = <TSelected,>(selector: (state: TState) => TSelected) =>
    useSyncExternalStore(subscribe, () => selector(state), () => selector(state));

  return { getState, setState, subscribe, useStore };
}
