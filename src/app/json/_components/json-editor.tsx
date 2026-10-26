"use client";

import { saveConfig, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useTransition } from "react";

export function JsonEditor({ initial }: { initial: string }) {
  const [saved, setSaved] = useState(initial);
  const [text, setText] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function format() {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setResult(null);
    } catch (error) {
      setResult({ ok: false, error: `Geen geldige JSON: ${(error as Error).message}` });
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setResult({ ok: true, message: "Gekopieerd" });
  }

  function save() {
    startTransition(async () => {
      const response = await saveConfig(text);
      setResult(response);
      if (response.ok && response.config) {
        setSaved(response.config);
        setText(response.config);
      }
    });
  }

  const changed = text !== saved;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={pending || !changed}>
          Opslaan
        </Button>
        <Button variant="outline" onClick={format}>
          Formatteren
        </Button>
        <Button variant="outline" onClick={() => void copy()}>
          Kopiëren
        </Button>
        <Button variant="ghost" onClick={() => setText(saved)} disabled={!changed}>
          Wijzigingen weggooien
        </Button>
      </div>
      <ResultMessage result={result} />
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        className="min-h-[60vh] bg-background font-mono text-xs leading-relaxed"
        aria-label="Config als JSON"
      />
    </div>
  );
}
