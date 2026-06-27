'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Shield, FileText, Plus, Trash2, Loader2, Star, StarOff } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SettingsChip } from './settings-chip';

interface DocumentField {
  id: string;
  name: string;
  is_default: boolean;
}

export function DocumentFieldsSettings() {
  const supabase = createClient();
  const { accountId } = useAuth();

  const [fields, setFields] = useState<DocumentField[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchFields = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_fields')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setFields((data as DocumentField[]) ?? []);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível carregar as pastas de documentos.');
    } finally {
      setLoading(false);
    }
  }, [supabase, accountId]);

  useEffect(() => {
    if (accountId) {
      fetchFields();
    }
  }, [accountId, fetchFields]);

  function isDuplicate(name: string, exceptId?: string): boolean {
    const lower = name.toLowerCase();
    return fields.some(
      (f) => f.id !== exceptId && f.name.toLowerCase() === lower
    );
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    if (!accountId) {
      toast.error('Perfil sem conta vinculada.');
      return;
    }
    if (isDuplicate(name)) {
      toast.error(`Uma pasta de documentos chamada "${name}" já existe.`);
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('document_fields').insert({
        name,
        is_default: newIsDefault,
        account_id: accountId,
      });

      if (error) throw error;

      toast.success(`Pasta "${name}" criada.`);
      setNewName('');
      setNewIsDefault(false);
      fetchFields();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar pasta de documentos.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleDefault(field: DocumentField) {
    setBusyId(field.id);
    try {
      const { error } = await supabase
        .from('document_fields')
        .update({ is_default: !field.is_default })
        .eq('id', field.id);

      if (error) throw error;

      toast.success(`Pasta "${field.name}" atualizada.`);
      fetchFields();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar pasta de documentos.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(field: DocumentField, nextName: string): Promise<boolean> {
    const name = nextName.trim();
    if (!name || name === field.name) return true;
    if (isDuplicate(name, field.id)) {
      toast.error(`Uma pasta de documentos chamada "${name}" já existe.`);
      return false;
    }
    setBusyId(field.id);
    try {
      const { error } = await supabase
        .from('document_fields')
        .update({ name })
        .eq('id', field.id);

      if (error) throw error;
      fetchFields();
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Erro ao renomear pasta.');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(field: DocumentField) {
    const confirm = window.confirm(
      `Excluir "${field.name}"? Os arquivos já associados a essa pasta perderão a categoria, mas continuarão anexados como Documentos Gerais. Esta ação não pode ser desfeita.`
    );
    if (!confirm) return;

    setBusyId(field.id);
    try {
      const { error } = await supabase
        .from('document_fields')
        .delete()
        .eq('id', field.id);

      if (error) throw error;

      toast.success(`Pasta "${field.name}" excluída.`);
      fetchFields();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir pasta de documentos.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileText className="size-4 text-primary" />
          Pastas de Documentos (Law Firm)
          <SettingsChip variant="admin" className="font-medium">
            <Shield />
            Admin
          </SettingsChip>
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Defina as categorias de documentos exigidas em processos (ex: RG, Comprovante de Residência).
          Pastas marcadas como <strong>Documento Padrão</strong> serão exibidas automaticamente na ficha de todo cliente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create Field Form */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 bg-muted/20 border border-border/50 rounded-lg p-3">
          <div className="flex-1 w-full space-y-1">
            <Label className="text-xs text-muted-foreground">Nome da Categoria</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="Ex: RG, Procuração, Contrato Social..."
              className="bg-muted text-foreground h-9 text-sm"
            />
          </div>

          <div className="flex items-center space-x-2 pt-5 md:pt-4">
            <Checkbox
              id="is-default-checkbox"
              checked={newIsDefault}
              onCheckedChange={(checked) => setNewIsDefault(!!checked)}
              className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
            <Label
              htmlFor="is-default-checkbox"
              className="text-xs text-muted-foreground font-medium cursor-pointer"
            >
              Documento Padrão
            </Label>
          </div>

          <Button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 h-9 text-xs mt-0 md:mt-4"
          >
            {creating ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <Plus className="size-3.5 mr-1.5" />
            )}
            Adicionar Pasta
          </Button>
        </div>

        {/* Fields List */}
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Carregando pastas...
            </div>
          ) : fields.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground italic">
              Nenhuma pasta de documentos cadastrada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {fields.map((field) => (
                <DocumentFieldRow
                  key={field.id}
                  field={field}
                  busy={busyId === field.id}
                  onToggleDefault={handleToggleDefault}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DocumentFieldRowProps {
  field: DocumentField;
  busy: boolean;
  onToggleDefault: (field: DocumentField) => void;
  onRename: (field: DocumentField, nextName: string) => Promise<boolean>;
  onDelete: (field: DocumentField) => void;
}

function DocumentFieldRow({
  field,
  busy,
  onToggleDefault,
  onRename,
  onDelete,
}: DocumentFieldRowProps) {
  const [name, setName] = useState(field.name);

  async function commit() {
    if (name.trim() === field.name) {
      setName(field.name);
      return;
    }
    const ok = await onRename(field, name);
    if (!ok) setName(field.name);
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2 group hover:bg-muted/10 transition-colors">
      <Input
        value={name}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={`Renomear ${field.name}`}
        className="focus:border-primary h-8 border-transparent bg-transparent text-foreground hover:border-border text-sm flex-1 min-w-0"
      />

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onToggleDefault(field)}
          className={`h-7 px-2 text-[10px] gap-1 font-semibold transition-colors ${
            field.is_default
              ? 'text-yellow-400 bg-yellow-400/5 hover:bg-yellow-400/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={field.is_default ? 'Remover dos padrões' : 'Tornar documento padrão'}
        >
          {field.is_default ? (
            <>
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
              Padrão
            </>
          ) : (
            <>
              <StarOff className="size-3" />
              Tornar Padrão
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          onClick={() => onDelete(field)}
          title="Excluir pasta"
          className="size-7 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      </div>
    </li>
  );
}
