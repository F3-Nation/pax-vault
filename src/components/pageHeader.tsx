"use client";

import { Avatar } from "@heroui/avatar";
import { Card, CardHeader } from "@heroui/card";
import { Link } from "@heroui/link";
import { fallbackF3Logo } from "@/lib/utils";
import { useEffect, useState } from "react";

export function PageHeader({
  image,
  name,
  link,
  linkName,
}: {
  image?: string;
  name?: string;
  link?: string;
  linkName?: string;
}) {
  const [logo, setLogo] = useState<string>(image ?? "");

  useEffect(() => {
    if (!image) {
      const updateLogo = () => {
        const isDark = document.documentElement.classList.contains("dark");
        const color = isDark ? "#fff" : "#000"; // white in dark mode, black in light
        setLogo(fallbackF3Logo(color));
      };

      updateLogo(); // initial check

      // Observe changes to the class attribute on <html>
      const observer = new MutationObserver(() => updateLogo());
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
          src={logo}
          alt={name}
          radius="md"
          className="w-16 h-16 bg-transparent"
        />
        <div className="text-right">
          <div className="text-right text-xl font-bold">{name}</div>
          <Link href={link ?? "#"} color="primary">
            {linkName}
          </Link>
        </div>
      </CardHeader>
    </Card>
  );
}
