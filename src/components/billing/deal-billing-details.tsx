'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import type { Contact, Deal, DealInstallment, ManualMessageTemplate, DealPaymentMethod, DealInstallmentStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageTemplateManager } from './message-template-manager';
import {
  Loader2,
  Calendar,
  Plus,
  Send,
  Upload,
  Download,
  Trash2,
  Settings,
  Save,
  Check,
  X,
  FileText
} from 'lucide-react';
import { format, addMonths, addWeeks, setDate, getDay, setDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DealBillingDetailsProps {
  dealId: string;
  contact: Contact;
  dealTitle: string;
  dealValue: number;
  dealBillingFixedValue?: number;
  dealBillingType?: string;
  onUpdated?: () => void;
}

export function DealBillingDetails({
  dealId,
  contact,
  dealTitle,
  dealValue,
  dealBillingFixedValue,
  dealBillingType,
  onUpdated
}: DealBillingDetailsProps) {
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [installments, setInstallments] = useState<DealInstallment[]>([]);
  const [loading, setLoading] = useState(false);

  // Installment Generation State
  const [numInstallments, setNumInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurrence, setRecurrence] = useState<'monthly_day' | 'monthly_first_monday' | 'weekly' | 'single'>('monthly_day');
  const [generating, setGenerating] = useState(false);

  // Template Manager Modal State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [activeInstallmentForTemplate, setActiveInstallmentForTemplate] = useState<string | null>(null);

  // Editing state for individual installments
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState<DealInstallmentStatus>('pending');
  const [editMethod, setEditMethod] = useState<DealPaymentMethod>('pix');
  const [updatingInstallment, setUpdatingInstallment] = useState(false);

  // File Upload State
  const [uploadingInstallmentId, setUploadingInstallmentId] = useState<string | null>(null);

  useEffect(() => {
    if (dealId && accountId) {
      fetchInstallments();
    }
  }, [dealId, accountId]);

  async function fetchInstallments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deal_installments')
        .select('*, message_template:manual_message_templates(*)')
        .eq('deal_id', dealId)
        .order('due_date', { ascending: true });
      if (error) throw error;
      setInstallments(data || []);
    } catch (err: any) {
      toast.error('Erro ao carregar parcelas: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Recurrence Date Generators
  function calculateFirstMondayOfMonth(date: Date): Date {
    let checkDate = startOfMonth(date);
    while (getDay(checkDate) !== 1) { // 1 = Monday
      checkDate = new Date(checkDate.setDate(checkDate.getDate() + 1));
    }
    return checkDate;
  }

  async function handleGenerateInstallments() {
    if (numInstallments < 1) {
      toast.error('O número de parcelas deve ser pelo menos 1');
      return;
    }
    
    setGenerating(true);
    try {
      // Calculate amount per installment
      // Value to divide: either dealBillingFixedValue or dealValue
      const totalAmount = dealBillingFixedValue || dealValue || 0;
      const installmentValue = parseFloat((totalAmount / numInstallments).toFixed(2));
      
      const newInstallmentsPayload = [];
      let baseDate = new Date(firstDueDate + 'T12:00:00'); // Force midday to avoid timezone shifts

      for (let i = 0; i < numInstallments; i++) {
        let dueDate = baseDate;

        if (i > 0) {
          if (recurrence === 'monthly_day') {
            dueDate = addMonths(baseDate, i);
          } else if (recurrence === 'monthly_first_monday') {
            // Add i months to startOfMonth of baseDate, then find the first Monday
            const nextMonth = addMonths(baseDate, i);
            dueDate = calculateFirstMondayOfMonth(nextMonth);
          } else if (recurrence === 'weekly') {
            dueDate = addWeeks(baseDate, i);
          }
        } else if (recurrence === 'monthly_first_monday') {
          dueDate = calculateFirstMondayOfMonth(baseDate);
        }

        newInstallmentsPayload.push({
          account_id: accountId,
          deal_id: dealId,
          amount: i === numInstallments - 1 
            ? parseFloat((totalAmount - (installmentValue * (numInstallments - 1))).toFixed(2)) // adjust last installment for rounding issues
            : installmentValue,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          status: 'pending' as DealInstallmentStatus,
          payment_method: 'pix' as DealPaymentMethod,
        });
      }

      // First, clear existing installments if any (confirm with user? Or just do it)
      if (installments.length > 0) {
        if (!confirm('Esta ação irá excluir todas as parcelas existentes para este processo. Deseja continuar?')) {
          setGenerating(false);
          return;
        }
        const { error: deleteError } = await supabase
          .from('deal_installments')
          .delete()
          .eq('deal_id', dealId);
        if (deleteError) throw deleteError;
      }

      const { error: insertError } = await supabase
        .from('deal_installments')
        .insert(newInstallmentsPayload);

      if (insertError) throw insertError;

      toast.success(`${numInstallments} parcelas geradas com sucesso`);
      fetchInstallments();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error('Erro ao gerar parcelas: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  // Edit installment
  function startEdit(inst: DealInstallment) {
    setEditingInstallmentId(inst.id);
    setEditAmount(String(inst.amount));
    setEditDueDate(inst.due_date);
    setEditStatus(inst.status);
    setEditMethod(inst.payment_method || 'pix');
  }

  async function handleSaveEdit(id: string) {
    setUpdatingInstallment(true);
    try {
      const parsedAmount = parseFloat(editAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast.error('Valor da parcela inválido');
        setUpdatingInstallment(false);
        return;
      }

      const payload: Partial<DealInstallment> = {
        amount: parsedAmount,
        due_date: editDueDate,
        status: editStatus,
        payment_method: editMethod,
        updated_at: new Date().toISOString(),
        paid_at: editStatus === 'paid' ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('deal_installments')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      toast.success('Parcela atualizada');
      setEditingInstallmentId(null);
      fetchInstallments();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error('Erro ao atualizar: ' + err.message);
    } finally {
      setUpdatingInstallment(false);
    }
  }

  async function handleDeleteInstallment(id: string) {
    if (!confirm('Excluir esta parcela?')) return;
    try {
      // If there is an attachment, delete it from storage first
      const inst = installments.find(i => i.id === id);
      if (inst?.receipt_url) {
        await supabase.storage.from('documents').remove([inst.receipt_url]);
      }

      const { error } = await supabase
        .from('deal_installments')
        .delete()
        .eq('id', id);
      if (error) throw error;

      toast.success('Parcela excluída');
      fetchInstallments();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error('Erro ao excluir parcela: ' + err.message);
    }
  }

  // File uploading/receipts logic
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, id: string) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 52428800) {
      toast.error('O arquivo excede o limite de 50MB');
      return;
    }

    setUploadingInstallmentId(id);
    try {
      const fileExt = file.name.split('.').pop();
      const uniqueId = crypto.randomUUID();
      const storagePath = `account-${accountId}/receipts/${id}-${uniqueId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Update DB
      const { error: dbError } = await supabase
        .from('deal_installments')
        .update({
          receipt_url: storagePath,
          status: 'paid' as DealInstallmentStatus,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (dbError) throw dbError;

      toast.success('Comprovante enviado com sucesso');
      fetchInstallments();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error('Erro ao enviar comprovante: ' + err.message);
    } finally {
      setUploadingInstallmentId(null);
    }
  }

  async function handleDownloadReceipt(filePath: string) {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      toast.error('Erro ao obter download do comprovante');
    }
  }

  async function handleDeleteReceipt(id: string, filePath: string) {
    if (!confirm('Deseja excluir o comprovante anexado?')) return;
    try {
      await supabase.storage.from('documents').remove([filePath]);
      const { error } = await supabase
        .from('deal_installments')
        .update({
          receipt_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      toast.success('Comprovante removido');
      fetchInstallments();
    } catch (err: any) {
      toast.error('Erro ao excluir comprovante: ' + err.message);
    }
  }

  // WhatsApp Sending
  function formatWhatsAppMessage(inst: DealInstallment, index: number): string {
    const clientName = contact.name || 'Cliente';
    const installmentName = `Parcela ${index + 1}/${installments.length}`;
    const processName = dealTitle;
    const valueStr = formatCurrency(inst.amount, defaultCurrency || 'BRL');
    const dueDateStr = format(new Date(inst.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });

    let messageText = '';

    if (inst.message_template) {
      messageText = inst.message_template.body_text
        .replace(/{nome do cliente}/g, clientName)
        .replace(/{número da parcela}/g, installmentName)
        .replace(/{número do processo}/g, processName);
    } else {
      // Default fallback script
      messageText = `Olá, ${clientName}! Passando para lembrar que o pagamento da ${installmentName} do seu processo (${processName}) no valor de ${valueStr} vence em ${dueDateStr}.`;
    }

    return messageText;
  }

  function handleSendWhatsApp(inst: DealInstallment, index: number) {
    const phoneDigits = contact.phone.replace(/\D/g, '');
    const message = formatWhatsAppMessage(inst, index);
    const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  // Template select callback
  async function handleSelectTemplate(template: ManualMessageTemplate) {
    if (!activeInstallmentForTemplate) return;
    try {
      const { error } = await supabase
        .from('deal_installments')
        .update({
          message_template_id: template.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeInstallmentForTemplate);
      
      if (error) throw error;
      toast.success('Modelo de mensagem atrelado com sucesso');
      fetchInstallments();
    } catch (err: any) {
      toast.error('Erro ao associar modelo: ' + err.message);
    } finally {
      setActiveInstallmentForTemplate(null);
    }
  }

  return (
    <div className="space-y-6 pt-3 text-foreground">
      {/* Configure Installments Creator */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5 text-foreground">
          <Calendar className="size-4 text-primary" /> Gerar Calendário de Cobranças
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold">Qtd. Parcelas</Label>
            <Input
              type="number"
              min={1}
              value={numInstallments}
              onChange={(e) => setNumInstallments(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-muted border-border text-foreground h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold">1º Vencimento</Label>
            <Input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="bg-muted border-border text-foreground h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs font-semibold">Frequência</Label>
            <select
              value={recurrence}
              onChange={(e: any) => setRecurrence(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="single">Parcela Única</option>
              <option value="monthly_day">Mensal (Todo dia X)</option>
              <option value="monthly_first_monday">Mensal (1ª Segunda-Feira)</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>

          <Button
            type="button"
            disabled={generating}
            onClick={handleGenerateInstallments}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium h-9"
          >
            {generating ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Plus className="size-3.5 mr-1.5" />}
            Gerar Parcelas
          </Button>
        </div>
      </div>

      {/* List of Installments */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-semibold text-muted-foreground">Parcelamento do Processo</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTemplateModalOpen(true)}
            className="border-border text-muted-foreground hover:bg-muted text-xs h-8 flex items-center gap-1.5"
          >
            <Settings className="size-3.5" /> Modelos de Mensagem
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6 text-muted-foreground text-xs">
            <Loader2 className="size-5 animate-spin mr-2" /> Carregando faturamento...
          </div>
        ) : installments.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground text-xs">
            Nenhuma parcela gerada ainda. Use a ferramenta acima para gerar as cobranças.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="p-2.5 font-medium">Parcela</th>
                  <th className="p-2.5 font-medium">Valor</th>
                  <th className="p-2.5 font-medium">Vencimento</th>
                  <th className="p-2.5 font-medium">Status / Método</th>
                  <th className="p-2.5 font-medium">Comprovante</th>
                  <th className="p-2.5 font-medium">Mensagem</th>
                  <th className="p-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((inst, index) => {
                  const isEditing = editingInstallmentId === inst.id;
                  return (
                    <tr key={inst.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="p-2.5 font-semibold text-foreground">
                        {index + 1}/{installments.length}
                      </td>
                      <td className="p-2.5 text-foreground">
                        {isEditing ? (
                          <div className="relative max-w-[100px]">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground select-none">R$</span>
                            <Input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="h-7 pl-6 pr-1 py-1 text-xs border-border bg-muted text-foreground"
                            />
                          </div>
                        ) : (
                          formatCurrency(inst.amount, defaultCurrency || 'BRL')
                        )}
                      </td>
                      <td className="p-2.5 text-foreground">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="h-7 px-1 py-1 text-xs border-border bg-muted text-foreground"
                          />
                        ) : (
                          format(new Date(inst.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                        )}
                      </td>
                      <td className="p-2.5">
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <select
                              value={editStatus}
                              onChange={(e: any) => setEditStatus(e.target.value)}
                              className="h-7 rounded border border-border bg-muted px-1.5 text-xs text-foreground outline-none"
                            >
                              <option value="pending">Pendente</option>
                              <option value="paid">Pago</option>
                              <option value="cancelled">Cancelado</option>
                            </select>
                            <select
                              value={editMethod}
                              onChange={(e: any) => setEditMethod(e.target.value)}
                              className="h-7 rounded border border-border bg-muted px-1.5 text-xs text-foreground outline-none"
                            >
                              <option value="pix">Pix</option>
                              <option value="credit_card">Crédito</option>
                              <option value="debit_card">Débito</option>
                              <option value="boleto">Boleto</option>
                              <option value="cash">Dinheiro</option>
                              <option value="other">Outro</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={
                                inst.status === 'paid'
                                  ? 'border-primary/30 text-primary bg-primary/5 text-[9px] px-1 py-0'
                                  : inst.status === 'cancelled'
                                  ? 'border-muted text-muted-foreground text-[9px] px-1 py-0'
                                  : 'border-amber-500/30 text-amber-500 bg-amber-500/5 text-[9px] px-1 py-0'
                              }
                            >
                              {inst.status === 'paid' ? 'Pago' : inst.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              ({inst.payment_method})
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-2.5">
                        {inst.receipt_url ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleDownloadReceipt(inst.receipt_url!)}
                              className="h-7 px-2 hover:bg-muted text-primary text-xs flex items-center gap-1"
                            >
                              <Download className="size-3" /> Ver Recibo
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleDeleteReceipt(inst.id, inst.receipt_url!)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            {uploadingInstallmentId === inst.id ? (
                              <span className="flex items-center text-muted-foreground gap-1">
                                <Loader2 className="size-3 animate-spin text-primary" /> Enviando...
                              </span>
                            ) : (
                              <label className="cursor-pointer inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-medium">
                                <Upload className="size-3" /> Anexar
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={(e) => handleFileUpload(e, inst.id)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setActiveInstallmentForTemplate(inst.id);
                            setTemplateModalOpen(true);
                          }}
                          className="h-7 px-2 hover:bg-muted text-muted-foreground text-[10px] text-left truncate max-w-[120px]"
                        >
                          <FileText className="size-3 mr-1" />
                          {inst.message_template?.name || 'Lembrete Padrão'}
                        </Button>
                      </td>
                      <td className="p-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleSaveEdit(inst.id)}
                                disabled={updatingInstallment}
                                className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setEditingInstallmentId(null)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleSendWhatsApp(inst, index)}
                                className="h-7 px-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1"
                              >
                                <Send className="size-3" /> Cobrar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => startEdit(inst)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              >
                                <Settings className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleDeleteInstallment(inst.id)}
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MessageTemplateManager
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        onSelect={activeInstallmentForTemplate ? handleSelectTemplate : undefined}
        selectedId={
          activeInstallmentForTemplate 
            ? (installments.find(i => i.id === activeInstallmentForTemplate)?.message_template_id || undefined) 
            : undefined
        }
      />
    </div>
  );
}
