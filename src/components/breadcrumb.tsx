"use client";

import {
  BreadcrumbItem,
  Breadcrumbs as HeroBreadcrumbs,
} from "@heroui/breadcrumbs";
import { useRouter } from "next/navigation";

export type BreadcrumbEntry = {
  label: string;
  href?: string;
};

type Props = {
  items: BreadcrumbEntry[];
};

/**
 * Navigation bar with a back button on the left and a breadcrumb trail on
 * the right. Intended for PWA use where the browser back button is hidden.
 */
export function Breadcrumb({ items }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between w-full">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground transition-colors"
      >
        ← Back
      </button>

      <HeroBreadcrumbs className="text-sm">
        {items.map((item, i) => (
          <BreadcrumbItem
            key={i}
            href={item.href}
            isCurrent={i === items.length - 1}
          >
            {item.label}
          </BreadcrumbItem>
        ))}
      </HeroBreadcrumbs>
    </div>
  );
}
