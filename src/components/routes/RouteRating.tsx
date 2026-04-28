// Placeholder during EP-04 P1-2 rebuild.
// The old route_ratings table was dropped; ratings will live on route_completions
// (each completion can include a 1-5 rating). The new component will surface
// an aggregated rating + completion notes on the route detail page.
export default function RouteRating(_props: { routeId: string }) {
  return null;
}
