"use client";

import { useMemo } from "react";
import type { Deal, PipelineStage } from "@/types";
import {
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  Trophy,
  XCircle,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";

interface PipelineAnalyticsProps {
  stages: PipelineStage[];
  deals: Deal[];
}

/**
 * Weighted pipeline value: value × per-stage probability.
 * First stage ≈ 10%, stages interpolate up to 90% before the final stage,
 * final stage (Won) = 100%. Lost deals excluded.
 */
function computeStageProbability(
  stage: PipelineStage,
  sortedStages: PipelineStage[],
): number {
  const n = sortedStages.length;
  if (n <= 1) return 1;
  const index = sortedStages.findIndex((s) => s.id === stage.id);
  if (index < 0) return 0;
  if (index === n - 1) return 1;
  const slots = n - 1;
  if (slots <= 1) return 0.1;
  const t = index / (slots - 1);
  return 0.1 + t * (0.9 - 0.1);
}

export function PipelineAnalytics({ stages, deals }: PipelineAnalyticsProps) {
  const { defaultCurrency } = useAuth();
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const stats = useMemo(() => {
    // 1. Processos Ativos (status === 'open')
    const activeDeals = deals.filter((d) => d.status === "open");
    const activeCount = activeDeals.length;

    // 2. Leads Totais (open deals in stages other than "Ganho")
    const stageMap = new Map(sortedStages.map((s) => [s.id, s]));
    const leadsDeals = activeDeals.filter((d) => {
      const stage = stageMap.get(d.stage_id);
      return stage ? stage.name !== "Ganho" : true;
    });
    const leadsCount = leadsDeals.length;

    // 3. Valor Médio (média do valor dos contratos ativos)
    const totalActiveValue = activeDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const avgActiveValue = activeCount > 0 ? totalActiveValue / activeCount : 0;

    // 4. Leads Convertidos Este mês (status === 'won' e atualizado este mês)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = (d: Deal) => {
      const ts = d.updated_at ?? d.created_at;
      return ts ? new Date(ts) >= monthStart : false;
    };
    const convertedThisMonth = deals.filter(
      (d) => d.status === "won" && thisMonth(d),
    ).length;

    return {
      activeCount,
      leadsCount,
      avgActiveValue,
      convertedThisMonth,
    };
  }, [deals, sortedStages]);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card/60 p-4 sm:grid-cols-4">
        <Metric
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
          label="Processos Ativos"
          value={String(stats.activeCount)}
          tooltip="Total de processos ativos (não finalizados/perdidos)."
        />
        <Metric
          icon={<Target className="h-4 w-4 text-blue-400" />}
          label="Leads Totais"
          value={String(stats.leadsCount)}
          tooltip="Total de potenciais clientes (leads ativos antes de fechar o contrato)."
        />
        <Metric
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          label="Valor Médio"
          value={formatCurrency(stats.avgActiveValue, defaultCurrency)}
          tooltip="Média do valor dos processos/contratos ativos."
        />
        <Metric
          icon={<Trophy className="h-4 w-4 text-purple-400" />}
          label="Leads Convertidos Este Mês"
          value={String(stats.convertedThisMonth)}
          tooltip="Leads que assinaram contrato (ganhos) neste mês."
        />
      </div>
    </TooltipProvider>
  );
}

function Metric({
  icon,
  label,
  value,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tooltip: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`Como ${label} é calculado`}
                className="ml-auto text-muted-foreground hover:text-foreground focus:outline-none"
              />
            }
          >
            <Info className="h-3 w-3" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
