import type { SquadSuccessData } from "./squad";

interface SquadConfig {
  key: string;
  email: string;
  amount: number;
  currency_code: "NGN" | "USD";
  transaction_ref?: string;
  customer_name?: string;
  phone_number?: string;
  metadata?: Record<string, unknown>;
  payment_channels?: Array<"card" | "bank" | "ussd" | "transfer">;
  onLoad?: () => void;
  onClose?: () => void;
  onSuccess?: (data: SquadSuccessData) => void;
}

interface SquadInstance {
  setup(): void;
  open(): void;
}

// The SDK may register under any of these globals depending on the build target
declare global {
  interface Window {
    squad?: new (config: SquadConfig) => SquadInstance;
    Squad?: new (config: SquadConfig) => SquadInstance;
    "@squad"?: new (config: SquadConfig) => SquadInstance;
  }
}

export {};
