"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import { Button } from "@heroui/button";

export function ThemeSwitcher({ size = "sm" }: { size?: "sm" | "md" | "lg" }, { type = "lg" }: { type?: "sm" | "md" | "lg" }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  const iconSize = type === "sm" ? 5 : type === "md" ? 7 : 10;

  return (
    <Button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle Theme"
      size={size}
      variant="light"
      isIconOnly
      radius="full"
    >
      {isDark ? <SunIcon className={`h-${iconSize} w-${iconSize}`} /> : <MoonIcon className={`h-${iconSize} w-${iconSize}`} />}
    </Button>
  );
}