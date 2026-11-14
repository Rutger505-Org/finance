import { ItemsPage } from "@/app/_components/items/items-page";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Inkomsten" };

export default function IncomesPage() {
  return <ItemsPage kind="income" title="Inkomsten" />;
}
