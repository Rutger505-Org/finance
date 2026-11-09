"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Link that is highlighted on its own page; with `prefix` also on its subpages. */
export function NavLink({
  href,
  prefix = false,
  className,
  activeClassName,
  children,
}: {
  href: string;
  prefix?: boolean;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (prefix && pathname.startsWith(`${href}/`));
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(className, active && activeClassName)}>
      {children}
    </Link>
  );
}
