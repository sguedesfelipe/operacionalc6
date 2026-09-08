"use client";

import { useId, useMemo, useState } from "react";
import { MESES_ABREV } from "@/lib/dates";

// Paleta categórica validada (ver skill dataviz) — só modo claro, mesma
// convenção do resto do app (nenhuma tela daqui usa dark mode).
export const CHART_COLORS = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
};

const INK_SECONDARY = "#52514e";
const INK_MUTED = "#898781";
const GRIDLINE = "#e1e0d9";
const BASELINE = "#c3c2b7";
const SURFACE = "#fcfcfb";

function niceMax(rawMax: number): number {
  if (rawMax <= 0) return 1;
  const padded = rawMax * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 2.5) niceNormalized = 2.5;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}

function roundedTopRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + w - radius},${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${y + h} Z`;
}

interface Point {
  mes: number;
  value: number;
}

interface Segment {
  key: string;
  label: string;
  color: string;
}

interface ChartTooltipRow {
  label: string;
  value: string;
  color: string;
}

const CHART_WIDTH = 880;
const CHART_HEIGHT = 260;
const PAD_LEFT = 60;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PLOT_W = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
const BAR_MAX_W = 24;
const GAP = 2;

function Gridlines({ max, formatValue }: { max: number; formatValue: (v: number) => string }) {
  const steps = 4;
  const lines = Array.from({ length: steps + 1 }, (_, i) => i / steps);
  return (
    <g>
      {lines.map((frac) => {
        const y = PAD_TOP + PLOT_H * (1 - frac);
        return (
          <g key={frac}>
            <line
              x1={PAD_LEFT}
              x2={CHART_WIDTH - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke={frac === 0 ? BASELINE : GRIDLINE}
              strokeWidth={1}
            />
            <text x={PAD_LEFT - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={INK_MUTED}>
              {formatValue(max * frac)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XLabels({ months }: { months: number[] }) {
  const bandW = PLOT_W / months.length;
  return (
    <g>
      {months.map((mes, i) => (
        <text
          key={mes}
          x={PAD_LEFT + bandW * (i + 0.5)}
          y={CHART_HEIGHT - 8}
          textAnchor="middle"
          fontSize={11}
          fill={INK_MUTED}
        >
          {MESES_ABREV[mes - 1]}
        </text>
      ))}
    </g>
  );
}

function Legend({ series }: { series: Segment[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5 text-xs text-zinc-600">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function Tooltip({
  x,
  y,
  rows,
  title,
}: {
  x: number;
  y: number;
  rows: ChartTooltipRow[];
  title: string;
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[160px] rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ left: x, top: y, transform: "translate(-50%, calc(-100% - 10px))" }}
    >
      <div className="mb-1 font-semibold text-zinc-900">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-zinc-500">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: r.color }} />
            {r.label}
          </span>
          <span className="font-semibold tabular-nums text-zinc-900">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Barra única por mês, com linha opcional de meta no mesmo eixo (mesma unidade — não é eixo duplo). */
export function BarWithLineChart({
  title,
  subtitle,
  data,
  target,
  color = CHART_COLORS.blue,
  targetColor = CHART_COLORS.orange,
  targetLabel = "Meta",
  formatValue,
  formatTooltipValue,
}: {
  title: string;
  subtitle?: string;
  data: Point[];
  target?: (number | null)[];
  color?: string;
  targetColor?: string;
  targetLabel?: string;
  formatValue: (v: number) => string;
  formatTooltipValue?: (v: number) => string;
}) {
  const formatTooltip = formatTooltipValue ?? formatValue;
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const months = data.map((d) => d.mes);
  const bandW = PLOT_W / Math.max(data.length, 1);
  const barW = Math.min(BAR_MAX_W, bandW * 0.55);

  const maxVal = useMemo(() => {
    const values = data.map((d) => d.value);
    if (target) target.forEach((v) => v != null && values.push(v));
    return niceMax(Math.max(0, ...values));
  }, [data, target]);

  const yFor = (v: number) => PAD_TOP + PLOT_H * (1 - v / maxVal);

  const hasTarget = target && target.some((v) => v != null);
  const linePoints = hasTarget
    ? target!.map((v, i) => (v == null ? null : { x: PAD_LEFT + bandW * (i + 0.5), y: yFor(v) }))
    : [];

  // Desenha a linha em segmentos contínuos, pulando meses sem meta (não conecta através de um gap).
  const lineSegments: string[] = [];
  let current: string[] = [];
  linePoints.forEach((p, i) => {
    if (p) {
      current.push(`${i === 0 || !linePoints[i - 1] ? "M" : "L"}${p.x},${p.y}`);
    } else if (current.length) {
      lineSegments.push(current.join(" "));
      current = [];
    }
  });
  if (current.length) lineSegments.push(current.join(" "));

  const legendSeries: Segment[] = hasTarget
    ? [
        { key: "actual", label: title, color },
        { key: "target", label: targetLabel, color: targetColor },
      ]
    : [];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <Legend series={legendSeries} />
      <div className="relative">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label={title}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <Gridlines max={maxVal} formatValue={formatValue} />
          {data.map((d, i) => {
            const h = PLOT_H * (d.value / maxVal);
            const x = PAD_LEFT + bandW * i + (bandW - barW) / 2;
            const y = PAD_TOP + PLOT_H - h;
            return (
              <g key={d.mes}>
                <rect
                  x={PAD_LEFT + bandW * i}
                  y={PAD_TOP}
                  width={bandW}
                  height={PLOT_H}
                  fill="transparent"
                  style={{ pointerEvents: "all" }}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover((h2) => (h2 === i ? null : h2))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover((h2) => (h2 === i ? null : h2))}
                  tabIndex={0}
                />
                <path d={roundedTopRectPath(x, y, barW, h, 4)} fill={`url(#${gradientId})`} opacity={hover === i ? 1 : 0.92} style={{ pointerEvents: "none" }} />
              </g>
            );
          })}
          {lineSegments.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={targetColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />
          ))}
          {linePoints.map(
            (p, i) =>
              p && (
                <circle key={i} cx={p.x} cy={p.y} r={4} fill={targetColor} stroke={SURFACE} strokeWidth={2} style={{ pointerEvents: "none" }} />
              )
          )}
          <XLabels months={months} />
        </svg>
        {hover !== null && data[hover] && (
          <Tooltip
            x={PAD_LEFT + bandW * (hover + 0.5)}
            y={yFor(data[hover].value)}
            title={MESES_ABREV[data[hover].mes - 1]}
            rows={[
              { label: title, value: formatTooltip(data[hover].value), color },
              ...(hasTarget && target![hover] != null
                ? [{ label: targetLabel, value: formatTooltip(target![hover]!), color: targetColor }]
                : []),
            ]}
          />
        )}
      </div>
    </div>
  );
}

/** Barra empilhada por mês (2-3 séries categóricas). */
export function StackedBarChart({
  title,
  subtitle,
  months,
  series,
  formatValue,
  formatTooltipValue,
}: {
  title: string;
  subtitle?: string;
  months: number[];
  series: (Segment & { values: number[] })[];
  formatValue: (v: number) => string;
  formatTooltipValue?: (v: number) => string;
}) {
  const formatTooltip = formatTooltipValue ?? formatValue;
  const [hover, setHover] = useState<number | null>(null);
  const bandW = PLOT_W / Math.max(months.length, 1);
  const barW = Math.min(BAR_MAX_W, bandW * 0.55);

  const totals = months.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] || 0), 0));
  const maxVal = useMemo(() => niceMax(Math.max(0, ...totals)), [totals]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <Legend series={series} />
      <div className="relative">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label={title}>
          <Gridlines max={maxVal} formatValue={formatValue} />
          {months.map((mes, i) => {
            const x = PAD_LEFT + bandW * i + (bandW - barW) / 2;
            let cumulativeH = 0;
            const segRects = series.map((s, si) => {
              const raw = s.values[i] || 0;
              const h = Math.max(0, PLOT_H * (raw / maxVal) - (si > 0 ? GAP : 0));
              const y = PAD_TOP + PLOT_H - cumulativeH - h;
              cumulativeH += h + (si > 0 ? GAP : 0);
              const isTop = si === series.length - 1;
              return { s, h, y, isTop, raw };
            });
            return (
              <g key={mes}>
                {segRects.map(({ s, h, y, isTop }) =>
                  h > 0 ? (
                    <path
                      key={s.key}
                      d={isTop ? roundedTopRectPath(x, y, barW, h, 4) : `M${x},${y} h${barW} v${h} h${-barW} Z`}
                      fill={s.color}
                      opacity={hover === i ? 1 : 0.92}
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null
                )}
                <rect
                  x={PAD_LEFT + bandW * i}
                  y={PAD_TOP}
                  width={bandW}
                  height={PLOT_H}
                  fill="transparent"
                  style={{ pointerEvents: "all" }}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover((h2) => (h2 === i ? null : h2))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover((h2) => (h2 === i ? null : h2))}
                  tabIndex={0}
                />
              </g>
            );
          })}
          <XLabels months={months} />
        </svg>
        {hover !== null && (
          <Tooltip
            x={PAD_LEFT + bandW * (hover + 0.5)}
            y={PAD_TOP + PLOT_H * (1 - totals[hover] / maxVal)}
            title={MESES_ABREV[months[hover] - 1]}
            rows={[
              ...series.map((s) => ({ label: s.label, value: formatTooltip(s.values[hover] || 0), color: s.color })),
              { label: "Total", value: formatTooltip(totals[hover]), color: INK_SECONDARY },
            ]}
          />
        )}
      </div>
    </div>
  );
}

/** Linha de dados auxiliar (não é gráfico) alinhada aos mesmos meses do eixo X de cima. */
export function MonthDataRow({
  label,
  months,
  values,
  color,
}: {
  label: string;
  months: number[];
  values: number[];
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-zinc-100 px-1 py-2 text-xs first:border-t-0">
      <span className="flex w-32 shrink-0 items-center gap-1.5 text-zinc-600">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
        {label}
      </span>
      <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
        {months.map((mes, i) => (
          <div key={mes} className="text-center tabular-nums text-zinc-800">
            {values[i] ?? 0}
          </div>
        ))}
      </div>
    </div>
  );
}
