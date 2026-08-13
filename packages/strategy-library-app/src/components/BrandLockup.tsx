/**
 * Chevron/"F" mark + wordmark, per fracta_flow_brand_kit.pdf §2 and the
 * reference fracta-flow-landing repo's Logo.jsx (which uses the same
 * placeholder chevron geometry, explicitly marked there as a stand-in
 * for the real fracta-flow-icon-purple.svg path data — "Do not redraw
 * the chevron by hand in production"). Kept in sync with that repo's
 * shape here; swap for the real file's path data in both places when it
 * arrives — nothing else about how it's used should need to change.
 *
 * Wordmark rule from the brand kit, followed exactly: "FRACTA" in
 * Montserrat 700 + "FLOW" in Nunito 400, both uppercase, ~1px tracking —
 * never make FLOW bold or FRACTA regular. Icon stays brand purple,
 * wordmark stays ink (#111111) — per the kit's own color table, not a
 * "one purple element per screen" workaround.
 */
export function BrandIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Fracta Flow">
      <rect x="2" y="2" width="20" height="5" rx="1.5" fill="#7B2FF7" />
      <rect x="2" y="9.5" width="14" height="5" rx="1.5" fill="#7B2FF7" />
      <rect x="2" y="17" width="8" height="5" rx="1.5" fill="#7B2FF7" />
    </svg>
  );
}

/**
 * Icon tight against the wordmark, per the brief ("not spaced apart").
 * Use this in the app header/nav. Below ~120px width, use BrandIcon
 * alone (mobile header, favicon) — see index.html for the favicon case.
 */
export function BrandLockup({ iconSize = 20 }: { iconSize?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <BrandIcon size={iconSize} />
      <span className="font-display text-[15px] font-bold leading-none tracking-[1px] text-brand-ink">
        FRACTA<span className="font-body font-normal">FLOW</span>
      </span>
    </span>
  );
}
