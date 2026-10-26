"use client";

import { deleteBalance } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";

export function DeleteBalance({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (confirm("Dit saldo verwijderen?")) startTransition(async () => void (await deleteBalance(id)));
      }}
    >
      Verwijderen
    </Button>
  );
}
