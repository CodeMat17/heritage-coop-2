import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const PACKAGE_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
  emerald: "Emerald",
};

const PACKAGE_COLORS: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#a8a9ad",
  gold: "#d4a017",
  diamond: "#00bcd4",
  emerald: "#16a34a",
};

interface Props {
  name: string;
  email: string;
  selectedPackage: string;
  amountPaid: number;
  transactionRef: string;
  paidAt: number;
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

export default function RegistrationWelcome({
  name = "John Doe",
  email = "john@example.com",
  selectedPackage = "gold",
  amountPaid = 20000,
  transactionRef = "TXN-000000000000",
  paidAt = Date.now(),
}: Props) {
  const firstName = name.split(" ")[0];
  const packageLabel = PACKAGE_LABELS[selectedPackage] ?? selectedPackage;
  const packageColor = PACKAGE_COLORS[selectedPackage] ?? "#16a34a";

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Your Heritage Cooperative {packageLabel} membership is now active.
      </Preview>
      <Body style={body}>
        <Container style={container}>

          {/* Header */}
          <Section style={header}>
            <Text style={headerEyebrow}>Heritage Cooperative Society</Text>
            <Heading style={headerTitle}>Registration Confirmed</Heading>
          </Section>

          {/* Body */}
          <Section style={bodySection}>

            <Text style={greeting}>Dear <strong>{firstName}</strong>,</Text>
            <Text style={paragraph}>
              Congratulations! Your registration fee has been received and your
              Heritage Cooperative account is now{" "}
              <strong style={{ color: "#15803d" }}>fully active</strong>. We are
              delighted to welcome you as an official member.
            </Text>

            {/* Membership Badge */}
            <Section style={badgeSection}>
              <Text style={badgeLabel}>Your Membership Tier</Text>
              <Text style={{ ...badgeTier, color: packageColor }}>
                {packageLabel} Member
              </Text>
            </Section>

            {/* Payment Details */}
            <Text style={sectionLabel}>Payment Details</Text>
            <Section style={table}>
              <Row style={tableRowAlt}>
                <Column style={tableKey}>Amount Paid</Column>
                <Column style={{ ...tableVal, fontWeight: "700" }}>
                  {formatNaira(amountPaid)}
                </Column>
              </Row>
              <Row style={tableRow}>
                <Column style={tableKey}>Transaction Ref</Column>
                <Column style={{ ...tableVal, fontFamily: "monospace", fontSize: "12px" }}>
                  {transactionRef}
                </Column>
              </Row>
              <Row style={tableRowAlt}>
                <Column style={tableKey}>Date & Time</Column>
                <Column style={tableVal}>{formatDate(paidAt)} (WAT)</Column>
              </Row>
            </Section>

            {/* What's Next */}
            <Text style={{ ...sectionLabel, marginTop: "28px" }}>What's Next</Text>

            <Section style={stepRow}>
              <Row>
                <Column style={stepBadgeCol}>
                  <Text style={stepBadge}>1</Text>
                </Column>
                <Column style={stepTextCol}>
                  <Text style={stepText}>
                    Log in to your <strong>dashboard</strong> to view your
                    membership details and contribution history.
                  </Text>
                </Column>
              </Row>
            </Section>

            <Section style={stepRow}>
              <Row>
                <Column style={stepBadgeCol}>
                  <Text style={stepBadge}>2</Text>
                </Column>
                <Column style={stepTextCol}>
                  <Text style={stepText}>
                    Start making your <strong>monthly contributions</strong> to
                    grow your savings and unlock cooperative benefits.
                  </Text>
                </Column>
              </Row>
            </Section>

            <Section style={{ ...stepRow, marginBottom: "32px" }}>
              <Row>
                <Column style={stepBadgeCol}>
                  <Text style={stepBadge}>3</Text>
                </Column>
                <Column style={stepTextCol}>
                  <Text style={stepText}>
                    Contact us at{" "}
                    <Link
                      href="mailto:info@heritage-cooperative.com.ng"
                      style={link}
                    >
                      info@heritage-cooperative.com.ng
                    </Link>{" "}
                    if you have any questions.
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* CTA */}
            <Section style={{ textAlign: "center" as const }}>
              <Button
                href="https://www.heritage-cooperative.com.ng/dashboard"
                style={ctaButton}
              >
                Go to My Dashboard →
              </Button>
            </Section>

          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerOrg}>Heritage Cooperative Society</Text>
            <Text style={footerContact}>
              <Link href="mailto:info@heritage-cooperative.com.ng" style={footerLink}>
                info@heritage-cooperative.com.ng
              </Link>
            </Text>
            <Text style={footerNote}>
              This email was sent to {email} because you completed registration
              on the Heritage Cooperative platform. Please keep your transaction
              reference for your records.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: "#f4f6f8",
  fontFamily: "Arial, Helvetica, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "600px",
  margin: "32px auto",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const header: React.CSSProperties = {
  backgroundColor: "#15803d",
  padding: "36px 40px",
  textAlign: "center",
};

const headerEyebrow: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: "11px",
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "#bbf7d0",
  fontWeight: "600",
};

const headerTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "26px",
  fontWeight: "700",
  color: "#ffffff",
  lineHeight: "1.3",
};

const bodySection: React.CSSProperties = {
  padding: "40px 40px 32px",
};

const greeting: React.CSSProperties = {
  margin: "0 0 24px",
  fontSize: "16px",
  color: "#374151",
  lineHeight: "1.6",
};

const paragraph: React.CSSProperties = {
  margin: "0 0 24px",
  fontSize: "15px",
  color: "#4b5563",
  lineHeight: "1.7",
};

const badgeSection: React.CSSProperties = {
  backgroundColor: "#f0fdf4",
  border: "1.5px solid #bbf7d0",
  borderRadius: "10px",
  padding: "20px 24px",
  textAlign: "center",
  marginBottom: "28px",
};

const badgeLabel: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: "11px",
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: "#6b7280",
  fontWeight: "600",
};

const badgeTier: React.CSSProperties = {
  margin: 0,
  fontSize: "28px",
  fontWeight: "800",
};

const sectionLabel: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: "13px",
  fontWeight: "700",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: "#6b7280",
};

const table: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  overflow: "hidden",
  marginBottom: "0",
};

const tableRow: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
};

const tableRowAlt: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
};

const tableKey: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: "#6b7280",
  fontWeight: "600",
  width: "45%",
};

const tableVal: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: "#374151",
};

const stepRow: React.CSSProperties = {
  marginBottom: "12px",
};

const stepBadgeCol: React.CSSProperties = {
  width: "32px",
  verticalAlign: "top",
};

const stepBadge: React.CSSProperties = {
  margin: 0,
  width: "20px",
  height: "20px",
  backgroundColor: "#dcfce7",
  borderRadius: "50%",
  textAlign: "center",
  lineHeight: "20px",
  fontSize: "11px",
  fontWeight: "700",
  color: "#15803d",
};

const stepTextCol: React.CSSProperties = {
  verticalAlign: "top",
  paddingLeft: "12px",
};

const stepText: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  color: "#4b5563",
  lineHeight: "1.6",
};

const link: React.CSSProperties = {
  color: "#15803d",
  textDecoration: "none",
  fontWeight: "600",
};

const ctaButton: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#15803d",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  textDecoration: "none",
  padding: "14px 40px",
  borderRadius: "8px",
  letterSpacing: "0.3px",
};

const divider: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  margin: "0 40px",
};

const footer: React.CSSProperties = {
  padding: "24px 40px",
  textAlign: "center",
};

const footerOrg: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: "13px",
  color: "#9ca3af",
};

const footerContact: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: "12px",
};

const footerLink: React.CSSProperties = {
  color: "#6b7280",
  textDecoration: "none",
};

const footerNote: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  color: "#d1d5db",
  lineHeight: "1.6",
};
