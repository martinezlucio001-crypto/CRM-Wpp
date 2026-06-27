-- ============================================================
-- 024_documents.sql
--
-- Estutura de banco de dados para gerenciar campos de documentos
-- configuráveis e uploads de arquivos anexados aos contatos.
-- ============================================================

-- ============================================================
-- 1. DOCUMENT_FIELDS (Categorias/Campos de Documentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS document_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_fields_account ON document_fields(account_id);

ALTER TABLE document_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_fields_select ON document_fields;
CREATE POLICY document_fields_select ON document_fields FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS document_fields_insert ON document_fields;
CREATE POLICY document_fields_insert ON document_fields FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS document_fields_update ON document_fields;
CREATE POLICY document_fields_update ON document_fields FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS document_fields_delete ON document_fields;
CREATE POLICY document_fields_delete ON document_fields FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- ============================================================
-- 2. CONTACT_DOCUMENTS (Arquivos anexados)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  document_field_id UUID REFERENCES document_fields(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_documents_account ON contact_documents(account_id);
CREATE INDEX IF NOT EXISTS idx_contact_documents_contact ON contact_documents(contact_id);

ALTER TABLE contact_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_documents_select ON contact_documents;
CREATE POLICY contact_documents_select ON contact_documents FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS contact_documents_insert ON contact_documents;
CREATE POLICY contact_documents_insert ON contact_documents FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS contact_documents_update ON contact_documents;
CREATE POLICY contact_documents_update ON contact_documents FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS contact_documents_delete ON contact_documents;
CREATE POLICY contact_documents_delete ON contact_documents FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- ============================================================
-- 3. STORAGE BUCKET (documents)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  FALSE, -- Privado: segurança em primeiro lugar
  52428800, -- 50 MB de limite por arquivo
  ARRAY[
    -- Imagens
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    -- PDFs e Documentos do Office
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    -- Texto
    'text/plain',
    'text/csv',
    'text/rtf',
    'application/rtf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS para o bucket 'documents'
DROP POLICY IF EXISTS "Documents are readable by account members" ON storage.objects;
CREATE POLICY "Documents are readable by account members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can upload documents" ON storage.objects;
CREATE POLICY "Members can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can update documents" ON storage.objects;
CREATE POLICY "Members can update documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete documents" ON storage.objects;
CREATE POLICY "Members can delete documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );
