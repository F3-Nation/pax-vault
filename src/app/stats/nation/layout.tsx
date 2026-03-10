import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Nation Stats",
};

export default function NationLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
