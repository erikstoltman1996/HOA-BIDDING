"use client";

import { useTransition } from "react";
import { createProject } from "@/app/project/actions";
import { Button } from "@/components/ui/Button";
import { Plus } from "@/components/bid-ledger/icons";

/** Creates a blank project and redirects straight into it — the server
 *  action itself calls redirect(), this just has to survive that throw. */
export function NewProjectButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button onClick={() => startTransition(() => createProject())} disabled={isPending}>
      <Plus size={14} /> {isPending ? "Creating…" : "New project"}
    </Button>
  );
}
