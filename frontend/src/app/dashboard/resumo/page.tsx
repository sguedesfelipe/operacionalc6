"use client";

/* eslint-disable react-hooks/set-state-in-effect --
 * Mesmo caso de /dashboard/base-final: reseta loading/erro ao reagir a
 * mudança de filtro antes de rebuscar dado novo, igual ao exemplo oficial de
 * "fetching data" do react.dev. Ver justificativa completa lá.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, fetchMe, fetchResumoAnual } from "@/lib/api";
import { clearTokens, isLoggedIn } from "@/lib/auth";
import { MESES } from "@/lib/dates";
import type { ResumoAnual, User } from "@/lib/types";
import { BarWithLineChart, CHART_COLORS, MonthDataRow, StackedBarChart } from "@/components/charts";

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Rótulo compacto pro eixo Y dos gráficos (ex.: "R$ 1,2 mi") — o valor exato
// vai no tooltip; o eixo só precisa dar noção de escala.
function formatBRLCompact(v: number): string {
  if (v === 0) return "R$ 0";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export default function ResumoNegocioPage() {
  const router = useRouter();
  const hoje = new Date();

  const [user, setUser] = useState<User | null>(null);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesInicio, setMesInicio] = useState(1);
  const [mesFim, setMesFim] = useState(12);
  const [filial, setFilial] = useState("");
  const [resumo, setResumo] = useState<ResumoAnual | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/");
      return;
    }

    setLoading(true);
    setError(null);
    Promise.all([fetchMe(), fetchResumoAnual(ano, mesInicio, mesFim, filial || undefined)])
      .then(([meData, resumoData]) => {
        setUser(meData);
        setResumo(resumoData);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Erro ao carregar o resumo do negócio.");
        setResumo(null);
      })
      .finally(() => setLoading(false));
  }, [ano, mesInicio, mesFim, filial, router]);

  function handleLogout() {
    clearTokens();
    router.replace("/");
  }

  const meses = resumo?.meses ?? [];
  const mesesNumeros = meses.map((m) => m.mes);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Resumo do negócio</h1>
          {user && (
            <p className="text-sm text-zinc-500">
              {user.full_name} · {user.role}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/base-final" className="text-sm text-zinc-600 hover:text-zinc-900">
            base_final
          </Link>
          <Link href="/dashboard/gn" className="text-sm text-zinc-600 hover:text-zinc-900">
            Comissão por área
          </Link>
          <Link href="/dashboard" className="text-sm text-zinc-600 hover:text-zinc-900">
            ← Visão geral
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-6">
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <label className="flex flex-col text-sm text-zinc-600">
            Ano
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="mt-1 w-24 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900"
            />
          </label>

          <label className="flex flex-col text-sm text-zinc-600">
            De
            <select
              value={mesInicio}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMesInicio(v);
                if (v > mesFim) setMesFim(v);
              }}
              className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900"
            >
              {MESES.map((nome, i) => (
                <option key={nome} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-zinc-600">
            Até
            <select
              value={mesFim}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMesFim(v);
                if (v < mesInicio) setMesInicio(v);
              }}
              className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900"
            >
              {MESES.map((nome, i) => (
                <option key={nome} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-zinc-600">
            Filial
            <select
              value={filial}
              onChange={(e) => setFilial(e.target.value)}
              className="mt-1 min-w-[220px] rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900"
            >
              <option value="">Todas as filiais</option>
              {(resumo?.filiais ?? []).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          {loading && <p className="pb-1.5 text-sm text-zinc-500">Carregando…</p>}
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {!error && (
          <div className="grid grid-cols-1 gap-4 opacity-100 transition-opacity xl:grid-cols-2" style={{ opacity: loading ? 0.6 : 1 }}>
            <BarWithLineChart
              title="Produção Financiamentos"
              subtitle="Vl Financiamento"
              data={meses.map((m) => ({ mes: m.mes, value: m.vl_financiamento }))}
              target={meses.map((m) => m.meta_producao)}
              targetLabel="Meta de produção"
              color={CHART_COLORS.blue}
              formatValue={formatBRLCompact}
              formatTooltipValue={formatBRL}
            />

            <BarWithLineChart
              title="Produção Contábil"
              subtitle="Vl Principal"
              data={meses.map((m) => ({ mes: m.mes, value: m.vl_principal }))}
              color={CHART_COLORS.blue}
              formatValue={formatBRLCompact}
              formatTooltipValue={formatBRL}
            />

            <BarWithLineChart
              title="Produção Comissionada"
              subtitle="Vl Comissionado EHS"
              data={meses.map((m) => ({ mes: m.mes, value: m.vl_comissionado_ehs }))}
              color={CHART_COLORS.blue}
              formatValue={formatBRLCompact}
              formatTooltipValue={formatBRL}
            />

            <StackedBarChart
              title="Seguro Total"
              subtitle="Prestamista + AP + Outros"
              months={mesesNumeros}
              series={[
                {
                  key: "prestamista",
                  label: "Seguro Prestamista",
                  color: CHART_COLORS.blue,
                  values: meses.map((m) => m.vl_seguro_prestamista),
                },
                {
                  key: "ap",
                  label: "Seguro AP",
                  color: CHART_COLORS.orange,
                  values: meses.map((m) => m.vl_seguro_ap),
                },
                {
                  key: "outros",
                  label: "Seguro Outros",
                  color: CHART_COLORS.aqua,
                  values: meses.map((m) => m.vl_seguro_outros),
                },
              ]}
              formatValue={formatBRLCompact}
              formatTooltipValue={formatBRL}
            />

            <BarWithLineChart
              title="Comissão Final EHS"
              subtitle="Comissão Final R$"
              data={meses.map((m) => ({ mes: m.mes, value: m.comissao_final }))}
              color={CHART_COLORS.blue}
              formatValue={formatBRLCompact}
              formatTooltipValue={formatBRL}
            />

            <div className="flex flex-col gap-2">
              <StackedBarChart
                title="Quantidade de Contratos"
                subtitle="Com seguro + Sem seguro"
                months={mesesNumeros}
                series={[
                  {
                    key: "seguro_sim",
                    label: "Tem seguro",
                    color: CHART_COLORS.blue,
                    values: meses.map((m) => m.qtd_seguro_sim),
                  },
                  {
                    key: "seguro_nao",
                    label: "Sem seguro",
                    color: CHART_COLORS.orange,
                    values: meses.map((m) => m.qtd_seguro_nao),
                  },
                ]}
                formatValue={(v) => v.toLocaleString("pt-BR")}
              />
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-1">
                <MonthDataRow label="SPF Sim" months={mesesNumeros} values={meses.map((m) => m.qtd_spf_sim)} color={CHART_COLORS.blue} />
                <MonthDataRow label="SPP Sim" months={mesesNumeros} values={meses.map((m) => m.qtd_spp_sim)} color={CHART_COLORS.orange} />
              </div>
            </div>
          </div>
        )}

        {!loading && !error && meses.length > 0 && meses.every((m) => m.qtd_contratos === 0) && (
          <p className="mt-4 text-sm text-zinc-500">Nenhum contrato encontrado no período/filial selecionados.</p>
        )}
      </main>
    </div>
  );
}
