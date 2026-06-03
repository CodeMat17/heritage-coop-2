export interface SquadSuccessData {
  transaction_ref: string;
  [key: string]: unknown;
}

export interface SquadVerifyResponse {
  status: number;
  success: boolean;
  message: string;
  data: {
    transaction_ref: string;
    gateway_ref?: string;
    transaction_status: string;
    email: string;
    transaction_amount: number;
    merchant_amount?: number;
    currency?: string;
    meta?: Record<string, unknown>;
  };
}

export interface SquadWebhookPaymentInfo {
  payment_type?: string;
  card_type?: string;
  pan?: string;
  token_id?: string;
}

export interface SquadWebhookTransaction {
  email: string;
  amount: number;
  transaction_ref?: string;
  transaction_status?: string;
  transaction_currency_id?: string;
  gateway_transaction_ref?: string;
  merchant_email?: string;
  merchant_name?: string;
  merchant_amount?: number;
  currency?: string;
  transaction_type?: string;
  gateway_ref?: string;
  customer_mobile?: string;
  is_recurring?: boolean;
  recurring?: boolean;
  narration?: string;
  plan_code?: string;
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
