// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que as partes de Descobrir e Estudar (Prompt 4, lote descoberta e estudo) dividem: os textos do pacote, a frase do erro, a
// leitura com recarga, a ação com mensagem e a moldura das abas. Nada aqui guarda coisa no aparelho nem fala com outro endereço.
import "./de.css";
import { useCallback, useEffect, useId, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import { BackendError } from "@/lib/backend";
import { carregarPronto } from "@/lib/rede/textos-prontos";
import { criarUsoDeTextos } from "../mapa/comum";
import { FaixaDaPrevia, useTextosAlumia3 } from "../conversa/base3";
import { Faixa } from "../ui/Faixa";
import type pt from "../../../i18n/rede/p4-descoberta-estudo/pt.json";

export type T = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/p4-descoberta-estudo/pt.json"),
  en: () => import("../../../i18n/rede/p4-descoberta-estudo/en.json"),
  es: () => import("../../../i18n/rede/p4-descoberta-estudo/es.json"),
  fr: () => import("../../../i18n/rede/p4-descoberta-estudo/fr.json"),
  ru: () => import("../../../i18n/rede/p4-descoberta-estudo/ru.json"),
  zh: () => import("../../../i18n/rede/p4-descoberta-estudo/zh.json"),
};
export const useTextosDE = criarUsoDeTextos(async (lang: string) => (await carregarPronto(CARREGAR, lang)) as T);

/** A frase de um erro do banco: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function fraseDoErro(t: T, e: unknown): string {
  const codigo = e instanceof BackendError ? e.code : e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  const erros = t.erros as Record<string, string>;
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? t.erros.outro;
}

/** O que cada parte recebe da tela. */
export interface PropsDaParte {
  t: T;
  lang: string;
}

/** Uma leitura do banco que recarrega quando a chave muda ou quando se pede de novo. Chave nula: não lê. */
export function useLeitura<X>(chave: string | null, ler: () => Promise<X>) {
  const [estado, setEstado] = useState<{ chave: string; vez: number; dado: X | null; erro: unknown } | null>(null);
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (chave === null) return;
    let vivo = true;
    const k = chave, n = vez;
    ler().then(
      (dado) => vivo && setEstado({ chave: k, vez: n, dado, erro: null }),
      (erro: unknown) => vivo && setEstado({ chave: k, vez: n, dado: null, erro }),
    );
    return () => {
      vivo = false;
    };
    // A chave decide a leitura; a função muda a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, vez]);
  const recarregar = useCallback(() => setVez((v) => v + 1), []);
  const atual = estado && estado.chave === chave ? estado : null;
  return { dado: atual?.dado ?? null, erro: atual?.erro ?? null, carregando: !atual || atual.vez !== vez, recarregar };
}

/** Uma ação com "ocupado" e a mensagem do fim (ou do erro). Devolver nulo da ação: nada a dizer. */
export function useAcao(t: T, depois: () => void = () => undefined) {
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const fazer = async (acao: () => Promise<string | null>): Promise<boolean> => {
    setOcupado(true);
    setMensagem(null);
    try {
      const ok = await acao();
      if (ok) setMensagem({ texto: ok, erro: false });
      depois();
      return ok !== null;
    } catch (e) {
      setMensagem({ texto: fraseDoErro(t, e), erro: true });
      return false;
    } finally {
      setOcupado(false);
    }
  };
  const avisar = (texto: string, erro = true) => setMensagem({ texto, erro });
  return { ocupado, mensagem, fazer, avisar };
}

/** A mensagem do fim de uma ação: "status" quando deu certo, "alert" quando não. */
export function Mensagem({ mensagem }: { mensagem: { texto: string; erro: boolean } | null }) {
  if (!mensagem) return null;
  return <p className={mensagem.erro ? "de-erro" : "de-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>;
}

/** Troca {chave} pelo valor. */
export function por(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}

/** Uma aba de uma tela com abas: a chave do texto e a parte. */
export interface AbaDaTela<K extends string> {
  chave: K;
  Parte: ComponentType<PropsDaParte>;
}

/** A moldura de Descobrir e de Estudar: cabeçalho, o que fica com quem e as abas (setas andam entre elas, padrão WAI-ARIA). */
export function TelaComAbas<K extends string>({ lang, t, cabeca, abas, rotulos, rotuloDasAbas }: {
  lang: string;
  t: T;
  cabeca: { carimbo: string; titulo: string; chamada: string };
  abas: readonly AbaDaTela<K>[];
  rotulos: Record<K, string>;
  rotuloDasAbas: string;
}) {
  const id = useId();
  const t3 = useTextosAlumia3(lang);
  const [aba, setAba] = useState<K | null>(abas[0]?.chave ?? null);
  const atual = abas.find((a) => a.chave === aba) ?? abas[0] ?? null;
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = abas.findIndex((a) => a.chave === aba);
    const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const proxima = abas[(i + passo + abas.length) % abas.length].chave;
    setAba(proxima);
    document.getElementById(`${id}-aba-${proxima}`)?.focus();
  };
  return (
    <article className="de-pagina" aria-labelledby={`${id}-titulo`}>
      {t3 && <FaixaDaPrevia t={t3} />}
      <header className="de-cabeca">
        <Faixa className="de-faixa" />
        <p className="de-carimbo al-cond">{cabeca.carimbo}</p>
        <h1 id={`${id}-titulo`} className="de-titulo al-cond">{cabeca.titulo}</h1>
        <p className="de-chamada">{cabeca.chamada}</p>
      </header>
      <details className="de-privacidade">
        <summary>{t.privacidade.titulo}</summary>
        <p>{t.privacidade.semLista}</p>
        <p>{t.privacidade.semNumero}</p>
        <p>{t.privacidade.aparelho}</p>
      </details>
      {abas.length > 1 && (
        <div className="de-abas" role="tablist" aria-label={rotuloDasAbas} onKeyDown={teclas}>
          {abas.map((a) => (
            <button key={a.chave} id={`${id}-aba-${a.chave}`} type="button" role="tab" className="de-aba" aria-selected={a.chave === aba}
              aria-controls={`${id}-painel`} tabIndex={a.chave === aba ? 0 : -1} onClick={() => setAba(a.chave)}>
              {rotulos[a.chave]}
            </button>
          ))}
        </div>
      )}
      {atual && (
        <section id={`${id}-painel`} role={abas.length > 1 ? "tabpanel" : undefined} className="de-painel" aria-labelledby={abas.length > 1 ? `${id}-aba-${atual.chave}` : `${id}-titulo`}>
          <atual.Parte key={atual.chave} t={t} lang={lang} />
        </section>
      )}
    </article>
  );
}

/** Um bloco com título. */
export function Bloco({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <div className="de-bloco">
      <h2 className="de-subtitulo al-cond">{titulo}</h2>
      {ajuda && <p className="de-miudo">{ajuda}</p>}
      {children}
    </div>
  );
}
