-- ============================================================
-- 026_billing_and_manual_messages.sql
-- ============================================================

-- 1. MANUAL_MESSAGE_TEMPLATES
CREATE TABLE IF NOT EXISTS manual_message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_message_templates_account ON manual_message_templates(account_id);

ALTER TABLE manual_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manual_message_templates_select ON manual_message_templates;
CREATE POLICY manual_message_templates_select ON manual_message_templates FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS manual_message_templates_insert ON manual_message_templates;
CREATE POLICY manual_message_templates_insert ON manual_message_templates FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS manual_message_templates_update ON manual_message_templates;
CREATE POLICY manual_message_templates_update ON manual_message_templates FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS manual_message_templates_delete ON manual_message_templates;
CREATE POLICY manual_message_templates_delete ON manual_message_templates FOR DELETE
  USING (is_account_member(account_id, 'agent'));


-- 2. DEAL_INSTALLMENTS (Parcelas do Processo)
CREATE TABLE IF NOT EXISTS deal_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'boleto', 'cash', 'other')),
  receipt_url TEXT, -- storage file_path relative to bucket 'documents'
  paid_at TIMESTAMPTZ,
  message_template_id UUID REFERENCES manual_message_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_installments_account ON deal_installments(account_id);
CREATE INDEX IF NOT EXISTS idx_deal_installments_deal ON deal_installments(deal_id);

ALTER TABLE deal_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_installments_select ON deal_installments;
CREATE POLICY deal_installments_select ON deal_installments FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS deal_installments_insert ON deal_installments;
CREATE POLICY deal_installments_insert ON deal_installments FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS deal_installments_update ON deal_installments;
CREATE POLICY deal_installments_update ON deal_installments FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS deal_installments_delete ON deal_installments;
CREATE POLICY deal_installments_delete ON deal_installments FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON manual_message_templates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON manual_message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON deal_installments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deal_installments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
