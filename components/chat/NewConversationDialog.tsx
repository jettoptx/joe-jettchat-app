"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { callReducer, listConversationsForUser } from "@/lib/spacetimedb";
import { useSession } from "@/hooks/useSession";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Minimal "New DM" launcher.
 *
 * On submit it calls the SpacetimeDB `create_conversation` reducer with a
 * 2-participant CSV (you + the entered handle), then re-fetches the
 * conversation list to find the new id and routes the user into it.
 *
 * The handle is taken at face value — the directory of valid x_handle ↔ x_id
 * lookups will land in a follow-up commit. For now we pass the raw input as
 * the participant identifier, so two browsers using the same handle scheme
 * end up in the same room.
 */
export function NewConversationDialog({
  open,
  onOpenChange,
}: NewConversationDialogProps) {
  const router = useRouter();
  const { session } = useSession();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myXId = session?.xId ?? "";

  const submit = async () => {
    setError(null);
    const target = handle.trim().replace(/^@/, "");
    if (!target) {
      setError("Enter an X handle or x_id");
      return;
    }
    if (!myXId) {
      setError("You need to be signed in to start a conversation");
      return;
    }
    if (target === myXId) {
      setError("Pick someone other than yourself");
      return;
    }

    setBusy(true);
    try {
      // create_conversation(conversation_type, participants_csv, is_encrypted, name, slug)
      await callReducer("create_conversation", [
        "dm",
        `${myXId},${target}`,
        true,
        "",
        "",
      ]);

      // SpacetimeDB returns 200 with no body — find the new row by re-listing.
      // Sorted desc by last_message_at, so the freshly-created DM should be near the top.
      const list = await listConversationsForUser(myXId);
      const created = list.find((c) => {
        const parts = c.participants_csv.split(",").map((s) => s.trim());
        return (
          c.conversation_type === "dm" &&
          parts.includes(myXId) &&
          parts.includes(target)
        );
      });

      onOpenChange(false);
      setHandle("");
      if (created) {
        router.push(`/chat/${created.id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[NewConversationDialog] create_conversation failed:", msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !busy) submit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New encrypted DM</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <Lock className="w-3 h-3" />
            End-to-end encrypted — TKDF + NaCl SecretBox
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="dm-handle"
            className="text-xs font-mono text-muted-foreground"
          >
            X handle or x_id
          </label>
          <Input
            id="dm-handle"
            autoFocus
            placeholder="jettoptx"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={onKey}
            disabled={busy}
            className="font-mono"
          />
          {error && (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !handle.trim()}>
            {busy ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Creating…
              </>
            ) : (
              "Start chat"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
