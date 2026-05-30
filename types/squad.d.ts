interface SquadInstance {
  setup(): void;
  open(): void;
}

interface SquadConfig {
  key: string;
  email: string;
  amount: number;
  currency_code: string;
  transaction_ref: string;
  CallBack_URL: string;
  onLoad?: () => void;
  onClose?: () => void;
  onSuccess?: (data: { transaction_ref?: string }) => void;
}

interface Window {
  squad: new (config: SquadConfig) => SquadInstance;
}
