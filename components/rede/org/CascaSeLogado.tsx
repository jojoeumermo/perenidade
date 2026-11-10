// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { hasSession } from "@/lib/backend";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import type { TextosDaRede } from "@/lib/rede/textos";
import { RedeSobDemanda } from "../RedeSobDemanda";

const PREVIA = previaLigada();
const nadaAOuvir = () => () => undefined;

/**
 * As páginas públicas da F4 (/alumia/organizacoes e /exemplo) saem prontas do servidor, iguais para todo mundo (indexáveis, sem
 * cabeçalho do pedido). No navegador, quem já tem sessão (ou a prévia, que é sempre a Faísca) passa a ver a mesma tela DENTRO da
 * casca da Alumia (menu, barra de baixo, conta), pelo registro de telas; sem sessão, fica o HTML do servidor.
 * A sessão é lida do aparelho (lib/backend.ts hasSession): nada vai à rede para decidir.
 */
export function CascaSeLogado({ lang, s, nome, params, children }: { lang: string; s: TextosDaRede; nome: string; params?: Record<string, string>; children: ReactNode }) {
  // No servidor (e na hidratação) vale o HTML público; no navegador, a sessão guardada no aparelho decide.
  const logado = useSyncExternalStore(nadaAOuvir, () => PREVIA || hasSession(), () => PREVIA);
  if (!logado) return children;
  return <RedeSobDemanda lang={lang} s={s} tela={{ tipo: "pacote", nome, params }} />;
}
