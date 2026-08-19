import "server-only";
import { Resend } from "resend";
import CheckinEmail, { type BidSummaryLine } from "@/emails/CheckinEmail";
import ContractorInviteEmail from "@/emails/ContractorInviteEmail";
import ResidentInviteEmail from "@/emails/ResidentInviteEmail";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return new Resend(apiKey);
}

export interface SendCheckinEmailArgs {
  to: string;
  recipientName: string;
  projectTitle: string;
  orgName: string;
  respondBy: string | null;
  bids: BidSummaryLine[];
  responseUrl: string;
}

export async function sendCheckinEmail({
  to,
  recipientName,
  projectTitle,
  orgName,
  respondBy,
  bids,
  responseUrl,
}: SendCheckinEmailArgs) {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL || "Bid Ledger <onboarding@resend.dev>";

  return resend.emails.send({
    from,
    to,
    subject: `Board check-in: ${projectTitle}`,
    react: CheckinEmail({
      recipientName,
      projectTitle,
      orgName,
      respondBy,
      bids,
      responseUrl,
    }),
  });
}

export interface SendContractorInviteEmailArgs {
  to: string;
  contractorName: string;
  projectTitle: string;
  orgName: string;
  updateUrl: string;
  isReminder?: boolean;
}

export async function sendContractorInviteEmail({
  to,
  contractorName,
  projectTitle,
  orgName,
  updateUrl,
  isReminder = false,
}: SendContractorInviteEmailArgs) {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL || "Bid Ledger <onboarding@resend.dev>";

  return resend.emails.send({
    from,
    to,
    subject: isReminder ? `Weekly update reminder: ${projectTitle}` : `You're set up on ${projectTitle}`,
    react: ContractorInviteEmail({ contractorName, projectTitle, orgName, updateUrl, isReminder }),
  });
}

export interface SendResidentInviteEmailArgs {
  to: string;
  unitLabel: string;
  orgName: string;
  voteUrl: string;
}

export async function sendResidentInviteEmail({ to, unitLabel, orgName, voteUrl }: SendResidentInviteEmailArgs) {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL || "Bid Ledger <onboarding@resend.dev>";

  return resend.emails.send({
    from,
    to,
    subject: `Your link to weigh in on ${orgName} decisions`,
    react: ResidentInviteEmail({ unitLabel, orgName, voteUrl }),
  });
}
