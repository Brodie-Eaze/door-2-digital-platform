/**
 * Per-account route-transition indicator. In Next 14, `loading.tsx`
 * is NOT passed route params reliably — it shares a layout boundary with
 * the deepest segment that's loading, but params are only passed to
 * page.tsx + layout.tsx, not loading.tsx. So we fall back to the default
 * accent colour (the .d2d-route-loader class already does this via
 * `var(--d2d-loader-color, theme('colors.accent'))`) and rely on the
 * AccountShell's per-account 2px accent stripe + sidebar slide-in to
 * carry the brand cue once the page lands.
 */
export default function AccountLoading(): JSX.Element {
  return <div className="d2d-route-loader" aria-label="Loading account workspace" role="status" />;
}
