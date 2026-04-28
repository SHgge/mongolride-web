import { createContext, useContext, useState, type ReactNode } from 'react';

interface RouteHoverState {
  hoveredKm: number | null;
  setHoveredKm: (km: number | null) => void;
}

const RouteHoverContext = createContext<RouteHoverState | null>(null);

export function RouteHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredKm, setHoveredKm] = useState<number | null>(null);
  return (
    <RouteHoverContext.Provider value={{ hoveredKm, setHoveredKm }}>
      {children}
    </RouteHoverContext.Provider>
  );
}

export function useRouteHover(): RouteHoverState {
  const ctx = useContext(RouteHoverContext);
  // Allow components to be used standalone — hover sync becomes a no-op.
  if (!ctx) return { hoveredKm: null, setHoveredKm: () => {} };
  return ctx;
}
