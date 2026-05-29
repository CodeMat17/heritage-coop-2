import type { SquadSuccessData } from "./squad";

interface SquadConfig {
  key: string;
  email: string;
  amount: number;
  currency_code?: string;
  transaction_ref?: string;
  customer_name?: string;
  phone_number?: string;
  CallBack_URL?: string;
  metadata?: Record<string, unknown>;
  onLoad?: () => void;
  onClose?: () => void;
  onSuccess?: (data: SquadSuccessData) => void;
}

interface SquadInstance {
  setup(): void;
  open(): void;
}

declare global {
  interface Window {
    squad: new (config: SquadConfig) => SquadInstance;
  }
}

export {};
