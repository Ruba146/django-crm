"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

const FULL_HEIGHT_ROUTES = ["/graph"];
const NO_PADDING_ROUTES = ["/graph"];

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const fullHeight = FULL_HEIGHT_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const noPadding = NO_PADDING_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return <AppShell fullHeight={fullHeight} noPadding={noPadding}>{children}</AppShell>;
}
