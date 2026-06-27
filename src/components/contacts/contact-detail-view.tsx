'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import type { Contact, Tag, Deal, Profile } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

import { DealBillingDetails } from '@/components/billing/deal-billing-details';
import {
  Phone,
  Mail,
  Building2,
  Copy,
  Check,
  Loader2,
  Save,
  DollarSign,
  ChevronRight,
  ChevronDown,
  FileSignature,
  Gavel,
} from 'lucide-react';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

export function ContactDetailView({
  open,
  onOpenChange,
  contactId,
  onUpdated,
}: ContactDetailViewProps) {
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Details tab (includes basic details + custom fields)
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);

  // Tags tab
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);


  // Deals tab (Processos)
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (data) {
      setContact(data);
      setEditName(data.name ?? '');
      setEditPhone(data.phone);
      setEditEmail(data.email ?? '');
      setEditCompany(data.company ?? '');
      setEditAssignedTo(data.assigned_to ?? '');
    }
    setLoading(false);
  }, [contactId, supabase]);

  const fetchTags = useCallback(async () => {
    if (!contactId) return;

    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);

    if (tagsRes.data) setAllTags(tagsRes.data);
    if (contactTagsRes.data) {
      setContactTagIds(contactTagsRes.data.map((ct) => ct.tag_id));
    }
  }, [contactId, supabase]);


  const fetchDeals = useCallback(async () => {
    if (!contactId) return;
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    if (data) {
      setProfiles(data as Profile[]);
    }
  }, [supabase]);

  useEffect(() => {
    if (open && contactId) {
      fetchContact();
      fetchTags();
      fetchDeals();
      fetchProfiles();
      setExpandedDealId(null);
    }
  }, [open, contactId, fetchContact, fetchTags, fetchDeals, fetchProfiles]);

  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function saveDetails() {
    if (!contactId || !editPhone.trim()) {
      toast.error('O número de telefone é obrigatório');
      return;
    }

    setSavingDetails(true);
    try {
      // 1. Update basic details
      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          name: editName.trim() || null,
          phone: editPhone.trim(),
          email: editEmail.trim() || null,
          company: editCompany.trim() || null,
          assigned_to: editAssignedTo || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);

      if (contactError) throw contactError;

      toast.success('Alterações salvas com sucesso');
      fetchContact();
      onUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao atualizar contato');
    } finally {
      setSavingDetails(false);
    }
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingTags(true);

    const isSelected = contactTagIds.includes(tagId);

    if (isSelected) {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);
      if (!error) {
        setContactTagIds((prev) => prev.filter((id) => id !== tagId));
        onUpdated();
      }
    } else {
      const { error } = await supabase
        .from('contact_tags')
        .insert({ contact_id: contactId, tag_id: tagId });
      if (!error) {
        setContactTagIds((prev) => [...prev, tagId]);
        onUpdated();
      }
    }
    setSavingTags(false);
  }

  function getInitials(name?: string | null) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-[864px] w-[95vw] p-0 overflow-hidden h-[90vh] max-h-[720px] flex flex-col">
        {loading || !contact ? (
          <div className="flex items-center justify-center h-full flex-1">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <DialogHeader className="p-5 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-4">
                <Avatar className="size-14 bg-muted border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <DialogTitle className="text-xl font-bold text-popover-foreground truncate">
                    {contact.name || 'Sem nome'}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                    Ficha cadastral do cliente
                  </DialogDescription>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <button
                      onClick={copyPhone}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
                    >
                      <Phone className="size-3.5" />
                      {contact.phone}
                      {copiedPhone ? (
                        <Check className="size-3.5 text-primary" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                    {contact.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3.5" />
                        {contact.email}
                      </span>
                    )}
                    {contact.company && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="size-3.5" />
                        {contact.company}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            {/* Tabs */}
            <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden min-h-0">
              <TabsList variant="line" className="w-full justify-start gap-6 border-b border-border/60 bg-transparent rounded-none h-11 px-6 shrink-0 p-0">
                <TabsTrigger
                  value="details"
                  className="px-1 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground bg-transparent data-active:text-primary data-active:bg-transparent rounded-none h-full border-b-2 border-transparent data-active:border-primary"
                >
                  Detalhes
                </TabsTrigger>
                <TabsTrigger
                  value="tags"
                  className="px-1 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground bg-transparent data-active:text-primary data-active:bg-transparent rounded-none h-full border-b-2 border-transparent data-active:border-primary"
                >
                  Tags
                </TabsTrigger>

                <TabsTrigger
                  value="deals"
                  className="px-1 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground bg-transparent data-active:text-primary data-active:bg-transparent rounded-none h-full border-b-2 border-transparent data-active:border-primary"
                >
                  Processos
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="flex-1 overflow-y-auto px-6 py-4 flex flex-col min-h-0 focus-visible:outline-none">
                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs font-semibold">Nome</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-muted border-border text-foreground h-9 text-sm"
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs font-semibold">
                        Telefone <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="bg-muted border-border text-foreground h-9 text-sm"
                        placeholder="+55..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs font-semibold">E-mail</Label>
                      <Input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="bg-muted border-border text-foreground h-9 text-sm"
                        placeholder="exemplo@email.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs font-semibold">Empresa</Label>
                      <Input
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        className="bg-muted border-border text-foreground h-9 text-sm"
                        placeholder="Nome da empresa"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-muted-foreground text-xs font-semibold">Responsável</Label>
                      <select
                        value={editAssignedTo}
                        onChange={(e) => setEditAssignedTo(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Não atribuído</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name || p.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>

                <div className="pt-4 border-t border-border mt-4 shrink-0">
                  <Button
                    onClick={saveDetails}
                    disabled={savingDetails}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground w-full h-10 font-medium"
                  >
                    {savingDetails ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <Save className="size-4 mr-2" />
                    )}
                    Salvar Alterações
                  </Button>
                </div>
              </TabsContent>

              {/* Tags Tab */}
              <TabsContent value="tags" className="flex-1 overflow-y-auto px-6 py-4 focus-visible:outline-none">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Clique em uma tag para adicioná-la ou removê-la deste contato.
                  </p>
                  {allTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma tag disponível. Crie tags em Configurações.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {allTags.map((tag) => {
                        const selected = contactTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            disabled={savingTags}
                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer border ${
                              selected
                                ? 'ring-1 ring-primary border-primary'
                                : 'opacity-65 hover:opacity-100 border-transparent'
                            }`}
                            style={{
                              backgroundColor: tag.color + '15',
                              color: tag.color,
                            }}
                          >
                            {selected && <Check className="size-3 mr-1.5 animate-in fade-in zoom-in-50" />}
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>



              {/* Deals Tab (Processos) */}
              <TabsContent value="deals" className="flex-1 overflow-y-auto px-6 py-4 focus-visible:outline-none">
                {loadingDeals ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                ) : deals.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum processo vinculado a este contato.</p>
                ) : (
                  <div className="space-y-3 pt-2">
                    {deals.map((deal) => {
                      const isExpanded = expandedDealId === deal.id;
                      return (
                        <div
                          key={deal.id}
                          className="rounded-lg border border-border bg-muted/20 hover:border-border/80 transition-colors overflow-hidden"
                        >
                          {/* Row Header */}
                          <div
                            onClick={() => setExpandedDealId(isExpanded ? null : deal.id)}
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/10 transition-colors select-none"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground shrink-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="size-4" />
                                ) : (
                                  <ChevronRight className="size-4" />
                                )}
                              </button>
                              <span className="text-sm font-semibold text-foreground truncate">
                                {deal.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-semibold text-foreground">
                                {formatCurrency(
                                  deal.value ?? 0,
                                  deal.currency || defaultCurrency,
                                )}
                              </span>
                              
                              {deal.stage && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                                  style={{
                                    backgroundColor: `${deal.stage.color}15`,
                                    color: deal.stage.color,
                                  }}
                                >
                                  {deal.stage.name}
                                </span>
                              )}

                              {/* Status Icons Row */}
                              <div className="flex items-center gap-1.5 ml-2">
                                {/* 1. Pagamento Icon */}
                                {deal.payment_status === 'paid' ? (
                                  <div 
                                    title="Pagamento Realizado" 
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-help shrink-0"
                                  >
                                    <span className="text-[11px] font-bold leading-none">$</span>
                                  </div>
                                ) : (
                                  <div 
                                    title="Pagamento Pendente" 
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 transition-colors cursor-help shrink-0"
                                  >
                                    <span className="text-[11px] font-bold leading-none">$</span>
                                  </div>
                                )}

                                {/* 2. Contrato Icon */}
                                {(() => {
                                  let colorClass = "text-sky-400 bg-sky-500/20 hover:bg-sky-500/30";
                                  let titleText = "Contrato Não Enviado";
                                  if (deal.contract_status === 'sent') {
                                    colorClass = "text-amber-500 bg-amber-500/20 hover:bg-amber-500/30";
                                    titleText = "Contrato Enviado";
                                  } else if (deal.contract_status === 'signed') {
                                    colorClass = "text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30";
                                    titleText = "Contrato Assinado";
                                  }
                                  return (
                                    <div 
                                      title={titleText} 
                                      className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors cursor-help shrink-0 ${colorClass}`}
                                    >
                                      <FileSignature className="h-3 w-3" />
                                    </div>
                                  );
                                })()}

                                {/* 3. Sentença (Gavel) Icon */}
                                {(() => {
                                  let colorClass = "text-muted-foreground/60 bg-muted hover:bg-muted/80";
                                  let titleText = "Processo em Andamento";
                                  if (deal.status === 'won') {
                                    colorClass = "text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30";
                                    titleText = "Sentença Favorável (Vitória)";
                                  } else if (deal.status === 'lost') {
                                    colorClass = "text-red-400 bg-red-500/20 hover:bg-red-500/30";
                                    titleText = "Sentença Desfavorável (Derrota)";
                                  }
                                  return (
                                    <div 
                                      title={titleText} 
                                      className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors cursor-help shrink-0 ${colorClass}`}
                                    >
                                      <Gavel className="h-3 w-3" />
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="border-t border-border p-4 bg-muted/5 animate-in fade-in slide-in-from-top-1 duration-150">
                              <DealBillingDetails
                                dealId={deal.id}
                                contact={contact}
                                dealTitle={deal.title}
                                dealValue={deal.value}
                                dealBillingFixedValue={(deal as any).billing_fixed_value}
                                dealBillingType={(deal as any).billing_type}
                                onUpdated={fetchDeals}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

