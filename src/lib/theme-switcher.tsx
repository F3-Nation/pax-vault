"use client";

/**
 * ThemeSwitcher
 *
 * Client-side toggle for switching between light and dark themes.
 *
 * Uses `next-themes` and waits until the component is mounted to avoid
 * hydration mismatches between server and client.
 */

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { Button } from "@heroui/button";

type ThemeSwitcherProps = {
  size?: "sm" | "md" | "lg";
  iconSize?: "sm" | "md" | "lg";
};

export function ThemeSwitcher({
  size = "sm",
  iconSize = "lg",
}: ThemeSwitcherProps) {
  // Prevent hydration mismatch by rendering only after client mount.
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  // Mark component as mounted on the client.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  const iconPx = iconSize === "sm" ? 5 : iconSize === "md" ? 7 : 10;

  return (
    // Toggle between light and dark themes
    <Button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle Theme"
      size={size}
      variant="light"
      isIconOnly
      radius="full"
    >
      {isDark ? (
        <SunIcon className={`h-${iconPx} w-${iconPx}`} />
      ) : (
        <MoonIcon className={`h-${iconPx} w-${iconPx}`} />
      )}
    </Button>
  );
}
