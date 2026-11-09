"use client";

import { deleteCategory, saveCategory, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryDto } from "@/lib/finance/schemas";
import { useState, useTransition } from "react";

function CategoryRow({ category, onResult }: { category: CategoryDto; onResult: (r: ActionResult) => void }) {
  const [name, setName] = useState(category.name);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`"${category.name}" verwijderen? Uitgaven en tegenrekeningen houden geen categorie over.`)) return;
    startTransition(async () => onResult(await deleteCategory(category.id)));
  }

  return (
    <li className="flex gap-2 py-2">
      <form
        className="flex flex-1 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => onResult(await saveCategory(category.id, { name })));
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} aria-label="Naam" required />
        <Button size="sm" variant="outline" type="submit" disabled={pending || name.trim() === category.name}>
          Hernoemen
        </Button>
      </form>
      <Button size="sm" variant="ghost" onClick={remove} disabled={pending}>
        Verwijderen
      </Button>
    </li>
  );
}

export function Categories({ categories }: { categories: CategoryDto[] }) {
  const [name, setName] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const response = await saveCategory(null, { name });
            setResult(response);
            if (response.ok) setName("");
          });
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nieuwe categorie" required />
        <Button type="submit" disabled={pending}>
          Toevoegen
        </Button>
      </form>
      <ResultMessage result={result} />
      <ul className="divide-y">
        {categories.map((category) => (
          <CategoryRow key={`${category.id}-${category.name}`} category={category} onResult={setResult} />
        ))}
      </ul>
    </div>
  );
}
