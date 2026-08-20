import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Terms of Service · Bid Ledger" };

export default function TermsPage() {
  return (
    <div className="min-h-screen w-full bg-paper">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <Logo />

        <DraftNotice />

        <h1 className="mb-1 mt-8 font-serif text-3xl text-ink">Terms of Service</h1>
        <p className="mb-8 text-sm text-ink-soft">Last updated: [DATE]</p>

        <div className="space-y-6 text-sm leading-relaxed text-ink">
          <Section title="1. Who this is">
            <p>
              Bid Ledger (the &ldquo;Service&rdquo;) is operated by <Placeholder>COMPANY NAME</Placeholder> (&ldquo;we,&rdquo;
              &ldquo;us&rdquo;). These Terms govern your use of the Service at{" "}
              <Placeholder>yourdomain.com</Placeholder> and any related pages. By creating an account or using the
              Service, you agree to these Terms on behalf of yourself and, if applicable, the homeowners&rsquo;
              association, condo association, or similar community organization (the &ldquo;Organization&rdquo;) you
              represent.
            </p>
          </Section>

          <Section title="2. What the Service is — and isn't">
            <p className="mb-2">
              Bid Ledger is a coordination tool for volunteer community boards: comparing contractor bids on capital
              projects, tracking a reserve fund, tracking dues collection, and gathering informal input from board
              members and residents.
            </p>
            <p className="mb-2">The Service is <strong>not</strong>:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                A substitute for legal, accounting, or governance advice. Your Organization&rsquo;s governing
                documents and applicable state law control what your board is required to do — always check those
                before relying on anything in the Service.
              </li>
              <li>
                A mechanism for official board votes or binding resident decisions. Board check-ins and resident
                polls in the Service gather informal input only; they are not a substitute for a properly noticed
                board meeting or a formal written-ballot process your governing documents and state law allow.
              </li>
              <li>
                A payment processor. As of this version, the Service does not collect or move money on your
                Organization&rsquo;s behalf — dues tracking is a manual record-keeping tool only.
              </li>
            </ul>
          </Section>

          <Section title="3. Accounts">
            <p>
              You must provide accurate information when creating an account and are responsible for activity under
              your account. If you create an Organization on the Service, you represent that you&rsquo;re authorized
              to do so on its behalf. Board admins are responsible for who they invite as board members, and for the
              accuracy of resident and contractor contact information they enter.
            </p>
          </Section>

          <Section title="4. Acceptable use">
            <p className="mb-2">You agree not to use the Service to:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Violate any law, or your Organization&rsquo;s governing documents;</li>
              <li>Impersonate another person or misrepresent your affiliation with an Organization;</li>
              <li>Access or attempt to access another Organization&rsquo;s data;</li>
              <li>Interfere with the Service&rsquo;s operation or attempt to circumvent its access controls.</li>
            </ul>
          </Section>

          <Section title="5. Your Organization's data">
            <p>
              Data your Organization enters — projects, bids, reserve figures, dues records, resident and contractor
              contact information — belongs to your Organization. We act as a processor of that data on your
              behalf, as described in our{" "}
              <Link href="/privacy" className="text-ink underline hover:text-gold-text">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="6. No warranty; limitation of liability">
            <p>
              The Service is provided &ldquo;as is,&rdquo; without warranties of any kind. To the maximum extent
              permitted by law, <Placeholder>COMPANY NAME</Placeholder> is not liable for indirect, incidental, or
              consequential damages arising from your use of the Service, including decisions your Organization
              makes based on information in it.
            </p>
          </Section>

          <Section title="7. Termination">
            <p>
              You may stop using the Service at any time. We may suspend or terminate access for violation of these
              Terms. On termination, we&rsquo;ll make reasonable efforts to make your Organization&rsquo;s data
              available for export before deletion, consistent with our data retention practices.
            </p>
          </Section>

          <Section title="8. Changes to these Terms">
            <p>
              We may update these Terms from time to time. If we make material changes, we&rsquo;ll notify board
              admins by email before they take effect.
            </p>
          </Section>

          <Section title="9. Governing law">
            <p>
              These Terms are governed by the laws of <Placeholder>STATE / JURISDICTION</Placeholder>, without regard
              to its conflict-of-laws principles.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about these Terms: <Placeholder>legal@yourdomain.com</Placeholder>
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function DraftNotice() {
  return (
    <div className="mt-6 rounded border border-dashed border-gold bg-gold-tint p-3 text-xs text-ink">
      <strong>Draft — not yet finalized.</strong> Bracketed placeholders (like{" "}
      <Placeholder>COMPANY NAME</Placeholder>) need real values, and this document has not been reviewed by a
      lawyer. Replace the placeholders and get it reviewed before relying on it for a real Organization&rsquo;s
      data.
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-gold-text">[{children}]</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 font-serif text-lg font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}
