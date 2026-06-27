'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, Profile, PipelineStage } from '@/types';
import {
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  type ExistingContact,
} from '@/lib/contacts/dedupe';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CURRENCIES } from '@/lib/currency';
import { Loader2, AlertTriangle, Plus } from 'lucide-react';
import { PhoneInput } from '@/components/ui/phone-input';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: ContactTag[];
  onSaved: () => void;
  /** Open an existing contact's detail view — used by the duplicate
   *  notice to jump to the contact that already owns this number. */
  onViewExisting?: (contactId: string) => void;
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  contactTags = [],
  onSaved,
  onViewExisting,
}: ContactFormProps) {
  const supabase = createClient();
  const { accountId } = useAuth();
  const isEdit = !!contact;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [saving, setSaving] = useState(false);

  // Duplicate-phone detection for NEW contacts. `exact` (same digits)
  // hard-blocks the save; a fuzzy trunk-variant match only warns. The
  // DB unique index (migration 022) is the real backstop — this is the
  // friendly heads-up before we get there.
  const [dupMatch, setDupMatch] = useState<
    { contact: ExistingContact; exact: boolean } | null
  >(null);
  const [checkingDup, setCheckingDup] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Process creation states inside contact form
  const showProcessFields = !isEdit;
  const [activePipelineId, setActivePipelineId] = useState("");
  const [processTitle, setProcessTitle] = useState("");
  const [processValue, setProcessValue] = useState("");
  const [processCurrency, setProcessCurrency] = useState("BRL");
  const [processBillingType, setProcessBillingType] = useState<'fixed' | 'success' | 'mixed'>('fixed');
  const [processBillingFixedValue, setProcessBillingFixedValue] = useState("");
  const [processBillingPercentageValue, setProcessBillingPercentageValue] = useState("");
  const [processExpectedCloseDate, setExpectedCloseDate] = useState("");
  const [processStageId, setProcessStageId] = useState("");
  const [processAssignedTo, setProcessAssignedTo] = useState("");
  const [processNotes, setProcessNotes] = useState("");

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '+55');
      setEmail(contact?.email ?? '');
      setCompany(contact?.company ?? '');
      setSelectedTagIds(contactTags.map((ct) => ct.tag_id));
      setDupMatch(null);
      fetchTags();

      // Fetch profiles
      supabase.from('profiles').select('*').order('full_name').then(({ data }) => {
        if (data) setProfiles(data as Profile[]);
      });

      // Fetch active pipeline + stages
      supabase.from('pipelines').select('*').order('created_at').limit(1).maybeSingle().then(({ data: pipeline }) => {
        if (pipeline) {
          setActivePipelineId(pipeline.id);
          supabase.from('pipeline_stages').select('*').eq('pipeline_id', pipeline.id).order('position').then(({ data: stageData }) => {
            if (stageData) {
              setStages(stageData as PipelineStage[]);
              setProcessStageId(stageData[0]?.id || "");
            }
          });
        }
      });

      setExpectedCloseDate(new Date().toISOString().split('T')[0]);
      setProcessTitle("");
      setProcessValue("");
      setProcessCurrency("BRL");
      setProcessBillingType("fixed");
      setProcessBillingFixedValue("");
      setProcessBillingPercentageValue("");
      setProcessAssignedTo("");
      setProcessNotes("");
    }
  }, [open, contact]);

  // Look up an existing contact with this number (new contacts only).
  // Runs on blur so we don't query on every keystroke.
  async function checkDuplicate() {
    if (isEdit || !accountId) return;
    const value = phone.trim();
    const digits = value.replace(/\D/g, "");
    if (!value || digits.length <= 4) {
      setDupMatch(null);
      return;
    }
    setCheckingDup(true);
    try {
      const existing = await findExistingContact(supabase, accountId, value);
      setDupMatch(
        existing
          ? { contact: existing, exact: isExactMatch(existing, value) }
          : null,
      );
    } catch (err) {
      console.error("Erro ao verificar duplicidade de telefone:", err);
      setDupMatch(null);
    } finally {
      setCheckingDup(false);
    }
  }

  async function fetchTags() {
    setLoadingTags(true);
    const { data } = await supabase
      .from('tags')
      .select('*')
      .order('name');
    if (data) setTags(data);
    setLoadingTags(false);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error('O número de telefone é obrigatório');
      return;
    }

    // Hard-block an exact duplicate on create (the DB unique index is
    // the real backstop; this avoids a round-trip + a raw error toast).
    if (!isEdit && dupMatch?.exact) {
      toast.error('Já existe um contato com este número de telefone');
      return;
    }

    if (!isEdit) {
      if (!processTitle.trim()) {
        toast.error('O título do processo é obrigatório');
        return;
      }
      if (!processStageId) {
        toast.error('O estágio do processo é obrigatório');
        return;
      }
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Não autenticado');
      if (!accountId) throw new Error('Seu perfil não está vinculado a uma conta.');

      let contactId = contact?.id;

      if (isEdit && contactId) {
        const { error } = await supabase
          .from('contacts')
          .update({
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            account_id: accountId,
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        contactId = data.id;
      }

      // Sync tags
      if (contactId) {
        await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', contactId);

        if (selectedTagIds.length > 0) {
          const tagRows = selectedTagIds.map((tag_id) => ({
            contact_id: contactId!,
            tag_id,
          }));
          const { error: tagError } = await supabase
            .from('contact_tags')
            .insert(tagRows);
          if (tagError) throw tagError;
        }

        // Create deal/process if requested
        if (!isEdit && showProcessFields) {
          if (!processTitle.trim()) {
            throw new Error("O título do processo é obrigatório");
          }
          const calculatedValue = processBillingType === 'success' ? (parseFloat(processValue) || 0) : (parseFloat(processBillingFixedValue) || 0);
          const { error: dealError } = await supabase
            .from("deals")
            .insert({
              title: processTitle.trim(),
              value: calculatedValue,
              currency: processCurrency,
              contact_id: contactId,
              pipeline_id: activePipelineId,
              stage_id: processStageId,
              assigned_to: processAssignedTo || null,
              notes: processNotes.trim() || null,
              expected_close_date: processExpectedCloseDate || null,
              billing_type: processBillingType,
              billing_fixed_value: processBillingType === 'success' ? null : (parseFloat(processBillingFixedValue) || 0),
              billing_percentage_value: processBillingType === 'fixed' ? null : (parseFloat(processBillingPercentageValue) || 0),
              user_id: user.id,
              account_id: accountId,
              status: "open",
              payment_status: "pending",
              contract_status: "not_sent"
            });
          if (dealError) throw dealError;
        }
      }

      toast.success(isEdit ? 'Contato atualizado' : 'Contato criado');
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      // The unique index (migration 022) rejects a duplicate phone that
      // slipped past the on-blur check (race, or a format that
      // normalizes equal). Surface it as the friendly duplicate notice
      // and, for new contacts, point the user at the existing record.
      if (isUniqueViolation(err)) {
        toast.error('Já existe um contato com este número de telefone');
        if (!isEdit && accountId) {
          const existing = await findExistingContact(
            supabase,
            accountId,
            phone.trim(),
          );
          if (existing) setDupMatch({ contact: existing, exact: true });
        }
        return;
      }
      const message = err instanceof Error ? err.message : 'Falha ao salvar contato';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`bg-popover border-border text-popover-foreground transition-all duration-300 max-h-[90vh] overflow-y-auto w-[95vw] ${
        showProcessFields && !isEdit ? 'sm:max-w-4xl' : 'sm:max-w-lg'
      }`}>
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {isEdit ? 'Editar Contato' : 'Adicionar Contato'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            {isEdit
              ? 'Atualize os detalhes do contato abaixo.'
              : 'Preencha os detalhes para criar um novo contato.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={showProcessFields && !isEdit ? "grid grid-cols-1 md:grid-cols-2 gap-6 items-start" : "space-y-4"}>
            
            {/* Left Column: Contact Fields */}
            <div className="space-y-4">
              {showProcessFields && !isEdit && (
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2">Dados do Contato</h3>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="cf-name" className="text-muted-foreground text-xs font-semibold">
                  Nome
                </Label>
                <Input
                  id="cf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="João Silva"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cf-phone" className="text-muted-foreground text-xs font-semibold">
                  Telefone <span className="text-red-400">*</span>
                </Label>
                <PhoneInput
                  id="cf-phone"
                  value={phone}
                  onChange={(val) => {
                    setPhone(val);
                    if (dupMatch) setDupMatch(null);
                  }}
                  onBlur={checkDuplicate}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                {dupMatch ? (
                  <div
                    className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                      dupMatch.exact
                        ? 'border-red-500/40 bg-red-500/10 text-red-300'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <div className="space-y-1">
                      <p>
                        {dupMatch.exact
                          ? 'Já existe um contato com este número de telefone.'
                          : 'Já existe um contato com um número muito parecido.'}
                      </p>
                      {onViewExisting && (
                        <button
                          type="button"
                          onClick={() => onViewExisting(dupMatch.contact.id)}
                          className="font-medium underline underline-offset-2 hover:no-underline"
                        >
                          Visualizar {dupMatch.contact.name || dupMatch.contact.phone}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/80">
                    Selecione o código de país (DDI) e digite o número
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cf-email" className="text-muted-foreground text-xs font-semibold">
                  E-mail
                </Label>
                <Input
                  id="cf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao@exemplo.com"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cf-company" className="text-muted-foreground text-xs font-semibold">
                  Empresa
                </Label>
                <Input
                  id="cf-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Minha Empresa Ltda."
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-semibold">Tags</Label>
                {loadingTags ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="size-3 animate-spin" />
                    Carregando tags...
                  </div>
                ) : tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma tag disponível. Crie tags em Configurações.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => {
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                            selected
                              ? 'ring-2 ring-primary ring-offset-1 ring-offset-border'
                              : 'opacity-65 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: tag.color + '20',
                            color: tag.color,
                            borderColor: tag.color,
                          }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Process Fields */}
            {showProcessFields && !isEdit && (
              <div className="space-y-4 border-t md:border-t-0 md:border-l border-border md:pl-6 pt-6 md:pt-0">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2">Dados do Processo</h3>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground text-xs font-semibold">Título do Processo <span className="text-red-400">*</span></Label>
                  <Input
                    value={processTitle}
                    onChange={(e) => setProcessTitle(e.target.value)}
                    placeholder="Ex: Ação Trabalhista - João Silva"
                    className="bg-muted border-border text-foreground"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground text-xs font-semibold">Formato de Cobrança</Label>
                  <select
                    value={processBillingType}
                    onChange={(e) => setProcessBillingType(e.target.value as any)}
                    className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="fixed">Fixo</option>
                    <option value="success">Por Êxito</option>
                    <option value="mixed">Misto</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(processBillingType === "fixed" || processBillingType === "mixed") && (
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground text-xs font-semibold">Valor Fixo</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">R$</span>
                        <Input
                          type="number"
                          value={processBillingFixedValue}
                          onChange={(e) => setProcessBillingFixedValue(e.target.value)}
                          placeholder="0"
                          className="border-border bg-muted pl-8 text-foreground text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {(processBillingType === "success" || processBillingType === "mixed") && (
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground text-xs font-semibold">Porcentagem Êxito (%)</Label>
                      <Input
                        type="number"
                        value={processBillingPercentageValue}
                        onChange={(e) => setProcessBillingPercentageValue(e.target.value)}
                        placeholder="20"
                        className="border-border bg-muted text-foreground text-sm"
                      />
                    </div>
                  )}

                  {processBillingType === "success" && (
                    <div className="grid gap-2 col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold">Valor Estimado do Processo (Opcional)</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">R$</span>
                        <Input
                          type="number"
                          value={processValue}
                          onChange={(e) => setProcessValue(e.target.value)}
                          placeholder="0"
                          className="border-border bg-muted pl-8 text-foreground text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground text-xs font-semibold">Data de Criação do Processo</Label>
                  <Input
                    type="date"
                    value={processExpectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    className="border-border bg-muted text-foreground text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground text-xs font-semibold">Estágio</Label>
                  <select
                    value={processStageId}
                    onChange={(e) => setProcessStageId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground text-xs font-semibold">Responsável</Label>
                  <select
                    value={processAssignedTo}
                    onChange={(e) => setProcessAssignedTo(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="">Não atribuído</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground text-xs font-semibold">Resumo</Label>
                  <Textarea
                    value={processNotes}
                    onChange={(e) => setProcessNotes(e.target.value)}
                    placeholder="Descreva o processo..."
                    className="min-h-[80px] border-border bg-muted text-foreground text-sm"
                  />
                </div>
              </div>
            )}
          </div>



          <DialogFooter className="bg-popover border-t border-border/60 pt-4 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || checkingDup || (!isEdit && !!dupMatch?.exact)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {saving && <Loader2 className="size-4 animate-spin text-primary-foreground mr-2" />}
              {isEdit ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
