"use client";

/**
 * PageHeader
 *
 * Displays a page-level header with an avatar/logo, title, and optional link.
 *
 * If no image is provided, a theme-aware fallback F3 logo is generated and
 * automatically updated when the theme changes (light/dark).
 */

import { Avatar } from "@heroui/avatar";
import { Card, CardHeader } from "@heroui/card";
import { Link } from "@heroui/link";
import { fallbackF3Logo } from "@/lib/utils";
import { useEffect, useState } from "react";

type PageHeaderProps = {
  image?: string;
  name?: string;
  link?: string;
  linkName?: string;
};

export function PageHeader({ image, name, link, linkName }: PageHeaderProps) {
  const [avatarSrc, setAvatarSrc] = useState<string>(image ?? "");

  useEffect(() => {
    if (name) document.title = name + " | PAX Vault";
  }, [name]);

  // Generate and keep a fallback logo in sync with the active color theme.
  useEffect(() => {
    if (!image) {
      // Only generate a fallback when no explicit image is provided.
      const updateFallbackLogo = () => {
        const isDark = document.documentElement.classList.contains("dark");
        const color = isDark ? "#fff" : "#000"; // white in dark mode, black in light
        setAvatarSrc(fallbackF3Logo(color));
      };

      updateFallbackLogo(); // initial check

      // Observe changes to the class attribute on <html>
      const observer = new MutationObserver(() => updateFallbackLogo());
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      return () => observer.disconnect();
    }
  }, [image]);

  return (
    <Card className="bg-background/60 dark:bg-default-100/50 w-full">
      <CardHeader className="flex justify-between items-center">
        <Avatar
          src={avatarSrc}
          alt={name || "Page header avatar"}
          radius="md"
          className="w-16 h-16 bg-transparent"
        />
        {/* Title and optional navigation link */}
        <div className="text-right">
          <div className="text-right text-xl font-bold">{name}</div>
          {link && linkName ? (
            <Link className="text-lg" href={link} color="primary">
              {linkName}
            </Link>
          ) : (
            <span className="text-lg">{linkName}</span>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
