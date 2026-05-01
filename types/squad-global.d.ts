interface SquadConfig {
  key: string;
  email: string;
  phone_number?: string;
  amount: number;
  currency_code?: string;
  customer_name?: string;
  transaction_ref?: string;
  metadata?: Record<string, unknown>;
  onLoad?: () => void;
  onClose?: () => void;
  onSuccess?: (data: import("./squad").SquadSuccessData) => void;
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
