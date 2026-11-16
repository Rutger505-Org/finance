import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** A few fun facts, computed from the data; nothing when there are none. */
export function FactsCard({ facts }: { facts: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weetjes</CardTitle>
      </CardHeader>
      <CardContent>
        {facts.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nog te weinig uitgaven voor weetjes.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
