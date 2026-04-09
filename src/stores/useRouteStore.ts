import { create } from 'zustand';
import type { Route, RouteFilter } from '../types/route.types';

interface RouteState {
  routes: Route[];
  filter: RouteFilter;
  setRoutes: (routes: Route[]) => void;
  setFilter: (filter: RouteFilter) => void;
}

export const useRouteStore = create<RouteState>((set) => ({
  routes: [],
  filter: {},
  setRoutes: (routes) => set({ routes }),
  setFilter: (filter) => set({ filter }),
}));
