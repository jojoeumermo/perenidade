// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, useSyncExternalStore } from "react";
import { faseDaLua, hhmm, sol } from "@/lib/ferramentas/rodada";
import { Bancada, Leitura } from "../../labs/kit";
import { ComoUsar } from "./comum";

const CIDADES: [string, number, number, number][] = [
  ["Belém", -1.46, -48.5, -3], ["Brasília", -15.79, -47.88, -3], ["Cuiabá", -15.6, -56.1, -4], ["Fernando de Noronha", -3.85, -32.42, -2], ["Fortaleza", -3.73, -38.52, -3], ["Manaus", -3.12, -60.02, -4], ["Porto Alegre", -30.03, -51.23, -3], ["Recife", -8.05, -34.88, -3], ["Rio Branco", -9.97, -67.81, -5], ["Rio de Janeiro", -22.91, -43.17, -3], ["Salvador", -12.97, -38.5, -3], ["São Paulo", -23.55, -46.63, -3],
  ["Lisboa", 38.72, -9.14, 0], ["Luanda", -8.84, 13.23, 1], ["Maputo", -25.97, 32.57, 2], ["Pequim", 39.9, 116.4, 8], ["Moscou", 55.76, 37.62, 3],
];

/** A Lua desenhada com a parte iluminada certa. No hemisfério sul, a crescente aparece acesa do lado esquerdo. */
function Lua({ iluminada, crescendo, sul, tamanho = 120 }: { iluminada: number; crescendo: boolean; sul: boolean; tamanho?: number }) {
  const r = 50;
  // Lado aceso: no norte, a crescente é acesa à direita; no sul, à esquerda.
  const direita = crescendo !== sul;
  const k = Math.cos(iluminada * Math.PI); // de 1 (nova) a -1 (cheia): a largura do terminador
  const rx = Math.abs(k) * r;
  const lado = direita ? 1 : 0;
  const bojo = k > 0 ? (direita ? 0 : 1) : direita ? 1 : 0;
  const d = `M 50 0 A ${r} ${r} 0 0 ${lado} 50 100 A ${rx} ${r} 0 0 ${bojo} 50 0 Z`;
  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} role="img" aria-label={`Lua ${Math.round(iluminada * 100)}% iluminada`}>
      <circle cx="50" cy="50" r={r} fill="#2a2a33" />
      <path d={d} fill="#f2ead2" />
    </svg>
  );
}

const nada = () => () => undefined;
// O dia de hoje no relógio do aparelho (não em UTC: perto da meia-noite daria o dia errado).
const hojeTexto = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** O céu de hoje (ou de qualquer dia): fase da Lua, nascer e pôr do Sol, estação do ano. Tudo calculado no aparelho. */
export function Ceu() {
  const hoje = useSyncExternalStore(nada, hojeTexto, () => "2026-01-01");
  const [dataEscolhida, setData] = useState<string | null>(null);
  const [cidade, setCidade] = useState("Rio de Janeiro");
  const data = dataEscolhida ?? hoje;
  const [, lat, lon, fuso] = CIDADES.find((c) => c[0] === cidade)!;
  const dia = new Date(`${data}T12:00:00Z`);
  const lua = faseDaLua(new Date(dia.getTime() - fuso * 3_600_000));
  const s = sol(dia, lat, lon, fuso);
  const sul = lat < 0;
  const mes = dia.getUTCMonth(), d = dia.getUTCDate();
  const quarto = mes < 2 || (mes === 2 && d < 20) || (mes === 11 && d >= 21) ? 0 : mes < 5 || (mes === 5 && d < 21) ? 1 : mes < 8 || (mes === 8 && d < 22) ? 2 : 3;
  const estacao = (sul ? ["verão", "outono", "inverno", "primavera"] : ["inverno", "primavera", "verão", "outono"])[quarto];
  const ano = dia.getUTCFullYear();
  const duracoes = Array.from({ length: 73 }, (_, i) => sol(new Date(Date.UTC(ano, 0, 1 + i * 5)), lat, lon, fuso).duracao);
  const proximos = Array.from({ length: 30 }, (_, i) => { const x = new Date(dia.getTime() + i * 86_400_000); return { x, f: faseDaLua(x) }; });
  return (
    <div>
      <Bancada titulo="O céu do dia" subtitulo="Fase da Lua, nascer e pôr do Sol e as estações">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm font-semibold">Dia<input type="date" value={data} onChange={(e) => setData(e.target.value || null)} className="mt-1 block border-2 border-ink/30 bg-parchment px-2 py-1" /></label>
          <label className="text-sm font-semibold">Cidade<select value={cidade} onChange={(e) => setCidade(e.target.value)} className="mt-1 block border-2 border-ink/30 bg-parchment px-2 py-1.5">{CIDADES.map(([c]) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center rounded-md bg-[#0d0d18] p-4 text-[#f2ead2]">
            <Lua iluminada={lua.iluminada} crescendo={lua.crescendo} sul={sul} tamanho={140} />
            <p className="mt-2 font-serif text-xl">{lua.nome}</p>
            <p className="text-xs">{Math.round(lua.iluminada * 100)}% iluminada · {Math.round(lua.idade)} dias desde a lua nova</p>
          </div>
          <div className="grid content-start gap-2 sm:grid-cols-3">
            <Leitura rotulo="Nascer do Sol" valor={hhmm(s.nascer)} />
            <Leitura rotulo="Pôr do Sol" valor={hhmm(s.por)} />
            <Leitura rotulo="Duração do dia" valor={`${Math.floor(s.duracao)} h ${Math.round((s.duracao % 1) * 60)} min`} />
            <Leitura rotulo="Sol mais alto (meio-dia solar)" valor={hhmm(s.meioDia)} />
            <Leitura rotulo="Altura máxima do Sol" valor={`${Math.round(s.alturaMax)}°`} destaque={s.alturaMax > 85} />
            <Leitura rotulo={`Estação (hemisfério ${sul ? "sul" : "norte"})`} valor={estacao} />
            {s.alturaMax > 85 && <p className="text-xs sm:col-span-3">O Sol passa quase a pino: ao meio-dia solar, a sombra quase some.</p>}
          </div>
        </div>
        <h3 className="mt-6 font-semibold">A duração do dia ao longo de {ano} em {cidade}</h3>
        <svg viewBox="0 0 365 120" className="mt-2 w-full rounded bg-[#17130e]" role="img" aria-label="Gráfico da duração do dia ao longo do ano">
          {[8, 10, 12, 14, 16].map((h) => <g key={h}><line x1="0" x2="365" y1={110 - (h - 7) * 10} y2={110 - (h - 7) * 10} stroke="#ffffff14" /><text x="2" y={108 - (h - 7) * 10} fontSize="8" fill="#9a8f73">{h} h</text></g>)}
          <polyline fill="none" stroke="#ffd27a" strokeWidth="2" points={duracoes.map((h, i) => `${i * 5},${110 - (Math.min(17, Math.max(7, h)) - 7) * 10}`).join(" ")} />
          <line x1={Math.floor((dia.getTime() - Date.UTC(ano, 0, 1)) / 86_400_000)} x2={Math.floor((dia.getTime() - Date.UTC(ano, 0, 1)) / 86_400_000)} y1="0" y2="120" stroke="#c21f16" strokeWidth="2" />
          {["jan", "abr", "jul", "out"].map((m, i) => <text key={m} x={i * 91 + 2} y="118" fontSize="8" fill="#9a8f73">{m}</text>)}
        </svg>
        <h3 className="mt-6 font-semibold">A Lua nos próximos 30 dias</h3>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {proximos.map(({ x, f }) => (
            <div key={x.toISOString()} className="flex shrink-0 flex-col items-center text-[0.6rem]">
              <Lua iluminada={f.iluminada} crescendo={f.crescendo} sul={sul} tamanho={26} />
              <span>{x.getUTCDate()}/{x.getUTCMonth() + 1}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-soft">Cálculos aproximados feitos no aparelho: a fase da Lua pode errar por algumas horas e o nascer e o pôr do Sol, por cerca de um minuto (sem contar morros e prédios). O horário segue o fuso da cidade, sem horário de verão.</p>
      </Bancada>
      <ComoUsar
        passos={["Escolha o dia e a cidade.", "Veja a fase da Lua, a hora do nascer e do pôr do Sol e a estação.", "Compare a duração do dia ao longo do ano no gráfico."]}
        atividades={["Compare Porto Alegre e Belém no dia 21 de junho e no dia 21 de dezembro: onde a duração do dia muda mais? Por quê?", "Escolha um dia de lua cheia e olhe o céu à noite: a que horas ela nasce? Anote e confira no dia seguinte.", "Em Fortaleza ou Recife, procure o dia em que o Sol fica quase a pino. Ponha um lápis em pé ao meio-dia solar e observe a sombra."]}
        revisao
      />
    </div>
  );
}
