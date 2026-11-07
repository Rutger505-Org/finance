"use client";

import { importStatement, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Account } from "@/lib/finance/schemas";
import { useId, useState, useTransition } from "react";

export function ImportForm() {
  const id = useId();
  const [account, setAccount] = useState<Account>("current");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function readFile(file: File | undefined) {
    if (file) setText(await file.text());
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const response = await importStatement({ account, text });
      setResult(response);
      if (response.ok) setText("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-account`}>Rekening</Label>
          <Select id={`${id}-account`} value={account} onChange={(event) => setAccount(event.target.value as Account)}>
            <option value="current">Lopende rekening</option>
            <option value="fixed">Vaste lasten</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-file`}>Bestand (TXT/TAB)</Label>
          <Input id={`${id}-file`} type="file" accept=".tab,.txt,text/plain" onChange={(event) => readFile(event.target.files?.[0])} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-text`}>Of plak de regels</Label>
        <Textarea
          id={`${id}-text`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="font-mono text-xs"
          rows={6}
        />
      </div>
      <ResultMessage result={result} />
      <Button type="submit" disabled={pending || text.trim() === ""}>
        Importeren
      </Button>
    </form>
  );
}
