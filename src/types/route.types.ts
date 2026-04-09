import type { Tables } from './database.types';

export type Route = Tables<'routes'>;
export type RouteRating = Tables<'route_ratings'>;

export interface RouteFilter {
  difficulty?: number;
  surface?: string;
  minDistance?: number;
  maxDistance?: number;
  search?: string;
  status?: string;
}
