-- ============================================================
-- 025_law_firm_adjustments.sql
--
-- Ajustes estruturais para acomodar fluxos jurídicos:
-- 1. Campos de faturamento/honorários na tabela de processos (deals).
-- 2. Advogado responsável (assigned_to) na tabela de contatos.
-- 3. Cadastro automático de documentos padrões para todas as contas.
-- ============================================================

-- 1. Alterações na tabela de processos (deals)
ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS billing_type TEXT CHECK (billing_type IN ('fixed', 'success', 'mixed')),
  ADD COLUMN IF NOT EXISTS billing_fixed_value NUMERIC,
  ADD COLUMN IF NOT EXISTS billing_percentage_value NUMERIC;

-- 2. Alterações na tabela de contatos (contacts)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Criar índice para performance em consultas por responsável
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);

-- 3. Popular documentos padrões de Direito para as contas existentes
INSERT INTO document_fields (account_id, name, is_default)
SELECT a.id, d.name, true
FROM accounts a
CROSS JOIN (
  VALUES 
    ('RG'), 
    ('CPF'), 
    ('Comprovante de Residência'), 
    ('Procuração'), 
    ('Contrato de Honorários')
) AS d(name)
WHERE NOT EXISTS (
  SELECT 1 FROM document_fields df 
  WHERE df.account_id = a.id AND df.name = d.name
);
