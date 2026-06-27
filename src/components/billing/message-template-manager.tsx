'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { ManualMessageTemplate } from '@/types';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit2, Trash2, ArrowLeft, Check } from 'lucide-react';

interface MessageTemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (template: ManualMessageTemplate) => void;
  selectedId?: string;
}

export function MessageTemplateManager({
  open,
  onOpenChange,
  onSelect,
  selectedId,
}: MessageTemplateManagerProps) {
  const supabase = createClient();
  const { accountId } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [templates, setTemplates] = useState<ManualMessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [editingTemplate, setEditingTemplate] = useState<ManualMessageTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && accountId) {
      fetchTemplates();
    }
  }, [open, accountId]);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('manual_message_templates')
        .select('*')
        .order('name');
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      toast.error('Erro ao carregar templates: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAddVariable(variable: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBodyText((prev) => prev + variable);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setBodyText(before + variable + after);
    
    // Reset focus and cursor position after state updates
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('O nome do template é obrigatório');
      return;
    }
    if (!bodyText.trim()) {
      toast.error('O conteúdo da mensagem é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('manual_message_templates')
          .update({
            name: name.trim(),
            body_text: bodyText.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('Template atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('manual_message_templates')
          .insert({
            account_id: accountId,
            name: name.trim(),
            body_text: bodyText.trim(),
          });
        if (error) throw error;
        toast.success('Template criado com sucesso');
      }
      resetForm();
      fetchTemplates();
    } catch (err: any) {
      toast.error('Erro ao salvar template: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir este template?')) return;
    try {
      const { error } = await supabase
        .from('manual_message_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Template excluído com sucesso');
      fetchTemplates();
    } catch (err: any) {
      toast.error('Erro ao excluir template: ' + err.message);
    }
  }

  function startEdit(template: ManualMessageTemplate) {
    setEditingTemplate(template);
    setName(template.name);
    setBodyText(template.body_text);
    setIsCreating(false);
  }

  function startCreate() {
    setEditingTemplate(null);
    setName('');
    setBodyText('');
    setIsCreating(true);
  }

  function resetForm() {
    setEditingTemplate(null);
    setIsCreating(false);
    setName('');
    setBodyText('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-lg md:max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold flex items-center justify-between">
            {isCreating || editingTemplate ? (
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-2 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-4" /> Voltar para a lista
              </button>
            ) : (
              'Modelos de Mensagem de Cobrança'
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {isCreating || editingTemplate
              ? 'Configure o texto do modelo de mensagem de cobrança rápida.'
              : 'Gerencie ou selecione modelos de mensagens para agilizar o envio de faturas pelo WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 min-h-[300px]">
          {isCreating || editingTemplate ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name" className="text-sm font-medium text-muted-foreground">
                  Nome do Modelo
                </Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Lembrete de Honorários (Vencimento)"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="template-body" className="text-sm font-medium text-muted-foreground">
                    Mensagem
                  </Label>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleAddVariable('{nome do cliente}')}
                      className="text-xs px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded border border-primary/20 transition-colors"
                    >
                      {'{nome do cliente}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddVariable('{número da parcela}')}
                      className="text-xs px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded border border-primary/20 transition-colors"
                    >
                      {'{número da parcela}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddVariable('{número do processo}')}
                      className="text-xs px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded border border-primary/20 transition-colors"
                    >
                      {'{número do processo}'}
                    </button>
                  </div>
                </div>
                <Textarea
                  id="template-body"
                  ref={textareaRef}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Escreva a mensagem aqui..."
                  className="min-h-[180px] font-sans bg-muted border-border text-foreground placeholder:text-muted-foreground leading-relaxed resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  Dica: As variáveis acima serão substituídas automaticamente pelos dados do processo e cliente antes de abrir o WhatsApp.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-border text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Salvar Modelo
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Modelos Salvos ({templates.length})</h3>
                <Button
                  type="button"
                  size="sm"
                  onClick={startCreate}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5"
                >
                  <Plus className="size-4" /> Novo Modelo
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin mr-2" /> Carregando modelos...
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                  Nenhum modelo de mensagem criado ainda.
                </div>
              ) : (
                <div className="grid gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {templates.map((template) => {
                    const isSelected = selectedId === template.id;
                    return (
                      <div
                        key={template.id}
                        className={`flex flex-col md:flex-row justify-between items-start md:items-center p-3 border rounded-lg transition-all ${
                          isSelected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="font-semibold text-sm truncate flex items-center gap-1.5 text-foreground">
                            {template.name}
                            {isSelected && <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px]">Selecionado</Badge>}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 font-mono whitespace-pre-line leading-relaxed">
                            {template.body_text}
                          </p>
                        </div>
                        <div className="flex gap-2 mt-3 md:mt-0 shrink-0 self-end md:self-center">
                          {onSelect && (
                            <Button
                              type="button"
                              size="sm"
                              variant={isSelected ? "secondary" : "outline"}
                              onClick={() => {
                                onSelect(template);
                                onOpenChange(false);
                              }}
                              className="border-border hover:bg-muted flex items-center gap-1 text-xs"
                            >
                              <Check className="size-3.5" /> Selecionar
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(template)}
                            className="text-muted-foreground hover:text-foreground size-8 p-0"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(template.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 size-8 p-0"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {!isCreating && !editingTemplate && (
          <DialogFooter className="shrink-0 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Fechar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
