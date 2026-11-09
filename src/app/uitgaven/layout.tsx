import { NavLink } from "@/app/_components/nav-link";
import type { ReactNode } from "react";

const tabs = [
  { href: "/uitgaven", label: "Per maand" },
  { href: "/uitgaven/uitjes", label: "Uitjes" },
  { href: "/uitgaven/tegenrekeningen", label: "Tegenrekeningen" },
  { href: "/uitgaven/categorieen", label: "Categorieën" },
];

export default function SpendingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Uitgaven</h1>
        <nav className="flex flex-wrap gap-1 border-b text-sm">
          {tabs.map((tab) => (
            <NavLink
              key={tab.href}
              href={tab.href}
              className="text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-3 py-2"
              activeClassName="text-foreground border-foreground font-medium"
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {children}
    </>
  );
}
