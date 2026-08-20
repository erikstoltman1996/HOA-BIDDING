"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitContractorUpdate } from "@/app/contractor/[token]/actions";
import { Button } from "@/components/ui/Button";
import { Check, Camera, X } from "@/components/bid-ledger/icons";

const STATUS_OPTIONS: Array<{ value: "on_track" | "ahead" | "delayed"; label: string }> = [
  { value: "on_track", label: "On track" },
  { value: "ahead", label: "Ahead of schedule" },
  { value: "delayed", label: "Delayed" },
];

const MAX_PHOTOS = 6;

export function ContractorUpdateForm({
  token,
  projectTitle,
  contractorName,
}: {
  token: string;
  projectTitle: string;
  contractorName: string;
}) {
  const [percent, setPercent] = useState(50);
  const [status, setStatus] = useState<"on_track" | "ahead" | "delayed">("on_track");
  const [photos, setPhotos] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs for the thumbnail grid — derived from the selected files
  // rather than stored in their own state (nothing here needs to trigger a
  // second render). The effect below only revokes them on the way out, so
  // we don't leak memory on a page a contractor might leave open on-site.
  const previewUrls = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => {
    return () => previewUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [previewUrls]);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS));
    // Reset so selecting the same file again later still fires onChange.
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    photos.forEach((file) => formData.append("photos", file));
    startTransition(async () => {
      try {
        await submitContractorUpdate(token, formData);
        setState("done");
        formRef.current?.reset();
        setPercent(50);
        setStatus("on_track");
        setPhotos([]);
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "Could not submit update");
      }
    });
  }

  if (state === "done") {
    return (
      <div className="text-center text-sm text-ink">
        <Check size={20} className="mx-auto mb-2 text-check-green" />
        <p className="font-serif text-lg">Update posted</p>
        <p className="text-ink-soft">Thanks — the board will see this right away.</p>
        <button
          onClick={() => setState("idle")}
          className="mt-4 text-xs text-ink-soft underline hover:text-ink"
        >
          Post another update
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-widest text-ink-soft" style={{ letterSpacing: "0.15em" }}>
        Weekly Update
      </div>
      <h1 className="mb-1 font-serif text-2xl text-ink">{projectTitle}</h1>
      <p className="mb-4 text-sm text-ink-soft">{contractorName}</p>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="percent_complete" className="mb-1 block text-xs text-ink-soft">
            % complete: <span className="font-mono font-semibold text-ink">{percent}%</span>
          </label>
          <input
            id="percent_complete"
            name="percent_complete"
            type="range"
            min={0}
            max={100}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-soft">Status</label>
          <div className="flex flex-wrap gap-3">
            {STATUS_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm text-ink">
                <input
                  type="radio"
                  name="timeline_status"
                  value={opt.value}
                  checked={status === opt.value}
                  onChange={() => setStatus(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="issues_text" className="mb-1 block text-xs text-ink-soft">
            Issues or blockers {status === "delayed" && "(what's causing the delay?)"}
          </label>
          <textarea
            id="issues_text"
            name="issues_text"
            rows={3}
            className="w-full rounded border border-rule bg-paper-card p-2 text-sm text-ink outline-none focus:border-ink"
            placeholder="Anything the board should know…"
          />
        </div>

        <div>
          <label htmlFor="next_milestone_date" className="mb-1 block text-xs text-ink-soft">
            Next milestone / expected date
          </label>
          <input
            id="next_milestone_date"
            name="next_milestone_date"
            type="date"
            className="rounded border border-rule bg-paper-card px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="block text-xs text-ink-soft">Photos (optional, up to {MAX_PHOTOS})</span>
            {photos.length > 0 && (
              <span className="font-mono text-xs text-ink-soft">
                {photos.length}/{MAX_PHOTOS}
              </span>
            )}
          </div>

          {previewUrls.length > 0 && (
            <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {previewUrls.map((url, i) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded border border-rule">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-paper hover:bg-ink"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFilesSelected}
            className="hidden"
          />
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-rule py-3 text-sm text-ink-soft hover:border-ink hover:text-ink"
            >
              <Camera size={16} />
              {photos.length === 0 ? "Add photos" : "Add more photos"}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Posting…" : "Post update"}
        </Button>
      </form>
    </div>
  );
}
