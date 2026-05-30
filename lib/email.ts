import { Resend } from "resend";
import { render } from "@react-email/render";
import RegistrationWelcome from "@/emails/RegistrationWelcome";

const PACKAGE_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
  emerald: "Emerald",
};

export async function sendWelcomeEmail(args: {
  email: string;
  name: string;
  selectedPackage: string;
  amount: number;
  transactionRef: string;
  paidAt: number;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const packageLabel = PACKAGE_LABELS[args.selectedPackage] ?? args.selectedPackage;
  const html = await render(
    RegistrationWelcome({
      name: args.name,
      email: args.email,
      selectedPackage: args.selectedPackage,
      amountPaid: args.amount,
      transactionRef: args.transactionRef,
      paidAt: args.paidAt,
    })
  );
  const { error } = await resend.emails.send({
    from: "Heritage Cooperative <noreply@heritage-cooperative.com.ng>",
    to: [args.email],
    subject: `Welcome to Heritage Cooperative — Your ${packageLabel} Membership is Active`,
    html,
  });
  if (error) {
    console.error(`Resend error for ${args.email}:`, error);
  } else {
    console.log(`Welcome email sent to ${args.email}`);
  }
}
