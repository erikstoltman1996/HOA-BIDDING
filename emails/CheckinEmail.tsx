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
const GOLD = "#B8863B";
const GOLD_TINT = "#F1E7D3";

export interface BidSummaryLine {
  vendor: string;
  total: string;
  isLowest: boolean;
  warranty: string;
  timeline: string;
}

export interface CheckinEmailProps {
  recipientName: string;
  projectTitle: string;
  orgName: string;
  respondBy: string | null;
  bids: BidSummaryLine[];
  responseUrl: string;
}

export default function CheckinEmail({
  recipientName,
  projectTitle,
  orgName,
  respondBy,
  bids,
  responseUrl,
}: CheckinEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Board check-in: {projectTitle}</Preview>
      <Body style={{ backgroundColor: PAPER, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: 0 }}>
        <Container style={{ backgroundColor: PAPER_CARD, border: `1px solid ${RULE}`, borderRadius: 6, margin: "24px auto", padding: 32, maxWidth: 560 }}>
          <Text style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: INK_SOFT, margin: "0 0 8px", fontFamily: "Arial, sans-serif" }}>
            {orgName} · Bid Ledger
          </Text>
          <Heading style={{ fontSize: 22, color: INK, margin: "0 0 16px", fontFamily: "Georgia, serif" }}>
            Board check-in: {projectTitle}
          </Heading>

          <Text style={{ fontSize: 13, color: INK, fontFamily: "Arial, sans-serif" }}>
            Hi {recipientName || "there"},
          </Text>
          <Text style={{ fontSize: 13, color: INK, fontFamily: "Arial, sans-serif" }}>
            The board is gathering informal input on this project before the next meeting.
            {respondBy ? ` Please reply by ${respondBy}.` : ""}
          </Text>

          <Section style={{ backgroundColor: GOLD_TINT, borderRadius: 4, padding: "10px 14px", margin: "16px 0" }}>
            <Text style={{ fontSize: 12, color: INK, margin: 0, fontFamily: "Arial, sans-serif" }}>
              This is an informal check-in only — <strong>it is not an official vote.</strong>{" "}
              Board votes on contracts generally must happen at a properly noticed meeting (or a
              formal written-ballot process your bylaws and state law allow). Check your governing
              documents and state law before treating any reply here as binding.
            </Text>
          </Section>

          <Hr style={{ borderColor: RULE, margin: "20px 0" }} />

          {bids.map((b) => (
            <Text key={b.vendor} style={{ fontSize: 13, color: INK, margin: "0 0 6px", fontFamily: "Arial, sans-serif" }}>
              <strong>{b.vendor}</strong>
              {b.isLowest ? " — lowest total" : ""}
              <br />
              <span style={{ fontFamily: "monospace", color: b.isLowest ? "#3F6B4E" : INK }}>{b.total}</span>
              {"  ·  "}
              {b.warranty} warranty · {b.timeline} timeline
            </Text>
          ))}

          <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
            <Link
              href={responseUrl}
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
              Record your pick
            </Link>
          </Section>
          <Text style={{ fontSize: 11, color: INK_SOFT, textAlign: "center", fontFamily: "Arial, sans-serif" }}>
            Or paste this link into your browser: <br />
            <Link href={responseUrl} style={{ color: GOLD }}>{responseUrl}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
