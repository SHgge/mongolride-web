import { create } from 'zustand';
import type { Event } from '../types/event.types';

interface EventState {
  events: Event[];
  setEvents: (events: Event[]) => void;
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  setEvents: (events) => set({ events }),
}));
