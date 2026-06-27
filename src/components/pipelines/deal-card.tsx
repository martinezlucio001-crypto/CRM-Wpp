"use client";

import type { Deal, PipelineStage } from "@/types";
import { Calendar, Check, X, FileSignature, Gavel } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return source.charAt(0).toUpperCase();
}

export function DealCard({ deal, stage, onEdit, isOverlay }: DealCardProps) {
  const contactLabel = deal.contact?.name || deal.contact?.phone || "Sem contato";
  const assigneeLabel = deal.assignee?.full_name || null;

  return (
    <button
      type="button"
      onClick={(e) => {
        // `onClick` still fires after a non-drag tap because the PointerSensor
        // requires 5px movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={`group relative w-full cursor-pointer rounded-xl border border-border/50 bg-muted/70 pl-4 pr-3 py-3 text-left shadow-sm transition-all ${
        isOverlay
          ? "shadow-xl"
          : "hover:-translate-y-0.5 hover:border-border hover:bg-muted hover:shadow-lg"
      }`}
    >
      {/* 4px left accent bar using stage color */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 text-sm font-semibold leading-snug text-foreground break-words pr-1">
          {deal.title}
        </h4>
        
        {/* Status Icons Row */}
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {/* 1. Pagamento Icon */}
          {deal.payment_status === 'paid' ? (
            <div 
              title="Pagamento Realizado" 
              className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-help"
            >
              <span className="text-[11px] font-bold leading-none">$</span>
            </div>
          ) : (
            <div 
              title="Pagamento Pendente" 
              className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 transition-colors cursor-help"
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
                className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors cursor-help ${colorClass}`}
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
                className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors cursor-help ${colorClass}`}
              >
                <Gavel className="h-3 w-3" />
              </div>
            );
          })()}
        </div>
      </div>

      {/* Contact row */}
      <div className="mt-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
          {initials(deal.contact?.name, deal.contact?.phone)}
        </span>
        <span className="truncate text-xs text-muted-foreground">{contactLabel}</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold text-primary">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        {deal.expected_close_date && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(deal.expected_close_date)}
          </span>
        )}
      </div>

      {assigneeLabel && (
        <div className="mt-2 flex items-center justify-end">
          <span
            title={assigneeLabel}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
          >
            {initials(assigneeLabel)}
          </span>
        </div>
      )}
    </button>
  );
}
