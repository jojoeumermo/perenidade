// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { Star } from "../Masthead";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, papeis, rotulo, useAcao, useLista } from "./comum";

interface AvisoGeral {
  id: string;
  titulo: string;
  texto: string;
  autor: string;
  importante: boolean;
  para: string[];
  criado_em: string;
  expira_em?: string;
  vistos?: number;
}

/** Para quem um aviso pode ir: a equipe do podcast e cada função. */
const destinos: [string, string][] = [["podcast", "Equipe do podcast"], ...(Object.entries(papeis) as [string, string][]).filter(([id]) => id !== "coordenacao")];
const nomeDoDestino = (id: string) => destinos.find(([chave]) => chave === id)?.[1] ?? id;
const prazos = [1, 3, 7, 14, 30, 60];

function Quadro({ aviso, restantes, fechar, ocupado }: { aviso: AvisoGeral; restantes: number; fechar?: () => void; ocupado?: boolean }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={`aviso-${aviso.id}`} className="painel-ir flex max-h-full w-full max-w-lg flex-col border-2 border-ink bg-parchment text-ink shadow-[8px_8px_0_#6e1f1a]">
      <div className={`flex items-center justify-between gap-3 px-5 py-2.5 text-parchment ${aviso.importante ? "bg-[#c21f16]" : "bg-ink"}`}>
        <span className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.25em]">
          <Star className="h-3.5 w-3.5" />
          {aviso.importante ? "Aviso importante" : "Aviso à equipe"}
        </span>
        <span className="flex items-center gap-3">
          <span className="font-mono text-[0.65rem] text-[#f0cf8e]">{aviso.para.length === 0 ? "toda a equipe" : aviso.para.map(nomeDoDestino).join(" · ")}</span>
          {fechar && (
            <button type="button" onClick={fechar} disabled={ocupado} aria-label="Fechar o aviso" title="Fechar" className="-mr-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-xl leading-none hover:text-[#f0cf8e] disabled:opacity-50">
              ✕
            </button>
          )}
        </span>
      </div>
      {/* Aviso longo no celular: o texto rola dentro do quadro, e o cabeçalho (com o ✕) e o "Entendi" ficam à vista. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <h2 id={`aviso-${aviso.id}`} className="font-serif text-3xl font-semibold leading-tight">{aviso.titulo}</h2>
        <p className="mt-3 whitespace-pre-line text-base leading-relaxed" data-original>{aviso.texto}</p>
        <p className="mt-4 text-xs text-ink-soft">
          {aviso.autor || "Coordenação"} · {dataHora(aviso.criado_em)}
        </p>
      </div>
      {fechar && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-3">
          <span className="text-xs text-ink-soft">{restantes > 1 ? `Mais ${restantes} avisos depois deste.` : restantes === 1 ? "Mais 1 aviso depois deste." : "Último aviso."}</span>
          <button type="button" className={botao} disabled={ocupado} onClick={fechar} autoFocus>
            Entendi
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * O quadro que aparece por cima do painel quando a coordenação, a vice-coordenação ou a supervisão mandam um aviso.
 * Chega na hora pelo canal de tempo real (e, por garantia, de minuto em minuto). Some quando a pessoa aperta "Entendi".
 */
export function QuadroDeAvisos() {
  const lista = useLista<AvisoGeral[]>("avisos_gerais_pendentes");
  const { recarregar } = lista;
  const acao = useAcao(recarregar);
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 60_000);
    return () => window.clearInterval(relogio);
  }, [recarregar]);
  const atual = lista.dados?.[0];
  if (!atual) return null;
  return (
    <div className="painel-veu fixed inset-0 z-50 flex items-center justify-center bg-[#17130e]/70 px-3 py-[max(1rem,env(safe-area-inset-top))]">
      <Quadro aviso={atual} restantes={(lista.dados?.length ?? 1) - 1} ocupado={acao.ocupado} fechar={() => void acao.agir("aviso_geral_fechar", { p_id: atual.id }, "")} />
    </div>
  );
}

/** A seção do painel para quem manda avisos: escrever um, ver quem já fechou os que estão no ar e apagar. */
export function AvisosEquipe() {
  const lista = useLista<AvisoGeral[]>("avisos_gerais_listar");
  const acao = useAcao(lista.recarregar);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [todos, setTodos] = useState(true);
  const [para, setPara] = useState<string[]>([]);
  const [importante, setImportante] = useState(false);
  const [dias, setDias] = useState(14);
  const pronto = titulo.trim().length >= 2 && texto.trim().length >= 2 && (todos || para.length > 0);

  async function enviar() {
    const ok = await acao.agir(
      "aviso_geral_enviar",
      { p: { titulo, texto, para: todos ? [] : para, importante, dias } },
      "Aviso enviado. Aparece na hora para quem está com o painel aberto e, para os outros, assim que entrarem.",
    );
    if (ok) {
      setTitulo("");
      setTexto("");
      setImportante(false);
    }
  }

  const previa: AvisoGeral = { id: "previa", titulo: titulo || "Título do aviso", texto: texto || "O texto do aviso aparece aqui, como um quadro por cima do painel de cada pessoa.", autor: "você", importante, para: todos ? [] : para, criado_em: new Date().toISOString() };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <p className="max-w-2xl text-ink-soft">
          O aviso aparece como um quadro por cima do painel, para toda a equipe ou só para algumas funções, até a pessoa apertar “Entendi”. Para recado a uma pessoa só, use as Conversas.
        </p>
        <label className="block">
          Título
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} required className={campo} />
        </label>
        <label className="block">
          Texto
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={2000} required className={campo} />
        </label>
        <fieldset>
          <legend className={rotulo}>Para quem</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" checked={todos} onChange={() => setTodos(true)} /> Toda a equipe
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={!todos} onChange={() => setTodos(false)} /> Só algumas funções
            </label>
          </div>
          {!todos && (
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {destinos.map(([id, nome]) => (
                <li key={id}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={para.includes(id)} onChange={(e) => setPara(e.target.checked ? [...para, id] : para.filter((x) => x !== id))} />
                    {nome}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <div className="flex flex-wrap items-end gap-5">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={importante} onChange={(e) => setImportante(e.target.checked)} /> Importante (quadro vermelho)
          </label>
          <label className="block">
            Fica no ar por
            <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={campo}>
              {prazos.map((n) => (
                <option key={n} value={n}>{n === 1 ? "1 dia" : `${n} dias`}</option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className={botao} disabled={acao.ocupado || !pronto}>Enviar o aviso</button>
        <Aviso texto={acao.aviso || lista.erro} />

        <section className="pt-4">
          <h2 className="jornal-secao">
            <span className="jornal-editoria">No ar</span>
          </h2>
          {lista.dados?.length === 0 && <p className="mt-4 text-ink-soft">Nenhum aviso no ar.</p>}
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {lista.dados?.map((aviso) => (
              <li key={aviso.id} className="py-3">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <strong className="font-serif text-lg">{aviso.titulo}</strong>
                  {aviso.importante && <span className="bg-[#c21f16] px-1.5 py-0.5 font-mono text-[0.65rem] uppercase text-white">importante</span>}
                  <span className="text-xs text-ink-soft">{aviso.para.length === 0 ? "toda a equipe" : aviso.para.map(nomeDoDestino).join(", ")}</span>
                </p>
                <p className="mt-1 line-clamp-2 text-ink-soft">{aviso.texto}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-soft">
                  <span>{aviso.autor} · {dataHora(aviso.criado_em)}</span>
                  <span>{aviso.vistos ?? 0} {aviso.vistos === 1 ? "pessoa fechou" : "pessoas fecharam"}</span>
                  {aviso.expira_em && <span>sai do ar em {dataHora(aviso.expira_em)}</span>}
                  <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm("Tirar este aviso do ar?")) void acao.agir("aviso_geral_apagar", { p_id: aviso.id }, "Aviso retirado."); }}>
                    Tirar do ar
                  </button>
                </p>
              </li>
            ))}
          </ul>
        </section>
      </form>
      <aside>
        <p className={`${rotulo} mb-3`}>Como vai aparecer</p>
        <Quadro aviso={previa} restantes={0} />
        <p className="mt-4 text-xs text-ink-soft">
          <button type="button" className={botaoClaro} onClick={() => { setTitulo(""); setTexto(""); }}>Limpar</button>
        </p>
      </aside>
    </div>
  );
}
