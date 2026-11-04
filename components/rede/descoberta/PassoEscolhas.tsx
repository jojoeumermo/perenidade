// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import type { TextosDaDescoberta } from "@/lib/rede/textos-descoberta";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { EstadoDaEntrada, LutaOpcao, TrilhaOpcao } from "@/lib/rede/tipos-descoberta";
import { textoDoErro } from "../erros";

const MAXIMO = 3;

/** O passo "3 lutas + 3 trilhas" (e também a tela de mudar as escolhas, em Explorar). Não pode ser pulado. */
export function PassoEscolhas({
  lang,
  s,
  d,
  inicial,
  aoSalvar,
}: {
  lang: string;
  s: TextosDaRede;
  d: TextosDaDescoberta;
  inicial: EstadoDaEntrada | null;
  aoSalvar: (estado: EstadoDaEntrada) => void;
}) {
  const e = d.entrada.escolhas;
  const [lutas, setLutas] = useState<LutaOpcao[] | null>(null);
  const [trilhas, setTrilhas] = useState<TrilhaOpcao[] | null>(null);
  const [trilhasFalhou, setTrilhasFalhou] = useState(false);
  const [lutasEscolhidas, setLutasEscolhidas] = useState<string[]>(inicial?.lutas ?? []);
  const [trilhasEscolhidas, setTrilhasEscolhidas] = useState<string[]>(inicial?.trilhas ?? []);
  const [aparece, setAparece] = useState(Boolean(inicial?.aparece));
  const [filtro, setFiltro] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    redeDescoberta
      .opcoes()
      .then((r) => vivo && setLutas(r.lutas))
      .catch((x) => {
        if (!vivo) return;
        setLutas([]);
        setErro(textoDoErro(s, x));
      });
    return () => {
      vivo = false;
    };
  }, [s]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/rede/trilhas/${encodeURIComponent(lang)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ trilhas: TrilhaOpcao[] }>) : Promise.reject(new Error("falha"))))
      .then((r) => vivo && (setTrilhas(r.trilhas), setTrilhasFalhou(false)))
      .catch(() => vivo && (setTrilhas([]), setTrilhasFalhou(true)));
    return () => {
      vivo = false;
    };
  }, [lang, tentativa]);

  const lutasNecessarias = lutas ? Math.min(MAXIMO, lutas.length) : MAXIMO;
  const trilhasNecessarias = trilhas && trilhas.length > 0 ? Math.min(MAXIMO, trilhas.length) : MAXIMO;
  const visiveis = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return (trilhas ?? []).filter((t) => !f || t.titulo.toLowerCase().includes(f) || t.area.includes(f)).slice(0, 80);
  }, [trilhas, filtro]);

  const alternar = (lista: string[], valor: string, mudar: (x: string[]) => void) =>
    mudar(lista.includes(valor) ? lista.filter((x) => x !== valor) : lista.length >= MAXIMO ? lista : [...lista, valor]);

  const pronto = lutas !== null && trilhas !== null && lutasEscolhidas.length === lutasNecessarias && trilhasEscolhidas.length === trilhasNecessarias && trilhas.length > 0;

  async function salvar() {
    setOcupado(true);
    setErro("");
    try {
      aoSalvar(await redeDescoberta.escolher(lutasEscolhidas, trilhasEscolhidas, aparece));
    } catch (x) {
      setErro(textoDoErro(s, x) || d.entrada.erro);
    } finally {
      setOcupado(false);
    }
  }

  const caixa = (marcado: boolean, desabilitado: boolean) =>
    `flex min-h-11 w-full cursor-pointer items-start gap-2 rounded-lg border-[1.5px] p-2 text-left ${marcado ? "border-[#c21f16] bg-parchment-deep font-bold" : "border-rule hover:border-ink"} ${desabilitado ? "cursor-not-allowed opacity-50" : ""}`;

  return (
    <div className="space-y-5 font-sans">
      <h2 className="font-serif text-xl font-semibold">{e.titulo}</h2>
      <p className="text-ink-soft">{d.entrada.escolhas.texto}</p>

      <fieldset>
        <legend className="font-bold">
          {e.lutas} <span className="font-normal text-ink-soft">({preencher(e.contador, { n: lutasEscolhidas.length, max: lutasNecessarias })})</span>
        </legend>
        {lutas === null ? (
          <p className="mt-2 text-ink-soft">{d.estados.carregando}</p>
        ) : lutas.length === 0 ? (
          <p className="mt-2 text-ink-soft">{e.lutasVazio}</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {lutas.map((l) => {
              const marcado = lutasEscolhidas.includes(l.slug);
              const bloqueado = !marcado && lutasEscolhidas.length >= MAXIMO;
              return (
                <li key={l.slug}>
                  <label className={caixa(marcado, bloqueado)}>
                    <input type="checkbox" checked={marcado} disabled={bloqueado} onChange={() => alternar(lutasEscolhidas, l.slug, setLutasEscolhidas)} className="mt-1 h-5 w-5" />
                    <span>
                      {l.nome}
                      {l.descricao && <span className="block text-sm font-normal text-ink-soft">{l.descricao}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <fieldset>
        <legend className="font-bold">
          {e.trilhas} <span className="font-normal text-ink-soft">({preencher(e.contador, { n: trilhasEscolhidas.length, max: trilhasNecessarias })})</span>
        </legend>
        {trilhas === null ? (
          <p className="mt-2 text-ink-soft">{e.trilhasCarregando}</p>
        ) : trilhasFalhou ? (
          <div className="mt-2" role="alert">
            <p className="text-oxblood">{e.trilhasFalha}</p>
            <button type="button" onClick={() => setTentativa((n) => n + 1)} className="mt-2 min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-4 font-bold hover:bg-parchment-deep">
              {d.estados.tentar}
            </button>
          </div>
        ) : (
          <>
            <label className="mt-2 block">
              <span className="sr-only">{e.filtro}</span>
              <input type="search" value={filtro} onChange={(x) => setFiltro(x.target.value)} placeholder={e.filtro} className="min-h-11 w-full rounded-md border border-rule bg-folha px-3" />
            </label>
            <ul className="mt-2 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
              {visiveis.map((t) => {
                const marcado = trilhasEscolhidas.includes(t.slug);
                const bloqueado = !marcado && trilhasEscolhidas.length >= MAXIMO;
                return (
                  <li key={t.slug}>
                    <label className={caixa(marcado, bloqueado)}>
                      <input type="checkbox" checked={marcado} disabled={bloqueado} onChange={() => alternar(trilhasEscolhidas, t.slug, setTrilhasEscolhidas)} className="mt-1 h-5 w-5" />
                      <span>{t.titulo}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={aparece} onChange={(x) => setAparece(x.target.checked)} className="mt-1 h-5 w-5" />
        <span>{e.aparecer}</span>
      </label>

      {erro && (
        <p role="alert" className="text-oxblood">
          {erro}
        </p>
      )}
      <button type="button" disabled={!pronto || ocupado} onClick={() => void salvar()} className="min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14] disabled:cursor-not-allowed disabled:opacity-50">
        {ocupado ? d.estados.carregando : e.salvar}
      </button>
    </div>
  );
}
