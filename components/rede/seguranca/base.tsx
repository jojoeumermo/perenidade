// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que as telas da conta segura repartem: os textos (só o idioma da página chega ao navegador), o nome de um aparelho, as datas
// (só o dia, nunca a hora de uma sessão) e o texto de um erro do banco.
import { useEffect, useState } from "react";
import type { AparelhoConectado } from "@/lib/rede/seguranca/cliente";
import { NOMES_DOS_NAVEGADORES, NOMES_DOS_SISTEMAS } from "@/lib/rede/seguranca/navegador";
import { carregarTextosDaSeguranca, type TextosDaSeguranca } from "@/lib/rede/seguranca/textos";
import "./seguranca.css";

export type T = TextosDaSeguranca;

/** Os textos da conta segura no idioma da página. Nulo enquanto carrega. */
export function useTextosDaSeguranca(lang: string): T | null {
  const [t, setT] = useState<{ lang: string; t: T } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaSeguranca(lang).then((x) => vivo && setT({ lang, t: x }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/** Troca {chave} pelo valor. */
export const por = (texto: string, valores: Record<string, string | number>): string =>
  texto.replace(/\{(\w+)\}/g, (_, k: string) => (k in valores ? String(valores[k]) : `{${k}}`));

/** "Firefox em Linux", no idioma da página. */
export function nomeDoAparelho(t: T, a: Pick<AparelhoConectado, "navegador" | "sistema">): string {
  const navegador = a.navegador === "outro" ? t.aparelhos.outroNavegador : NOMES_DOS_NAVEGADORES[a.navegador];
  const sistema = a.sistema === "outro" ? t.aparelhos.outroSistema : a.sistema === "ios" ? t.aparelhos.ios : NOMES_DOS_SISTEMAS[a.sistema];
  return por(t.aparelhos.rotulo, { navegador, sistema });
}

/** Um dia (AAAA-MM-DD) como "hoje", "ontem" ou a data por extenso curta do idioma. */
export function diaLegivel(t: T, lang: string, dia: string, agora = new Date()): string {
  const [a, m, d] = dia.split("-").map(Number);
  if (!a || !m || !d) return dia;
  const data = new Date(a, m - 1, d);
  const zero = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diferenca = Math.round((zero.getTime() - data.getTime()) / 86_400_000);
  if (diferenca === 0) return t.aparelhos.hoje;
  if (diferenca === 1) return t.aparelhos.ontem;
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: data.getFullYear() === agora.getFullYear() ? undefined : "numeric" }).format(data);
}

/** Uma data e hora (dos códigos gerados, do pânico) no idioma da página. */
export function dataLegivel(lang: string, iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(data);
}

/** O texto de um erro do banco, sem mostrar o código cru. */
export function textoDoErro(t: T, erro: unknown): string {
  const m = erro instanceof Error ? erro.message : String(erro ?? "");
  if (/confirme_segundo_fator/.test(m)) return t.erros.confirme;
  if (/muitos_pedidos/.test(m)) return t.erros.muitos;
  return t.erros.falha;
}

/** Um ladrilho do mosaico (a fileira que enfeita o alto das seções). */
export function Ladrilhos({ cores }: { cores: readonly (1 | 2 | 3 | 4)[] }) {
  return (
    <span className="sg-ladrilhos" aria-hidden>
      {cores.map((c, i) => (
        <span key={i} className="sg-ladrilho" data-cor={c} />
      ))}
    </span>
  );
}
