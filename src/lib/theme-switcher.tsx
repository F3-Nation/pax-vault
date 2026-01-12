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

  // Use fixed Tailwind classes instead of dynamic ones to avoid hydration issues
  const iconClass =
    type === "sm" ? "h-5 w-5" : type === "md" ? "h-7 w-7" : "h-10 w-10";

  // Always render the same structure during SSR to prevent hydration mismatch
  // After mount, we'll update to show the correct icon based on theme
  const isDark = mounted && resolvedTheme === "dark";
  const Icon = isDark ? SunIcon : MoonIcon;

  // Handler that works both during SSR and after mount
  const handleClick = () => {
    if (mounted) {
      setTheme(isDark ? "light" : "dark");
    }
  };

  return (
    <Button
      onClick={handleClick}
      aria-label="Toggle Theme"
      size={size}
      variant="light"
      isIconOnly
      radius="full"
    >
      <Icon className={iconClass} />
    </Button>
  );
}
