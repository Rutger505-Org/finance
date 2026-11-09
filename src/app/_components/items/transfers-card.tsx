import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/format";
import { repository } from "@/server/finance";
import { SettingsForm } from "./settings-form";

/** Transfers to the fixed-costs account; shown on both Inkomsten and Vaste lasten. */
export function TransfersCard({ today }: { today: number }) {
  const amounts = repository.transfers(today).map((t) => money(t.amount));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overboekingen naar vaste lasten</CardTitle>
        <CardDescription>
          Wanneer en hoeveel je automatisch van je lopende naar je vaste lastenrekening overboekt. Vaste bedragen en
          hele inkomens tellen eerst; automatische overboekingen dekken de rest van wat er gemiddeld nodig is, op de
          cent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingsForm settings={repository.getSettings()} incomes={repository.listIncomes()} amounts={amounts} />
      </CardContent>
    </Card>
  );
}
