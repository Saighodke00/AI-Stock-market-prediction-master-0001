import { create } from 'zustand';

interface TickerState {
  ticker: string;
  setTicker: (ticker: string) => void;
  // Metadata or additional platform-wide state can go here
  lastRefresh: number;
  triggerRefresh: () => void;
}

export const useTickerStore = create<TickerState>((set) => ({
  ticker: 'RELIANCE.NS',
  lastRefresh: Date.now(),
  setTicker: (ticker) => set({ ticker: ticker.toUpperCase() }),
  triggerRefresh: () => set({ lastRefresh: Date.now() }),
}));
