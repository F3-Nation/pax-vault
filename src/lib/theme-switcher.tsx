"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { Button } from "@heroui/button";

export function ThemeSwitcher({
  size = "sm",
  type = "lg",
}: {
  size?: "sm" | "md" | "lg";
  type?: "sm" | "md" | "lg";
}) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const iconSize = type === "sm" ? 5 : type === "md" ? 7 : 10;

  // Return a placeholder with the same structure to prevent hydration mismatch
  // Use MoonIcon as default placeholder to match structure
  if (!mounted) {
    return (
      <Button
        aria-label="Toggle Theme"
        size={size}
        variant="light"
        isIconOnly
        radius="full"
        disabled
      >
        <MoonIcon className={`h-${iconSize} w-${iconSize}`} />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle Theme"
      size={size}
      variant="light"
      isIconOnly
      radius="full"
    >
      {isDark ? (
        <SunIcon className={`h-${iconSize} w-${iconSize}`} />
      ) : (
        <MoonIcon className={`h-${iconSize} w-${iconSize}`} />
      )}
    </Button>
  );
}
