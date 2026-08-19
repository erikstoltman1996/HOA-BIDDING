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
const GOLD_TINT = "#F1E7D3";

export interface ResidentInviteEmailProps {
  unitLabel: string;
  orgName: string;
  voteUrl: string;
}

export default function ResidentInviteEmail({ unitLabel, orgName, voteUrl }: ResidentInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your link to weigh in on {orgName} decisions</Preview>
      <Body style={{ backgroundColor: PAPER, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ backgroundColor: PAPER_CARD, border: `1px solid ${RULE}`, borderRadius: 6, margin: "24px auto", padding: 32, maxWidth: 560 }}>
          <Text style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: INK_SOFT, margin: "0 0 8px", fontFamily: "Arial, sans-serif" }}>
            {orgName} · Bid Ledger
          </Text>
          <Heading style={{ fontSize: 22, color: INK, margin: "0 0 16px", fontFamily: "Georgia, serif" }}>
            Your link to weigh in on community decisions
          </Heading>

          <Text style={{ fontSize: 13, color: INK, fontFamily: "Arial, sans-serif" }}>
            Hi {unitLabel ? `— resident of ${unitLabel}` : "there"},
          </Text>
          <Text style={{ fontSize: 13, color: INK, fontFamily: "Arial, sans-serif" }}>
            From time to time the board will ask residents for input on upcoming decisions — things
            like how to spend this year&apos;s capital funds. Use the link below whenever there&apos;s
            something open to weigh in on. No account or password needed.
          </Text>

          <Section style={{ backgroundColor: GOLD_TINT, borderRadius: 4, padding: "10px 14px", margin: "16px 0" }}>
            <Text style={{ fontSize: 12, color: INK, margin: 0, fontFamily: "Arial, sans-serif" }}>
              This gathers informal input only — <strong>it is not an official vote.</strong> Formal
              decisions on HOA spending still follow your bylaws and state law, at a properly noticed
              board meeting or ballot process.
            </Text>
          </Section>

          <Hr style={{ borderColor: RULE, margin: "20px 0" }} />

          <Section style={{ textAlign: "center", margin: "12px 0 8px" }}>
            <Link
              href={voteUrl}
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
              See what&apos;s open
            </Link>
          </Section>
          <Text style={{ fontSize: 11, color: INK_SOFT, textAlign: "center", fontFamily: "Arial, sans-serif" }}>
            Bookmark this link — it&apos;s yours to reuse for future decisions. <br />
            <Link href={voteUrl} style={{ color: "#B8863B" }}>{voteUrl}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
