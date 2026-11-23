// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que as partes da tela da cultura (Prompt 4, itens 38 a 42) dividem: os textos do pacote, a frase do erro, a leitura com
// recarga e a ação com mensagem. Nada aqui guarda coisa no aparelho nem fala com outro endereço.
import { useCallback, useEffect, useState } from "react";
import { BackendError } from "@/lib/backend";
import { carregarPronto } from "@/lib/rede/textos-prontos";
import { criarUsoDeTextos } from "../mapa/comum";
import type pt from "../../../i18n/rede/cultura/pt.json";

export type T = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/cultura/pt.json"),
  en: () => import("../../../i18n/rede/cultura/en.json"),
  es: () => import("../../../i18n/rede/cultura/es.json"),
  fr: () => import("../../../i18n/rede/cultura/fr.json"),
  ru: () => import("../../../i18n/rede/cultura/ru.json"),
  zh: () => import("../../../i18n/rede/cultura/zh.json"),
};
export const useTextosDaCultura = criarUsoDeTextos(async (lang: string) => (await carregarPronto(CARREGAR, lang)) as T);

/** A frase de um erro do banco: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function fraseDoErro(t: T, e: unknown): string {
  const codigo = e instanceof BackendError ? e.code : "";
  const erros = t.erros as Record<string, string>;
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? t.erros.outro;
}

/** O que cada parte recebe da tela. */
export interface PropsDaParte {
  t: T;
  lang: string;
  /** A comunidade escolhida (cineclube, estante e playlist); nula nas partes que não dependem dela. */
  comunidade: string | null;
}

/** Uma leitura do banco que recarrega quando a chave muda ou quando se pede de novo. */
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

/** Uma ação com "ocupado" e a mensagem do fim (ou do erro). Devolver nulo da ação: nada a dizer (a pessoa desistiu). */
export function useAcao(t: T, depois: () => void) {
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
  const avisar = (texto: string) => setMensagem({ texto, erro: true });
  return { ocupado, mensagem, fazer, avisar };
}

/** A mensagem do fim de uma ação: "status" quando deu certo, "alert" quando não. */
export function Mensagem({ mensagem }: { mensagem: { texto: string; erro: boolean } | null }) {
  if (!mensagem) return null;
  return <p className={mensagem.erro ? "cu-erro" : "cu-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>;
}

/** Dia e hora no idioma da tela. */
export function diaEHora(lang: string, iso: string): string {
  return new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
