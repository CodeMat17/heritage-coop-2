export interface SquadWebhookPaymentInfo {
  payment_type?: string;
  card_type?: string;
  pan?: string;
  token_id?: string;
}

export interface SquadWebhookTransaction {
  email: string;
  amount: number;
  merchant_amount?: number;
  currency?: string;
  transaction_status?: string;
  transaction_type?: string;
  gateway_ref?: string;
  customer_mobile?: string;
  is_recurring?: boolean;
  narration?: string;
  metadata?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  merchant_id?: string;
  created_at?: string;
  payment_information?: SquadWebhookPaymentInfo;
}

export interface SquadWebhookBody {
  Event: string;
  TransactionRef: string;
  Body: SquadWebhookTransaction;
}
