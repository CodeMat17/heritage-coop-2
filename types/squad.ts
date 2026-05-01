export interface SquadSuccessData {
  transaction_ref?: string;
  gateway_ref?: string;
  amount?: number;
  currency?: string;
  message?: string;
}

export interface SquadVerifyData {
  transaction_ref: string;
  transaction_status: "Success" | "Failed" | "Abandoned" | "Pending" | string;
  amount: number;
  merchant_amount?: number;
  currency: string;
  customer_mobile?: string;
  email: string;
  meta?: Record<string, unknown>;
  gateway_ref?: string;
  card_type?: string;
  created_at?: string;
  payment_information?: {
    payment_type?: string;
    card_type?: string;
    pan?: string;
    token_id?: string;
  };
}

export interface SquadVerifyResponse {
  success: boolean;
  message: string;
  data?: SquadVerifyData;
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
  merchant_amount?: number;
  currency?: string;
  transaction_status?: string;
  transaction_type?: string;
  gateway_ref?: string;
  customer_mobile?: string;
  is_recurring?: boolean;
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
