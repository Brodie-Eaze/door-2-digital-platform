/**
 * Root-level route-transition indicator. Next renders this while a route
 * boundary's server component is suspended (typically > 200ms). The bar is
 * a 2px-tall sweep across the very top of the viewport — under the topbar
 * visually but above all chrome via z-index. Disappears immediately when
 * the destination route's first paint lands.
 *
 * Uses the .d2d-route-loader class from globals.css — pure CSS, no JS.
 * Respects prefers-reduced-motion (becomes a static 50%-opacity bar).
 */
export default function Loading(): JSX.Element {
  return <div className="d2d-route-loader" aria-label="Loading next route" role="status" />;
}
