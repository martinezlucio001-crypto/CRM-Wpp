"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/lib/currency";
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineStage,
  Profile,
} from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentsTab } from "@/components/contacts/documents-tab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DealBillingDetails } from "@/components/billing/deal-billing-details";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  type ExistingContact,
} from "@/lib/contacts/dedupe";
import { PhoneInput } from "@/components/ui/phone-input";

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const [billingType, setBillingType] = useState<'fixed' | 'success' | 'mixed'>('fixed');
  const [billingFixedValue, setBillingFixedValue] = useState("");
  const [billingPercentageValue, setBillingPercentageValue] = useState("");

  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>('pending');
  const [contractStatus, setContractStatus] = useState<'not_sent' | 'sent' | 'signed'>('not_sent');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [contactMode, setContactMode] = useState<'existing' | 'new'>('existing');
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("+55");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactCompany, setNewContactCompany] = useState("");
  const [dupMatch, setDupMatch] = useState<{ contact: ExistingContact; exact: boolean } | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);

  async function checkDuplicatePhone() {
    if (deal || !accountId) return;
    const value = newContactPhone.trim();
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

  // Reset the form fields every time the sheet opens or its input
  // props change. This is a legitimate prop-driven sync; the rule is
  // over-cautious here, hence the block-level disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (deal) {
      setTitle(deal.title);
      setValue(String(deal.value ?? ""));
      setCurrency(deal.currency || defaultCurrency || "BRL");
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
      setBillingType((deal as any).billing_type || 'fixed');
      setBillingFixedValue((deal as any).billing_fixed_value ? String((deal as any).billing_fixed_value) : '');
      setBillingPercentageValue((deal as any).billing_percentage_value ? String((deal as any).billing_percentage_value) : '');
      setPaymentStatus(deal.payment_status || 'pending');
      setContractStatus(deal.contract_status || 'not_sent');
    } else {
      setTitle("");
      setValue("");
      setCurrency(defaultCurrency || "BRL");
      setContactId("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setAssignedTo("");
      setExpectedCloseDate(new Date().toISOString().split('T')[0]);
      setNotes("");
      setBillingType('fixed');
      setBillingFixedValue('');
      setBillingPercentageValue('');
      setPaymentStatus('pending');
      setContractStatus('not_sent');
      setContactMode('existing');
      setNewContactName("");
      setNewContactPhone("+55");
      setNewContactEmail("");
      setNewContactCompany("");
      setDupMatch(null);
    }
  }, [open, deal, defaultStageId, stages, defaultCurrency]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Fetch linked conversation for the selected contact (newest open one).
  // Clearing on no-selection is sync with prop state; the populated
  // case runs setLinkedConversation inside the async fetch callback.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLinkedConversation((data as Conversation | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  async function handleSave() {
    if (!title.trim() || !stageId) {
      toast.error("Título e estágio são obrigatórios");
      return;
    }

    if (!deal) {
      if (contactMode === "existing") {
        if (!contactId) {
          toast.error("O contato é obrigatório");
          return;
        }
      } else {
        if (!newContactPhone.trim()) {
          toast.error("O número de telefone é obrigatório");
          return;
        }
        if (dupMatch?.exact) {
          toast.error("Já existe um contato com este número de telefone");
          return;
        }
      }
    } else {
      if (!contactId) {
        toast.error("O contato é obrigatório");
        return;
      }
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error("Não autenticado");
        setSaving(false);
        return;
      }
      if (!accountId) {
        toast.error("Seu perfil não está vinculado a uma conta.");
        setSaving(false);
        return;
      }

      let activeContactId = contactId;

      if (!deal && contactMode === "new") {
        const { data: newContact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            user_id: user.id,
            account_id: accountId,
            name: newContactName.trim() || null,
            phone: newContactPhone.trim(),
            email: newContactEmail.trim() || null,
            company: newContactCompany.trim() || null,
          })
          .select("id")
          .single();

        if (contactError) {
          if (isUniqueViolation(contactError)) {
            toast.error("Já existe um contato com este número de telefone");
          } else {
            toast.error("Falha ao criar o contato");
          }
          setSaving(false);
          return;
        }
        activeContactId = newContact.id;
      }

      const calculatedValue = billingType === 'success' ? (parseFloat(value) || 0) : (parseFloat(billingFixedValue) || 0);

      const payload = {
        title: title.trim(),
        value: calculatedValue,
        currency,
        contact_id: activeContactId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        assigned_to: assignedTo || null,
        notes: notes.trim() || null,
        expected_close_date: expectedCloseDate || null,
        billing_type: billingType,
        billing_fixed_value: billingType === 'success' ? null : (parseFloat(billingFixedValue) || 0),
        billing_percentage_value: billingType === 'fixed' ? null : (parseFloat(billingPercentageValue) || 0),
        payment_status: paymentStatus,
        contract_status: contractStatus,
      };

      if (deal) {
        const { error } = await supabase
          .from("deals")
          .update(payload)
          .eq("id", deal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("deals")
          .insert({ ...payload, user_id: user.id, account_id: accountId, status: "open" });
        if (error) throw error;
      }

      setSaving(false);
      toast.success(deal ? "Processo atualizado" : "Processo criado");
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      if (isUniqueViolation(error)) {
        toast.error("Já existe um contato com este número de telefone");
      } else {
        toast.error(deal ? "Falha ao salvar processo" : "Falha ao criar processo");
      }
      setSaving(false);
    }
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    setStatusAction(status);
    const { error } = await supabase
      .from("deals")
      .update({ status })
      .eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error("Falha ao atualizar o status do processo");
      return;
    }
    toast.success(
      status === "won" ? "Marcado como ganho" : status === "lost" ? "Marcado como perdido" : "Processo reaberto",
    );
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error("Falha ao excluir processo");
      return;
    }
    toast.success("Processo excluído");
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-popover border-border text-popover-foreground sm:max-w-[864px] w-[95vw] p-0 overflow-hidden h-[90vh] max-h-[720px] flex flex-col"
      >
        <div className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="border-b border-border/50 p-4 shrink-0">
            <DialogTitle className="text-popover-foreground text-lg font-bold">
              {deal ? "Editar Processo" : "Novo Processo"}
            </DialogTitle>
          </DialogHeader>

          {deal ? (
            <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden min-h-0">
              <TabsList variant="line" className="w-full justify-start gap-6 border-b border-border/60 bg-transparent rounded-none h-11 px-4 shrink-0 p-0">
                <TabsTrigger
                  value="details"
                  className="px-1 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground bg-transparent data-active:text-primary data-active:bg-transparent rounded-none h-full border-b-2 border-transparent data-active:border-primary"
                >
                  Dados do Processo
                </TabsTrigger>
                <TabsTrigger
                  value="billing"
                  className="px-1 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground bg-transparent data-active:text-primary data-active:bg-transparent rounded-none h-full border-b-2 border-transparent data-active:border-primary"
                >
                  Financeiro & Parcelas
                </TabsTrigger>
                {contactId && (
                  <TabsTrigger
                    value="documents"
                    className="px-1 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground bg-transparent data-active:text-primary data-active:bg-transparent rounded-none h-full border-b-2 border-transparent data-active:border-primary"
                  >
                    Documentos
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="details" className="flex-1 flex flex-col overflow-hidden focus-visible:outline-none min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Título</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Título do processo"
                      className="border-border bg-muted text-foreground"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Contato</Label>
                    <select
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Selecionar um contato</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.phone}
                        </option>
                      ))}
                    </select>

                    {linkedConversation && (
                      <Link
                        href="/inbox"
                        className="mt-1 inline-flex items-center gap-1.5 self-start rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Ver conversa
                      </Link>
                    )}
                  </div>

                  {/* Formato de Cobrança */}
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Formato de Cobrança</Label>
                    <select
                      value={billingType}
                      onChange={(e) => setBillingType(e.target.value as any)}
                      className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="fixed">Fixo</option>
                      <option value="success">Por Êxito</option>
                      <option value="mixed">Misto</option>
                    </select>
                  </div>

                  {/* Inputs Dinâmicos Baseados no Formato de Cobrança */}
                  <div className="grid grid-cols-2 gap-3">
                    {(billingType === "fixed" || billingType === "mixed") && (
                      <div className="grid gap-2">
                        <Label className="text-muted-foreground">Valor Fixo</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">R$</span>
                          <Input
                            type="number"
                            value={billingFixedValue}
                            onChange={(e) => setBillingFixedValue(e.target.value)}
                            placeholder="0"
                            className="border-border bg-muted pl-8 text-foreground"
                          />
                        </div>
                      </div>
                    )}

                    {(billingType === "success" || billingType === "mixed") && (
                      <div className="grid gap-2">
                        <Label className="text-muted-foreground">Porcentagem Êxito (%)</Label>
                        <Input
                          type="number"
                          value={billingPercentageValue}
                          onChange={(e) => setBillingPercentageValue(e.target.value)}
                          placeholder="20"
                          className="border-border bg-muted text-foreground"
                        />
                      </div>
                    )}

                    {billingType === "success" && (
                      <div className="grid gap-2 col-span-2">
                        <Label className="text-muted-foreground">Valor Estimado do Processo (Opcional)</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">R$</span>
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="0"
                            className="border-border bg-muted pl-8 text-foreground"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Data de Criação do Processo</Label>
                    <Input
                      type="date"
                      value={expectedCloseDate}
                      onChange={(e) => setExpectedCloseDate(e.target.value)}
                      className="border-border bg-muted text-foreground"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Estágio</Label>
                    <select
                      value={stageId}
                      onChange={(e) => setStageId(e.target.value)}
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
                    <Label className="text-muted-foreground">Responsável</Label>
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground">Status do Pagamento</Label>
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value as any)}
                        className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      >
                        <option value="pending">Pendente</option>
                        <option value="paid">Realizado</option>
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-muted-foreground">Status do Contrato</Label>
                      <select
                        value={contractStatus}
                        onChange={(e) => setContractStatus(e.target.value as any)}
                        className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      >
                        <option value="not_sent">Não enviado</option>
                        <option value="sent">Enviado</option>
                        <option value="signed">Assinado</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Resumo</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Adicionar resumo..."
                      className="min-h-[100px] border-border bg-muted text-foreground"
                    />
                  </div>

                  {deal && (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => handleStatusChange("won")}
                          disabled={!!statusAction || deal.status === "won"}
                          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {statusAction === "won" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-1 h-4 w-4" />
                              Marcar como Ganho
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleStatusChange("lost")}
                          disabled={!!statusAction || deal.status === "lost"}
                          className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {statusAction === "lost" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <X className="mr-1 h-4 w-4" />
                              Marcar como Perdido
                            </>
                          )}
                        </Button>
                      </div>
                      {deal.status && deal.status !== "open" && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleStatusChange("open")}
                          disabled={!!statusAction}
                          className="w-full text-muted-foreground hover:text-foreground"
                        >
                          Reabrir processo
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-border/50 bg-popover/80 p-4 shrink-0">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-muted"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving || !title.trim() || !contactId || !stageId}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {saving ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>

                  {confirmDelete ? (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                      <span className="text-red-300">Excluir este processo?</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          disabled={deleting}
                          className="rounded px-2 py-1 text-muted-foreground hover:bg-muted"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleting ? "Excluindo..." : "Confirmar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                      Excluir Processo
                    </button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="billing" className="flex-1 overflow-y-auto p-4 focus-visible:outline-none min-h-0 animate-in fade-in duration-100">
                {(() => {
                  const currentContact = contacts.find((c) => c.id === contactId);
                  if (!currentContact) {
                    return (
                      <div className="flex justify-center py-8 text-muted-foreground text-xs">
                        Carregando dados do contato...
                      </div>
                    );
                  }
                  return (
                    <DealBillingDetails
                      dealId={deal.id}
                      contact={currentContact}
                      dealTitle={title}
                      dealValue={parseFloat(value) || 0}
                      dealBillingFixedValue={parseFloat(billingFixedValue) || 0}
                      dealBillingType={billingType}
                      onUpdated={onSaved}
                    />
                  );
                })()}
              </TabsContent>
              {contactId && accountId && (
                <TabsContent value="documents" className="flex-1 overflow-y-auto px-6 py-4 flex flex-col min-h-0 focus-visible:outline-none animate-in fade-in duration-100">
                  <DocumentsTab contactId={contactId} accountId={accountId} />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título do processo"
                    className="border-border bg-muted text-foreground"
                  />
                </div>

                <div className="space-y-3 border border-border bg-muted/20 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Contato</Label>
                    <Tabs value={contactMode} onValueChange={(v) => setContactMode(v as any)} className="w-auto">
                      <TabsList variant="line" className="h-7 p-0 bg-transparent gap-2 border-b-0">
                        <TabsTrigger
                          value="existing"
                          className="px-2 text-xs font-semibold py-1 text-muted-foreground data-active:text-primary border-b border-transparent data-active:border-primary rounded-none h-full bg-transparent"
                        >
                          Existente
                        </TabsTrigger>
                        <TabsTrigger
                          value="new"
                          className="px-2 text-xs font-semibold py-1 text-muted-foreground data-active:text-primary border-b border-transparent data-active:border-primary rounded-none h-full bg-transparent"
                        >
                          Novo Contato
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {contactMode === "existing" ? (
                    <div className="grid gap-2 pt-1">
                      <select
                        value={contactId}
                        onChange={(e) => setContactId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Selecionar um contato</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.phone}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">Nome</Label>
                        <Input
                          value={newContactName}
                          onChange={(e) => setNewContactName(e.target.value)}
                          placeholder="João Silva"
                          className="h-8 border-border bg-muted text-foreground text-sm"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">
                          Telefone <span className="text-red-400">*</span>
                        </Label>
                        <PhoneInput
                          value={newContactPhone}
                          onChange={(val) => {
                            setNewContactPhone(val);
                            if (dupMatch) setDupMatch(null);
                          }}
                          onBlur={checkDuplicatePhone}
                          className="h-8 border-border bg-muted text-foreground text-sm"
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
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/80">
                            Selecione o código de país (DDI) e digite o número
                          </p>
                        )}
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">E-mail</Label>
                        <Input
                          type="email"
                          value={newContactEmail}
                          onChange={(e) => setNewContactEmail(e.target.value)}
                          placeholder="joao@exemplo.com"
                          className="h-8 border-border bg-muted text-foreground text-sm"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">Empresa</Label>
                        <Input
                          value={newContactCompany}
                          onChange={(e) => setNewContactCompany(e.target.value)}
                          placeholder="Minha Empresa Ltda."
                          className="h-8 border-border bg-muted text-foreground text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Formato de Cobrança */}
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Formato de Cobrança</Label>
                  <select
                    value={billingType}
                    onChange={(e) => setBillingType(e.target.value as any)}
                    className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="fixed">Fixo</option>
                    <option value="success">Por Êxito</option>
                    <option value="mixed">Misto</option>
                  </select>
                </div>

                {/* Inputs Dinâmicos Baseados no Formato de Cobrança */}
                <div className="grid grid-cols-2 gap-3">
                  {(billingType === "fixed" || billingType === "mixed") && (
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground">Valor Fixo</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">R$</span>
                        <Input
                          type="number"
                          value={billingFixedValue}
                          onChange={(e) => setBillingFixedValue(e.target.value)}
                          placeholder="0"
                          className="border-border bg-muted pl-8 text-foreground"
                        />
                      </div>
                    </div>
                  )}

                  {(billingType === "success" || billingType === "mixed") && (
                    <div className="grid gap-2">
                      <Label className="text-muted-foreground">Porcentagem Êxito (%)</Label>
                      <Input
                        type="number"
                        value={billingPercentageValue}
                        onChange={(e) => setBillingPercentageValue(e.target.value)}
                        placeholder="20"
                        className="border-border bg-muted text-foreground"
                      />
                    </div>
                  )}

                  {billingType === "success" && (
                    <div className="grid gap-2 col-span-2">
                      <Label className="text-muted-foreground">Valor Estimado do Processo (Opcional)</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">R$</span>
                        <Input
                          type="number"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder="0"
                          className="border-border bg-muted pl-8 text-foreground"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Data de Criação do Processo</Label>
                  <Input
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    className="border-border bg-muted text-foreground"
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Estágio</Label>
                  <select
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
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
                  <Label className="text-muted-foreground">Responsável</Label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Status do Pagamento</Label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as any)}
                      className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="pending">Pendente</option>
                      <option value="paid">Realizado</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Status do Contrato</Label>
                    <select
                      value={contractStatus}
                      onChange={(e) => setContractStatus(e.target.value as any)}
                      className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="not_sent">Não enviado</option>
                      <option value="sent">Enviado</option>
                      <option value="signed">Assinado</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Resumo</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Adicionar resumo..."
                    className="min-h-[100px] border-border bg-muted text-foreground"
                  />
                </div>
              </div>

              <div className="border-t border-border/50 bg-popover/80 p-4 shrink-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-muted"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={
                      saving ||
                      checkingDup ||
                      !title.trim() ||
                      !stageId ||
                      (contactMode === "existing"
                        ? !contactId
                        : !newContactPhone.trim() || !!dupMatch?.exact)
                    }
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {saving ? "Salvando..." : "Criar Processo"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
