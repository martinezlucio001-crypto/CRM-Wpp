'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  FileText,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Wand2,
  Plus,
  Loader2,
  UploadCloud,
  Check,
  FileImage,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DocumentsTabProps {
  contactId: string;
  accountId: string;
}

interface DocumentField {
  id: string;
  name: string;
  is_default: boolean;
}

interface ContactDocument {
  id: string;
  document_field_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export function DocumentsTab({ contactId, accountId }: DocumentsTabProps) {
  const supabase = createClient();

  const [fields, setFields] = useState<DocumentField[]>([]);
  const [documents, setDocuments] = useState<ContactDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [isUploadingGeneral, setIsUploadingGeneral] = useState(false);

  // States to keep track of fields active for this contact in the UI
  const [activeFieldIds, setActiveFieldIds] = useState<string[]>([]);
  const [selectedFieldToAdd, setSelectedFieldToAdd] = useState<string>('');

  // Editing state for filenames
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingDocId, setSavingDocId] = useState<string | null>(null);

  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadPreviews() {
      const imageDocs = documents.filter((d) => d.mime_type?.startsWith('image/'));
      if (imageDocs.length === 0) {
        setImagePreviews({});
        return;
      }

      try {
        const paths = imageDocs.map((d) => d.file_path);
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrls(paths, 3600);

        if (error) throw error;

        if (data) {
          const previews: Record<string, string> = {};
          imageDocs.forEach((doc) => {
            const match = data.find((item) => item.path === doc.file_path);
            if (match?.signedUrl) {
              previews[doc.id] = match.signedUrl;
            }
          });
          setImagePreviews(previews);
        }
      } catch (err) {
        console.error('Erro ao gerar previsualizacoes:', err);
      }
    }

    loadPreviews();
  }, [documents, supabase]);

  const fetchData = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    try {
      const [fieldsRes, docsRes] = await Promise.all([
        supabase
          .from('document_fields')
          .select('*')
          .order('is_default', { ascending: false })
          .order('name'),
        supabase
          .from('contact_documents')
          .select('*')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false }),
      ]);

      if (fieldsRes.error) throw fieldsRes.error;
      if (docsRes.error) throw docsRes.error;

      const fetchedFields = fieldsRes.data || [];
      const fetchedDocs = docsRes.data || [];

      setFields(fetchedFields);
      setDocuments(fetchedDocs);

      // Initialize active fields: default fields + fields that already have documents
      const defaultFieldIds = fetchedFields
        .filter((f) => f.is_default)
        .map((f) => f.id);
      const docFieldIds = fetchedDocs
        .map((d) => d.document_field_id)
        .filter((id): id is string => !!id);
      
      const uniqueActiveIds = Array.from(
        new Set([...defaultFieldIds, ...docFieldIds])
      );
      setActiveFieldIds(uniqueActiveIds);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  }, [contactId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCategorySlot = () => {
    if (!selectedFieldToAdd) return;
    if (!activeFieldIds.includes(selectedFieldToAdd)) {
      setActiveFieldIds((prev) => [...prev, selectedFieldToAdd]);
      toast.success('Pasta de documentos adicionada para este contato');
    }
    setSelectedFieldToAdd('');
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <FileImage className="size-4 text-emerald-400" />;
    if (mime.includes('pdf')) return <FileText className="size-4 text-rose-500" />;
    if (mime.includes('word') || mime.includes('msword')) return <FileText className="size-4 text-blue-500" />;
    if (mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('csv'))
      return <FileSpreadsheet className="size-4 text-green-500" />;
    return <File className="size-4 text-zinc-400" />;
  };

  const renderFilePreview = (doc: ContactDocument) => {
    const isImage = doc.mime_type?.startsWith('image/');

    if (isImage && imagePreviews[doc.id]) {
      return (
        <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-muted border border-border/40">
          <img
            src={imagePreviews[doc.id]}
            alt={doc.file_name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      );
    }

    let icon = <File className="size-5 text-zinc-400" />;
    let bgClass = "bg-zinc-500/10";

    if (isImage) {
      icon = <FileImage className="size-5 text-emerald-400" />;
      bgClass = "bg-emerald-500/10";
    } else if (doc.mime_type?.includes('pdf')) {
      icon = <FileText className="size-5 text-rose-500" />;
      bgClass = "bg-rose-500/10";
    } else if (doc.mime_type?.includes('word') || doc.mime_type?.includes('msword')) {
      icon = <FileText className="size-5 text-blue-500" />;
      bgClass = "bg-blue-500/10";
    } else if (doc.mime_type?.includes('excel') || doc.mime_type?.includes('spreadsheet') || doc.mime_type?.includes('csv')) {
      icon = <FileSpreadsheet className="size-5 text-green-500" />;
      bgClass = "bg-green-500/10";
    }

    return (
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/20 ${bgClass}`}>
        {icon}
      </div>
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, fieldId: string | null) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Size Check: 50MB
    if (file.size > 52428800) {
      toast.error('O arquivo excede o limite de 50MB');
      return;
    }

    // Amount Check: Max 20 files per folder
    const currentDocsCount = documents.filter((d) => d.document_field_id === fieldId).length;
    if (currentDocsCount >= 20) {
      toast.error('Limite máximo de 20 arquivos por pasta atingido');
      return;
    }

    if (fieldId) {
      setUploadingFieldId(fieldId);
    } else {
      setIsUploadingGeneral(true);
    }

    try {
      const uniqueId = crypto.randomUUID();
      const storagePath = `account-${accountId}/${contactId}/${uniqueId}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('contact_documents').insert({
        account_id: accountId,
        contact_id: contactId,
        document_field_id: fieldId,
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
      });

      if (dbError) throw dbError;

      toast.success('Documento enviado com sucesso');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao enviar documento');
    } finally {
      setUploadingFieldId(null);
      setIsUploadingGeneral(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleDownload = async (doc: ContactDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar link de download');
    }
  };

  const handleDelete = async (doc: ContactDocument) => {
    const confirm = window.confirm(`Deseja realmente excluir o documento "${doc.file_name}"?`);
    if (!confirm) return;

    try {
      // 1. Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);

      if (storageError) {
        console.warn('Erro ao remover do storage (pode já ter sido removido):', storageError);
      }

      // 2. Delete from DB
      const { error: dbError } = await supabase
        .from('contact_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast.success('Documento excluído');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir documento');
    }
  };

  const handleStartRename = (doc: ContactDocument) => {
    setEditingDocId(doc.id);
    // Strip extension for cleaner editing
    const parts = doc.file_name.split('.');
    if (parts.length > 1) {
      parts.pop();
    }
    const base = parts.join('.');
    setEditNameValue(base);
  };

  const handleSaveRename = async (doc: ContactDocument) => {
    if (!editNameValue.trim()) return;
    setSavingDocId(doc.id);

    try {
      const parts = doc.file_name.split('.');
      const ext = parts.pop() || '';
      const finalName = `${editNameValue.trim()}.${ext}`;

      const { error } = await supabase
        .from('contact_documents')
        .update({ file_name: finalName })
        .eq('id', doc.id);

      if (error) throw error;

      toast.success('Documento renomeado');
      setEditingDocId(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao renomear documento');
    } finally {
      setSavingDocId(null);
    }
  };

  const handleMagicRename = async (doc: ContactDocument, fieldName: string) => {
    setSavingDocId(doc.id);
    try {
      // Filter documents of same field type, sort by created_at ascending
      const sameFieldDocs = documents
        .filter((d) => d.document_field_id === doc.document_field_id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const index = sameFieldDocs.findIndex((d) => d.id === doc.id);
      const order = String(index !== -1 ? index + 1 : 1).padStart(2, '0');

      // Date in BR format (DD-MM-YYYY)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateStr = `${day}-${month}-${year}`;

      // Clean field name for use in file name
      const cleanFieldName = fieldName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-zA-Z0-9\s-_]/g, '') // remove special chars
        .replace(/\s+/g, '_'); // replace spaces with underscore

      const parts = doc.file_name.split('.');
      const ext = parts.pop() || '';

      const finalName = `${cleanFieldName}_${order}_${dateStr}.${ext}`;

      const { error } = await supabase
        .from('contact_documents')
        .update({ file_name: finalName })
        .eq('id', doc.id);

      if (error) throw error;

      toast.success(`Renomeado para: ${finalName}`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Erro na renomeação automática');
    } finally {
      setSavingDocId(null);
    }
  };

  // Dropdown list: fields not already in activeFieldIds
  const availableFieldsToAdd = fields.filter((f) => !activeFieldIds.includes(f.id));

  return (
    <div className="flex flex-col h-[500px] min-h-0">
      {/* Action Header */}
      <div className="flex items-center justify-between gap-3 mb-4 px-1">
        <span className="text-xs text-muted-foreground">
          Gerencie os documentos anexados a este caso.
        </span>

        {availableFieldsToAdd.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedFieldToAdd} onValueChange={(val) => setSelectedFieldToAdd(val ?? '')}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-muted border-border">
                {selectedFieldToAdd ? (
                  <span className="flex flex-1 text-left truncate">
                    {fields.find((f) => f.id === selectedFieldToAdd)?.name}
                  </span>
                ) : (
                  <span className="flex flex-1 text-left truncate text-muted-foreground">
                    Selecione uma pasta...
                  </span>
                )}
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground z-[100]" alignItemWithTrigger={false} sideOffset={4}>
                {availableFieldsToAdd.map((f) => (
                  <SelectItem key={f.id} value={f.id} className="text-xs">
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddCategorySlot}
              disabled={!selectedFieldToAdd}
              className="h-8 text-xs border-border bg-muted hover:bg-muted/80 gap-1"
            >
              <Plus className="size-3" /> Adicionar Pasta
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 pr-2">
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Slots */}
                {activeFieldIds.map((fieldId) => {
                  const field = fields.find((f) => f.id === fieldId);
                  if (!field) return null;

                  const categoryDocs = documents.filter((d) => d.document_field_id === fieldId);
                  const isUploading = uploadingFieldId === fieldId;

                  return (
                    <div key={fieldId} className="border border-border/40 rounded-xl bg-muted/10 p-4 flex flex-col justify-between min-h-[220px] hover:border-border/80 transition-all duration-200">
                      <div className="space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Category Header */}
                          <div className="flex items-center justify-between gap-2 border-b border-border/20 pb-2 mb-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-xs text-foreground truncate" title={field.name}>{field.name}</span>
                              {field.is_default && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary bg-primary/5 shrink-0">
                                  Padrão
                                </Badge>
                              )}
                            </div>

                            {/* Small inline upload trigger */}
                            <label className="cursor-pointer shrink-0">
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => handleUpload(e, fieldId)}
                                disabled={isUploading}
                              />
                              <span className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium">
                                {isUploading ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <UploadCloud className="size-3" />
                                )}
                                Enviar
                              </span>
                            </label>
                          </div>

                          {/* Files List */}
                          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                            {categoryDocs.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground/80 italic bg-muted/20 border border-dashed border-border/40 rounded-lg py-5 text-center px-2">
                                Nenhum documento anexado.
                              </div>
                            ) : (
                              categoryDocs.map((doc) => {
                                const isEditing = editingDocId === doc.id;
                                const isSaving = savingDocId === doc.id;

                                return (
                                  <div
                                    key={doc.id}
                                    className="flex items-center justify-between gap-2.5 bg-muted/30 border border-border/30 hover:border-border/60 hover:bg-muted/50 rounded-lg p-2 transition-all group"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {renderFilePreview(doc)}
                                      <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                          <div className="flex items-center gap-1">
                                            <Input
                                              value={editNameValue}
                                              onChange={(e) => setEditNameValue(e.target.value)}
                                              className="h-7 text-xs bg-popover border-border text-foreground py-0 w-full"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveRename(doc);
                                                if (e.key === 'Escape') setEditingDocId(null);
                                              }}
                                            />
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => handleSaveRename(doc)}
                                              disabled={isSaving}
                                              className="size-7 shrink-0 text-emerald-400 hover:text-emerald-300"
                                            >
                                              {isSaving ? (
                                                <Loader2 className="size-3 animate-spin" />
                                              ) : (
                                                <Check className="size-3.5" />
                                              )}
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col min-w-0">
                                            <span
                                              className="text-[11px] text-foreground font-semibold truncate cursor-pointer hover:underline"
                                              onClick={() => handleStartRename(doc)}
                                              title="Clique para renomear"
                                            >
                                              {doc.file_name}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground">
                                              {formatBytes(doc.file_size)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        title="Renomear Inteligente"
                                        onClick={() => handleMagicRename(doc, field.name)}
                                        disabled={isSaving}
                                        className="size-6 text-primary/80 hover:text-primary hover:bg-primary/10"
                                      >
                                        <Wand2 className="size-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        title="Baixar"
                                        onClick={() => handleDownload(doc)}
                                        className="size-6 text-muted-foreground hover:text-foreground"
                                      >
                                        <Download className="size-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        title="Excluir"
                                        onClick={() => handleDelete(doc)}
                                        className="size-6 text-muted-foreground hover:text-red-400"
                                      >
                                        <Trash2 className="size-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* General Documents Section (Gerais) */}
                {(() => {
                  const isUploading = isUploadingGeneral;
                  const generalDocs = documents.filter((d) => d.document_field_id === null);

                  return (
                    <div className="border border-border/40 rounded-xl bg-muted/10 p-4 flex flex-col justify-between min-h-[220px] hover:border-border/80 transition-all duration-200">
                      <div className="space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Header */}
                          <div className="flex items-center justify-between gap-2 border-b border-border/20 pb-2 mb-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FolderOpen className="size-4 text-primary shrink-0" />
                              <span className="font-semibold text-xs text-foreground truncate">Docs Gerais</span>
                            </div>

                            <label className="cursor-pointer shrink-0">
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => handleUpload(e, null)}
                                disabled={isUploading}
                              />
                              <span className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium">
                                {isUploading ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <UploadCloud className="size-3" />
                                )}
                                Enviar
                              </span>
                            </label>
                          </div>

                          {/* Files List */}
                          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                            {generalDocs.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground/80 italic bg-muted/20 border border-dashed border-border/40 rounded-lg py-5 text-center px-2">
                                Nenhum documento geral.
                              </div>
                            ) : (
                              generalDocs.map((doc) => {
                                const isEditing = editingDocId === doc.id;
                                const isSaving = savingDocId === doc.id;

                                return (
                                  <div
                                    key={doc.id}
                                    className="flex items-center justify-between gap-2.5 bg-muted/30 border border-border/30 hover:border-border/60 hover:bg-muted/50 rounded-lg p-2 transition-all group"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {renderFilePreview(doc)}
                                      <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                          <div className="flex items-center gap-1">
                                            <Input
                                              value={editNameValue}
                                              onChange={(e) => setEditNameValue(e.target.value)}
                                              className="h-7 text-xs bg-popover border-border text-foreground py-0 w-full"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveRename(doc);
                                                if (e.key === 'Escape') setEditingDocId(null);
                                              }}
                                            />
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => handleSaveRename(doc)}
                                              disabled={isSaving}
                                              className="size-7 shrink-0 text-emerald-400 hover:text-emerald-300"
                                            >
                                              {isSaving ? (
                                                <Loader2 className="size-3 animate-spin" />
                                              ) : (
                                                <Check className="size-3.5" />
                                              )}
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col min-w-0">
                                            <span
                                              className="text-[11px] text-foreground font-semibold truncate cursor-pointer hover:underline"
                                              onClick={() => handleStartRename(doc)}
                                              title="Clique para renomear"
                                            >
                                              {doc.file_name}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground">
                                              {formatBytes(doc.file_size)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        title="Renomear Inteligente"
                                        onClick={() => handleMagicRename(doc, 'Geral')}
                                        disabled={isSaving}
                                        className="size-6 text-primary/80 hover:text-primary hover:bg-primary/10"
                                      >
                                        <Wand2 className="size-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        title="Baixar"
                                        onClick={() => handleDownload(doc)}
                                        className="size-6 text-muted-foreground hover:text-foreground"
                                      >
                                        <Download className="size-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        title="Excluir"
                                        onClick={() => handleDelete(doc)}
                                        className="size-6 text-muted-foreground hover:text-red-400"
                                      >
                                        <Trash2 className="size-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
