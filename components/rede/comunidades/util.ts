// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import { codigoDoErro, textoDoErro } from "../erros";

/** Os textos do pacote, quando a rota os trouxe junto (lib/rede/textos-comunidades.ts: comTextos). Sem eles, as extras ficam de fora. */
export function textosDe(s: TextosDaRede): TextosDeComunidades | null {
  return (s as TextosDaRede & { comunidades?: TextosDeComunidades }).comunidades ?? null;
}

/** O texto de um erro: primeiro os do pacote (invalido:slug, invalido:moderadores…), depois os da Rede. */
export function erroCom(s: TextosDaRede, sc: TextosDeComunidades, erro: unknown): string {
  const proprio = (sc.erros as Record<string, string>)[codigoDoErro(erro)];
  return proprio ?? textoDoErro(s, erro);
}

/** Carrega uma coisa do banco com os três estados da tela. A chave identifica o pedido: trocar de chave volta a "esperando". */
export function useCarregar<T>(buscar: () => Promise<T>, chave: string) {
  const [estado, setEstado] = useState<{ chave: string; dado: T | null; erro: unknown } | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    buscar()
      .then((dado) => vivo && setEstado({ chave: `${chave}#${versao}`, dado, erro: null }))
      .catch((erro) => vivo && setEstado({ chave: `${chave}#${versao}`, dado: null, erro }));
    return () => {
      vivo = false;
    };
    // buscar muda a cada render; a chave (e a versão) é o que identifica o pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, versao]);
  const pronto = estado?.chave === `${chave}#${versao}`;
  return { dado: pronto ? estado.dado : null, erro: pronto ? estado.erro : null, pronto, recarregar: () => setVersao((n) => n + 1) };
}

/** O código de um post a partir do que a pessoa colou: o código solto ou um endereço .../alumia/p/<código>. */
export function idDoPost(texto: string): string | null {
  const m = texto.trim().match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? m[1].toLowerCase() : null;
}

/** O mês de hoje, "AAAA-MM", pelo relógio do aparelho. */
export function mesDeHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const botao = "min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-sans font-bold text-white hover:bg-[#1f1a14] disabled:cursor-default disabled:opacity-50";
export const botaoClaro = "min-h-11 cursor-pointer rounded-full border border-ink px-4 font-sans font-bold hover:bg-parchment-deep disabled:cursor-default disabled:opacity-50";
export const campo = "w-full rounded-md border border-rule bg-parchment px-3 py-2 font-sans text-base";
