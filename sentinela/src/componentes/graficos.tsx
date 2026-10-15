// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// Gráficos: linha de 2px, barras de até 24px com a ponta arredondada e um vão de 2px entre séries, grade fina,
// tooltip com todas as séries no mesmo X, legenda sempre que há duas séries. Cores das séries validadas (estilos.css).
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { hora, numero } from "../lib/formato.ts";

const serie = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)"];

interface Ponto {
  em: string;
  [k: string]: number | string | boolean | null | undefined;
}

function Dica({ active, payload, label, nomes }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string; dataKey?: string }[]; label?: string; nomes?: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  const quando = typeof label === "string" && /T/.test(label) ? new Date(label).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : String(label ?? "");
  return (
    <div className="dica">
      <p className="mono text-[0.65rem] text-ink-soft">{quando}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="mt-0.5 flex items-center gap-2">
          <span aria-hidden className="inline-block h-0.5 w-3" style={{ background: p.color }} />
          <strong className="mono">{typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}</strong>
          <span className="text-ink-soft">{nomes?.[String(p.dataKey)] ?? p.name}</span>
        </p>
      ))}
    </div>
  );
}

const eixoX = (dados: Ponto[]) => ({ dataKey: "em", tickFormatter: (v: string) => (dados.length > 48 ? hora(v) : hora(v)), minTickGap: 40, tickLine: false, axisLine: { stroke: "var(--rule)" } });

/** Linha única (tempo de resposta, nota). */
export function Linha({ dados, chave, nome, altura = 180, unidade = "" }: { dados: Ponto[]; chave: string; nome: string; altura?: number; unidade?: string }) {
  if (!dados.length) return <p className="font-sans text-sm text-ink-soft">Sem dados ainda.</p>;
  return (
    <div style={{ height: altura }} role="img" aria-label={`${nome}: ${dados.length} pontos`}>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeWidth={1} />
          <XAxis {...eixoX(dados)} />
          <YAxis tickFormatter={(v: number) => `${numero(v)}${unidade}`} tickLine={false} axisLine={false} width={56} />
          <Tooltip content={<Dica nomes={{ [chave]: nome }} />} cursor={{ stroke: "var(--ink-soft)", strokeWidth: 1 }} />
          <Line type="monotone" dataKey={chave} stroke={serie[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--parchment)", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Duas ou três linhas no mesmo eixo (um eixo só, sempre). */
export function Linhas({ dados, series, altura = 200 }: { dados: Ponto[]; series: { chave: string; nome: string }[]; altura?: number }) {
  if (!dados.length) return <p className="font-sans text-sm text-ink-soft">Sem dados ainda.</p>;
  const nomes = Object.fromEntries(series.map((s) => [s.chave, s.nome]));
  return (
    <div style={{ height: altura }} role="img" aria-label={series.map((s) => s.nome).join(", ")}>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeWidth={1} />
          <XAxis {...eixoX(dados)} />
          <YAxis tickFormatter={(v: number) => numero(v)} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<Dica nomes={nomes} />} cursor={{ stroke: "var(--ink-soft)", strokeWidth: 1 }} />
          <Legend iconType="plainline" wrapperStyle={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--ink)" }} />
          {series.map((s, i) => <Line key={s.chave} type="monotone" dataKey={s.chave} name={s.nome} stroke={serie[i % 3]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--parchment)", strokeWidth: 2 }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras lado a lado (requisições vs. bloqueios). */
export function Barras({ dados, series, altura = 200, eixo = "em" }: { dados: Ponto[]; series: { chave: string; nome: string }[]; altura?: number; eixo?: string }) {
  if (!dados.length) return <p className="font-sans text-sm text-ink-soft">Sem dados ainda.</p>;
  const nomes = Object.fromEntries(series.map((s) => [s.chave, s.nome]));
  return (
    <div style={{ height: altura }} role="img" aria-label={series.map((s) => s.nome).join(" e ")}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid vertical={false} strokeWidth={1} />
          <XAxis dataKey={eixo} tickFormatter={(v: string) => (/T/.test(v) ? hora(v) : v)} minTickGap={40} tickLine={false} axisLine={{ stroke: "var(--rule)" }} />
          <YAxis tickFormatter={(v: number) => numero(v)} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<Dica nomes={nomes} />} cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }} />
          {series.length > 1 && <Legend iconType="rect" wrapperStyle={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--ink)" }} />}
          {series.map((s, i) => <Bar key={s.chave} dataKey={s.chave} name={s.nome} fill={serie[i % 3]} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontais de um valor só (países, caminhos, regras). */
export function BarrasHorizontais({ dados, rotulo, valor, maximo = 10 }: { dados: Record<string, unknown>[]; rotulo: string; valor: string; maximo?: number }) {
  const lista = dados.slice(0, maximo);
  const maior = Math.max(1, ...lista.map((d) => Number(d[valor] ?? 0)));
  if (!lista.length) return <p className="font-sans text-sm text-ink-soft">Sem dados ainda.</p>;
  return (
    <ul className="space-y-1.5 font-sans text-xs">
      {lista.map((d) => (
        <li key={String(d[rotulo])} className="grid grid-cols-[minmax(0,1fr)_3fr_auto] items-center gap-2">
          <span className="truncate" title={String(d[rotulo])}>{String(d[rotulo])}</span>
          <span className="h-3 bg-[color-mix(in_srgb,var(--serie-1)_18%,transparent)]">
            <span className="block h-full" style={{ width: `${(Number(d[valor]) / maior) * 100}%`, background: "var(--serie-1)" }} />
          </span>
          <span className="mono text-right">{numero(Number(d[valor]))}</span>
        </li>
      ))}
    </ul>
  );
}

/** Medidor da postura, com a escala visível e o número. */
export function Medidor({ valor, maximo = 100 }: { valor: number; maximo?: number }) {
  return (
    <div className="medidor" role="meter" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={maximo}>
      <span style={{ width: `${Math.max(0, Math.min(100, (valor / maximo) * 100))}%` }} />
    </div>
  );
}

/** Mini linha de tendência, sem eixos. */
export function Faisca({ dados, chave, largura = 120, altura = 28 }: { dados: Ponto[]; chave: string; largura?: number; altura?: number }) {
  const valores = dados.map((d) => Number(d[chave] ?? 0));
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const pontos = valores.map((v, i) => `${(i / (valores.length - 1)) * largura},${altura - ((v - min) / Math.max(1, max - min)) * (altura - 4) - 2}`).join(" ");
  return (
    <svg aria-hidden width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`}>
      <polyline points={pontos} fill="none" stroke="var(--serie-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
