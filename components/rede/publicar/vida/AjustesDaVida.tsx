// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { redePub } from "@/lib/rede/cliente-publicar";
import { preencher } from "@/lib/rede/preencher";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { avisoDeOfensaLigado, leiaAntesLigado, marcarAvisoDeOfensa, marcarLeiaAntes, SEMANAS_DA_CONTA } from "@/lib/rede/publicar/vida";
import type { PaginaDeArquivados } from "@/lib/rede/tipos-publicar";
import type { ContextoDoEncaixe } from "../../encaixes";
import { faltaNoBanco } from "../alumia2/CartaoDaAlumia2";
import { Icone } from "../alumia2/icones";
import { esquecerVida } from "./carregar";
import { useTextosDaVida, type TextosDaVida } from "./textos";

/** "1 semana", "4 semanas", "1 ano": o prazo como a pessoa lê. */
function nomeDoPrazo(t: TextosDaVida, semanas: number): string {
  return semanas === 1 ? t.ajustes.umaSemana : semanas === 52 ? t.ajustes.umAno : preencher(t.ajustes.semanas, { n: semanas });
}

/**
 * Ajustes → Vida dos posts: apagar meus posts depois de X semanas (a tela diz quantos saem antes de ligar), as duas escolhas deste
 * aparelho (aviso antes de publicar palavra que costuma ferir; perguntar antes de repostar link que não abri) e os arquivados, com
 * Desarquivar. Na prévia (sem banco), o apagar e os arquivados ficam de fora: só as escolhas do aparelho aparecem.
 */
export function AjustesDaVida({ lang }: ContextoDoEncaixe) {
  const t = useTextosDaVida(lang);
  const id = useId();
  const previa = previaLigada();
  const [ofensa, setOfensa] = useState(true);
  const [leia, setLeia] = useState(true);
  useEffect(() => {
    // Lido depois de montar: o servidor não sabe o que este aparelho guardou.
    const x = window.setTimeout(() => {
      setOfensa(avisoDeOfensaLigado());
      setLeia(leiaAntesLigado());
    }, 0);
    return () => window.clearTimeout(x);
  }, []);
  if (!t) return null;
  return (
    <div className="space-y-6">
      {!previa && <ApagarDepois t={t} />}
      <fieldset className="space-y-3">
        <legend className="sr-only">{t.ajustes.titulo}</legend>
        <label className="al2-opcao-b1">
          <input
            type="checkbox"
            role="switch"
            className="al2-caixinha"
            checked={ofensa}
            aria-describedby={`${id}-ofensa`}
            onChange={(e) => {
              marcarAvisoDeOfensa(e.target.checked);
              setOfensa(e.target.checked);
            }}
          />
          <span className="min-w-0">
            <span className="block font-bold">{t.ajustes.ofensa}</span>
            <span id={`${id}-ofensa`} className="block text-xs text-[var(--al-texto-3)]">
              {t.ajustes.ofensaAjuda}
            </span>
          </span>
        </label>
        <label className="al2-opcao-b1">
          <input
            type="checkbox"
            role="switch"
            className="al2-caixinha"
            checked={leia}
            aria-describedby={`${id}-leia`}
            onChange={(e) => {
              marcarLeiaAntes(e.target.checked);
              setLeia(e.target.checked);
            }}
          />
          <span className="min-w-0">
            <span className="block font-bold">{t.ajustes.leia}</span>
            <span id={`${id}-leia`} className="block text-xs text-[var(--al-texto-3)]">
              {t.ajustes.leiaAjuda}
            </span>
          </span>
        </label>
      </fieldset>
      {!previa && <Arquivados t={t} lang={lang} />}
    </div>
  );
}

/** Apagar meus posts depois de X semanas: escolher, ver quantos saem, confirmar. */
function ApagarDepois({ t }: { t: TextosDaVida }) {
  const id = useId();
  const [atual, setAtual] = useState<number | null | undefined>(undefined);
  const [escolha, setEscolha] = useState<number>(0);
  const [pergunta, setPergunta] = useState<{ semanas: number; posts: number } | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    redePub.vidaDaConta().then(
      (r) => {
        if (!vivo) return;
        setAtual(r.semanas);
        setEscolha(r.semanas ?? 0);
      },
      (e) => vivo && (setAtual(null), setErro(faltaNoBanco(e) ? t.ajustes.indisponivel : t.ajustes.erro)),
    );
    return () => {
      vivo = false;
    };
  }, [t]);

  async function escolher(semanas: number) {
    setEscolha(semanas);
    setErro("");
    setPergunta(null);
    if (semanas === (atual ?? 0)) return;
    if (semanas === 0) return void salvar(0);
    setOcupado(true);
    try {
      setPergunta(await redePub.vidaDaContaPrevia(semanas));
    } catch (e) {
      setErro(faltaNoBanco(e) ? t.ajustes.indisponivel : t.ajustes.erro);
      setEscolha(atual ?? 0);
    } finally {
      setOcupado(false);
    }
  }

  async function salvar(semanas: number) {
    setOcupado(true);
    setErro("");
    try {
      const r = await redePub.mudarVidaDaConta(semanas);
      setAtual(r.semanas);
      setEscolha(r.semanas ?? 0);
      setPergunta(null);
    } catch (e) {
      setErro(faltaNoBanco(e) ? t.ajustes.indisponivel : t.ajustes.erro);
      setEscolha(atual ?? 0);
    } finally {
      setOcupado(false);
    }
  }

  const prazo = pergunta ? nomeDoPrazo(t, pergunta.semanas) : "";
  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-prazo`} className="block font-bold">
        {t.ajustes.apagarTitulo}
      </label>
      <p id={`${id}-ajuda`} className="text-xs text-[var(--al-texto-3)]">
        {t.ajustes.apagarAjuda}
      </p>
      <select
        id={`${id}-prazo`}
        className="al2-campo min-h-11 w-full max-w-xs"
        value={escolha}
        disabled={atual === undefined || ocupado || Boolean(pergunta)}
        aria-describedby={`${id}-ajuda ${id}-estado`}
        onChange={(e) => void escolher(Number(e.target.value))}
      >
        <option value={0}>{t.ajustes.nunca}</option>
        {SEMANAS_DA_CONTA.map((n) => (
          <option key={n} value={n}>
            {nomeDoPrazo(t, n)}
          </option>
        ))}
      </select>
      {pergunta && (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--al-vermelho)_45%,transparent)] bg-[color-mix(in_srgb,var(--al-vermelho)_8%,var(--al-superficie))] p-3" role="alertdialog" aria-labelledby={`${id}-pergunta`} onKeyDown={(e) => { if (e.key === "Escape" && !ocupado) { setPergunta(null); setEscolha(atual ?? 0); } }}>
          <p id={`${id}-pergunta`} className="text-sm font-semibold text-[var(--al-texto)]">
            {pergunta.posts === 0
              ? preencher(t.ajustes.confirmarNenhum, { prazo })
              : pergunta.posts === 1
                ? preencher(t.ajustes.confirmarUm, { prazo })
                : preencher(t.ajustes.confirmar, { n: pergunta.posts, prazo })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={ocupado} onClick={() => void salvar(pergunta.semanas)}>
              {t.ajustes.ligar}
            </button>
            <button
              type="button"
              className="al-botao al-botao-contorno al-botao-p"
              onClick={() => {
                setPergunta(null);
                setEscolha(atual ?? 0);
              }}
            >
              {t.ajustes.cancelar}
            </button>
          </div>
        </div>
      )}
      <p id={`${id}-estado`} role="status" className="text-sm text-[var(--al-texto-2)]">
        {atual === undefined ? "" : atual ? preencher(t.ajustes.ligado, { prazo: nomeDoPrazo(t, atual) }) : t.ajustes.desligado}
      </p>
      {erro && (
        <p role="alert" className="text-sm font-semibold text-[var(--al-vermelho)]">
          {erro}
        </p>
      )}
    </div>
  );
}

/** Os meus arquivados: só eu vejo. Desarquivar devolve o post a quem via. */
function Arquivados({ t, lang }: { t: TextosDaVida; lang: string }) {
  const [pagina, setPagina] = useState<PaginaDeArquivados | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(
    async (antes: string | null) => {
      setErro("");
      try {
        const r = await redePub.arquivados(antes);
        setPagina((p) => (antes && p ? { itens: [...p.itens, ...r.itens], proximo: r.proximo } : r));
      } catch (e) {
        setErro(faltaNoBanco(e) ? t.ajustes.indisponivel : t.ajustes.erro);
        setPagina((p) => p ?? { itens: [], proximo: null });
      }
    },
    [t],
  );
  useEffect(() => {
    const x = window.setTimeout(() => void carregar(null), 0);
    return () => window.clearTimeout(x);
  }, [carregar]);

  async function desarquivar(id: string) {
    setOcupado(id);
    try {
      await redePub.arquivar(id, false);
      esquecerVida(id);
      setPagina((p) => (p ? { ...p, itens: p.itens.filter((x) => x.id !== id) } : p));
    } catch (e) {
      setErro(faltaNoBanco(e) ? t.ajustes.indisponivel : t.ajustes.erro);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="space-y-2" aria-labelledby="al2-arquivados">
      <h3 id="al2-arquivados" className="al-cond text-lg font-black uppercase tracking-wide">
        {t.ajustes.arquivados}
      </h3>
      <p className="text-xs text-[var(--al-texto-3)]">{t.ajustes.arquivadosAjuda}</p>
      {pagina === null ? (
        <p className="text-sm text-[var(--al-texto-3)]" role="status">
          {t.ajustes.carregando}
        </p>
      ) : pagina.itens.length === 0 && !erro ? (
        <p className="text-sm text-[var(--al-texto-2)]">{t.ajustes.arquivadosVazio}</p>
      ) : (
        <ul className="divide-y divide-[var(--al-linha)] rounded-xl border border-[var(--al-superficie-2)]">
          {pagina.itens.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <Icone nome="pasta" className="h-5 w-5 shrink-0 text-[var(--al-texto-3)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-[var(--al-texto)]">{p.titulo || p.texto}</span>
                <time className="block text-xs text-[var(--al-texto-3)]" dateTime={p.criado_em}>
                  {new Date(p.criado_em).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" })}
                </time>
              </span>
              <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado === p.id} onClick={() => void desarquivar(p.id)}>
                {t.cartao.desarquivar}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pagina?.proximo && (
        <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => void carregar(pagina.proximo)}>
          {t.ajustes.mais}
        </button>
      )}
      {erro && (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--al-vermelho)]">
          {erro}
          <button type="button" className="al2-acao" onClick={() => void carregar(null)}>
            {t.ajustes.tentar}
          </button>
        </p>
      )}
    </section>
  );
}
