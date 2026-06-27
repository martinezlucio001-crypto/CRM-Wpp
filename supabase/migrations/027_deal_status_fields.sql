-- ============================================================
-- 027_deal_status_fields.sql
-- ============================================================

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'not_sent' CHECK (contract_status IN ('not_sent', 'sent', 'signed'));
