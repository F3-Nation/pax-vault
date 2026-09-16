/**
 * EightBoxButton
 *
 * Link from a PAX page to that PAX's 8 Box. Rendered only when the server has
 * confirmed the viewer IS this PAX, so its presence is itself the signal.
 *
 * Plain `next/link`, server-rendered, styled like `region/PreferencesButton`
 * so it sits naturally in `PageHeader`'s action slot.
 */

import Link from "next/link";

type Props = {
  paxId: number;
  /** Label override, e.g. "Continue draft". */
  label?: string;
  /** Link straight to the editor instead of the overview. */
  toEditor?: boolean;
};

export function EightBoxIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 12h18M8 3v18M13 3v18M18 3v18" />
    </svg>
  );
}

export function EightBoxButton({ paxId, label = "8 Box", toEditor }: Props) {
  const href = `/stats/pax/${paxId}/8box${toEditor ? "/edit" : ""}`;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      <EightBoxIcon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
