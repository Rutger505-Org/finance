import { ItemsPage } from "@/app/_components/items/items-page";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vaste lasten" };

export default function ExpensesPage() {
  return <ItemsPage kind="expense" title="Vaste lasten" />;
}
