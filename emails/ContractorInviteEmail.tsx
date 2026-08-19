import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const INK = "#1F2B3D";
const INK_SOFT = "#5B6578";
const PAPER = "#EDEAE1";
const PAPER_CARD = "#F6F4EE";
const RULE = "#C8C2B4";

export interface ContractorInviteEmailProps {
  contractorName: string;
  projectTitle: string;
  orgName: string;
  updateUrl: string;
  isReminder: boolean;
}

export default function ContractorInviteEmail({
  contractorName,
  projectTitle,
  orgName,
  updateUrl,
  isReminder,
}: ContractorInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {isReminder ? "Weekly update reminder" : "You've been added"}: {projectTitle}
      </Preview>
      <Body style={{ backgroundColor: PAPER, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ backgroundColor: PAPER_CARD, border: `1px solid ${RULE}`, borderRadius: 6, margin: "24px auto", padding: 32, maxWidth: 560 }}>
          <Text style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: INK_SOFT, margin: "0 0 8px", fontFamily: "Arial, sans-serif" }}>
            {orgName} · Bid Ledger
          </Text>
          <Heading style={{ fontSize: 22, color: INK, margin: "0 0 16px", fontFamily: "Georgia, serif" }}>
            {isReminder ? "Weekly update reminder" : `You're set up on ${projectTitle}`}
          </Heading>

          <Text style={{ fontSize: 13, color: INK, fontFamily: "Arial, sans-serif" }}>
            Hi {contractorName || "there"},
          </Text>
          {isReminder ? (
            <Text style={{ fontSize: 13, color: INK, fontFamily: "Arial, sans-serif" }}>
              Just a reminder to post this week&apos;s progress update on <strong>{projectTitle}</strong> —
              it takes a couple of minutes and helps keep the board in the loop.
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: INK, fontFamily: "Arial, sans-serif" }}>
                The board has added you as the contractor on <strong>{projectTitle}</strong>. Use the
                link below each week to post a quick progress update — no account or password needed.
              </Text>
              <Text style={{ fontSize: 13, color: INK, fontFamily: "Arial, sans-serif" }}>
                It only takes a minute: percent complete, on-track/ahead/delayed, any issues, a couple
                of photos if you have them, and your next milestone.
              </Text>
            </>
          )}

          <Hr style={{ borderColor: RULE, margin: "20px 0" }} />

          <Section style={{ textAlign: "center", margin: "12px 0 8px" }}>
            <Link
              href={updateUrl}
              style={{
                backgroundColor: INK,
                color: PAPER_CARD,
                padding: "10px 20px",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: "bold",
                textDecoration: "none",
                fontFamily: "Arial, sans-serif",
              }}
            >
              Post this week&apos;s update
            </Link>
          </Section>
          <Text style={{ fontSize: 11, color: INK_SOFT, textAlign: "center", fontFamily: "Arial, sans-serif" }}>
            Bookmark this link — it&apos;s yours for the life of the project. <br />
            <Link href={updateUrl} style={{ color: "#B8863B" }}>{updateUrl}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
