import { Info } from "@/components/bid-ledger/icons";

/**
 * The compliance disclaimer for the board check-in feature. Kept as a single
 * shared component so the wording is identical everywhere it appears: the
 * project page, the check-in email, and the public response page.
 */
export function CheckinDisclaimer() {
  return (
    <div className="mb-4 flex items-start gap-1.5 rounded bg-gold-tint p-2.5 text-xs text-ink">
      <Info size={14} className="mt-0.5 shrink-0 text-gold" />
      <span>
        This gathers informal input only — <strong>it is not an official vote.</strong> Board
        votes on contracts generally must happen at a properly noticed meeting (or a formal
        written-ballot process your bylaws and state law allow, with its own quorum and notice
        rules). Check your governing documents and state law before treating any reply here as
        binding.
      </span>
    </div>
  );
}
