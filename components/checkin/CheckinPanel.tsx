"use client";

import { useState, useTransition } from "react";
import {
  inviteBoardMember,
  removeBoardMember,
  resendCheckinReminders,
  sendBoardCheckin,
} from "@/app/project/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { CheckinDisclaimer } from "@/components/checkin/CheckinDisclaimer";
import { ResponseForm } from "@/components/checkin/ResponseForm";
import { Mail, Send, UserPlus, Users, X } from "@/components/bid-ledger/icons";

export interface BoardMember {
  id: string;
  name: string;
  email: string;
}

export interface CheckinResponseRow {
  id: string;
  board_member_id: string | null;
  name: string;
  email: string;
  pick_bid_id: string | null;
  note: string | null;
  token: string;
  responded_at: string | null;
}

export interface CheckinRow {
  id: string;
  respond_by: string | null;
  created_at: string;
  responses: CheckinResponseRow[];
}

export interface CheckinBid {
  id: string;
  vendor: string;
  total: string;
  isLowest: boolean;
}

export function CheckinPanel({
  projectId,
  isAdmin,
  currentUserId,
  boardMembers,
  bids,
  checkins,
}: {
  projectId: string;
  isAdmin: boolean;
  currentUserId: string;
  boardMembers: BoardMember[];
  bids: CheckinBid[];
  checkins: CheckinRow[];
}) {
  return (
    <div className="mt-10 border-t-2 border-ink pt-6">
      <div className="mb-1 flex items-center gap-2">
        <Users size={16} className="text-ink" />
        <h2 className="font-serif text-lg font-semibold text-ink">Board Check-In</h2>
      </div>

      <CheckinDisclaimer />

      {isAdmin && (
        <>
          <BoardRoster boardMembers={boardMembers} />
          <SendCheckinForm projectId={projectId} boardMembers={boardMembers} />
        </>
      )}

      <div className="space-y-6">
        {checkins.length === 0 && (
          <p className="text-xs text-ink-soft">No check-ins sent yet.</p>
        )}
        {checkins.map((c) => (
          <CheckinHistoryCard
            key={c.id}
            checkin={c}
            bids={bids}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}

function BoardRoster({ boardMembers }: { boardMembers: BoardMember[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await inviteBoardMember(name, email);
        setName("");
        setEmail("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send invite");
      }
    });
  }

  return (
    <div className="mb-6 rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 text-xs font-medium text-ink-soft">Board members</div>
      <ul className="mb-3 space-y-1">
        {boardMembers.map((m) => (
          <li key={m.id} className="flex items-center justify-between text-sm">
            <span className="text-ink">
              {m.name} <span className="text-ink-soft">· {m.email}</span>
            </span>
            <button
              onClick={() =>
                startTransition(() => {
                  removeBoardMember(m.id);
                })
              }
              className="text-rule hover:text-ink-soft"
              aria-label={`Remove ${m.name}`}
            >
              <X size={13} />
            </button>
          </li>
        ))}
        {boardMembers.length === 0 && (
          <li className="text-xs text-ink-soft">No board members invited yet.</li>
        )}
      </ul>
      <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
          <Label htmlFor="member-name">Name</Label>
          <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="member-email">Email</Label>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          <UserPlus size={14} /> Invite
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function SendCheckinForm({
  projectId,
  boardMembers,
}: {
  projectId: string;
  boardMembers: BoardMember[];
}) {
  const [respondBy, setRespondBy] = useState("");
  const [selected, setSelected] = useState<string[]>(boardMembers.map((m) => m.id));
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function handleSend() {
    setStatus("idle");
    setError("");
    startTransition(async () => {
      try {
        await sendBoardCheckin(projectId, respondBy || null, selected);
        setStatus("sent");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not send check-in");
      }
    });
  }

  return (
    <div className="mb-6 rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 text-xs font-medium text-ink-soft">Send a new check-in</div>
      <div className="mb-3">
        <Label htmlFor="respond-by">Response requested by (optional)</Label>
        <Input
          id="respond-by"
          type="date"
          value={respondBy}
          onChange={(e) => setRespondBy(e.target.value)}
          className="w-auto"
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        {boardMembers.map((m) => (
          <label key={m.id} className="flex items-center gap-1.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={selected.includes(m.id)}
              onChange={() => toggle(m.id)}
            />
            {m.name}
          </label>
        ))}
      </div>
      <Button
        onClick={handleSend}
        disabled={isPending || selected.length === 0 || boardMembers.length === 0}
      >
        <Send size={14} /> {isPending ? "Sending…" : "Send check-in email"}
      </Button>
      {status === "sent" && <p className="mt-2 text-xs text-check-green">Sent.</p>}
      {status === "error" && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function CheckinHistoryCard({
  checkin,
  bids,
  isAdmin,
  currentUserId,
}: {
  checkin: CheckinRow;
  bids: CheckinBid[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [reminded, setReminded] = useState(false);

  const responded = checkin.responses.filter((r) => r.responded_at);
  const pending = checkin.responses.filter((r) => !r.responded_at);
  const tally = bids.map((b) => ({
    ...b,
    count: checkin.responses.filter((r) => r.pick_bid_id === b.id).length,
  }));
  const topCount = tally.length ? Math.max(...tally.map((t) => t.count)) : 0;

  const myResponse = checkin.responses.find((r) => r.board_member_id === currentUserId);

  return (
    <div className="rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-ink-soft">
          Sent {new Date(checkin.created_at).toLocaleDateString()}
          {checkin.respond_by ? ` · respond by ${checkin.respond_by}` : ""}
        </div>
        {isAdmin && pending.length > 0 && (
          <button
            onClick={() =>
              startTransition(async () => {
                await resendCheckinReminders(checkin.id);
                setReminded(true);
              })
            }
            disabled={isPending}
            className="flex items-center gap-1 text-xs text-gold hover:opacity-80"
          >
            <Mail size={12} /> {reminded ? "Reminder sent" : `Remind ${pending.length}`}
          </button>
        )}
      </div>

      <div className="mb-2 text-xs text-ink-soft">
        {responded.length} of {checkin.responses.length} replied
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {tally
          .filter((t) => t.count > 0)
          .map((t) => (
            <span
              key={t.id}
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                border: `1px solid ${t.count === topCount ? "#B8863B" : "#C8C2B4"}`,
                color: t.count === topCount ? "#B8863B" : "#5B6578",
              }}
            >
              {t.vendor}: {t.count} of {checkin.responses.length}
            </span>
          ))}
      </div>

      <ul className="space-y-1 text-xs text-ink-soft">
        {checkin.responses.map((r) => {
          const pick = bids.find((b) => b.id === r.pick_bid_id);
          return (
            <li key={r.id} className="flex items-center justify-between">
              <span className="text-ink">{r.name}</span>
              <span>{pick ? pick.vendor : "Awaiting reply"}</span>
            </li>
          );
        })}
      </ul>

      {!isAdmin && myResponse && (
        <div className="mt-4 border-t border-rule pt-4">
          <ResponseForm
            token={myResponse.token}
            projectTitle=""
            bids={bids}
            initialPickBidId={myResponse.pick_bid_id}
            initialNote={myResponse.note}
            alreadyResponded={!!myResponse.responded_at}
            compact
          />
        </div>
      )}
    </div>
  );
}
