/**
 * Breadcrumb data + builder, kept server-safe (no "use client") so stats pages
 * can construct trails without pulling in the client Breadcrumb component.
 */

export type BreadcrumbEntry = {
  label: string;
  href?: string;
};

/**
 * Build a stats-page breadcrumb trail with the shared scaffold:
 * Home -> Nation (unless `includeNation` is false) -> optional parent -> current.
 * The current entry has no href (it's the active page).
 */
export function buildBreadcrumb(args: {
  current: string;
  parent?: BreadcrumbEntry | null;
  includeNation?: boolean;
}): BreadcrumbEntry[] {
  const items: BreadcrumbEntry[] = [{ label: "Home", href: "/" }];
  if (args.includeNation !== false) {
    items.push({ label: "Nation", href: "/stats/nation" });
  }
  if (args.parent) items.push(args.parent);
  items.push({ label: args.current });
  return items;
}
