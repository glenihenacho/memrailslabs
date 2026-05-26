export type PaymentRail = 'usdc_tempo' | 'stripe_card' | 'visa' | 'lightning' | 'custom';

export type SessionStatus = 'authorized' | 'active' | 'exhausted' | 'closed';

export type PaymentSession = {
  session_id: string;
  payer_agent_id?: string;
  endpoint_id?: string;
  budget_cents: number;
  spent_cents: number;
  rail: PaymentRail;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
};

export type Voucher = {
  ok: true;
  session_id: string;
  packet_id: string;
  debit_cents: number;
  remaining_cents: number;
  rail: PaymentRail;
};

export type VoucherRefusal = {
  ok: false;
  reason: 'session_not_found' | 'session_closed' | 'session_exhausted' | 'insufficient_budget';
  session_id: string;
};

export type VoucherResult = Voucher | VoucherRefusal;
