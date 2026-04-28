import type { Tables } from './database.types';
import type { RouteDifficultyLabel, RouteDiscipline } from './database.types';

export type Route = Tables<'routes'>;
export type RouteCompletion = Tables<'route_completions'>;
export type RoutePhoto = Tables<'route_photos'>;

export interface RouteFilter {
  difficulty?: RouteDifficultyLabel;
  discipline?: RouteDiscipline;
  minDistance?: number;
  maxDistance?: number;
  search?: string;
  status?: string;
  region?: string;
}
