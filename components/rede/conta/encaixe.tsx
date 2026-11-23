// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";
import dynamic from "next/dynamic";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { pareceAgressivo } from "@/lib/rede/conta/regras";
import { preencher } from "@/lib/rede/preencher";
import type { ContextoDoEncaixe, Encaixe, PedidoDePublicacao, ResultadoAntesDePublicar } from "../encaixes";
import { carregarTextosDaConta } from "./textos";

/**
 * Encaixe do grupo "conta, identidade e convivência" (Prompt 4, Parte H). Com a rota "conta" ligada (lib/rede/rotas-novas.ts, flag
 * "alumia-p4-conta"):
 *   menu              "Conta e convivência" no menu da conta (os três pontinhos), para quem tem conta;
 *   antesDePublicar   79: "Releia antes de enviar" quando o texto parece agressivo (só no aparelho; um aviso, nunca um bloqueio);
 *   altoDaComunidade  105 a faixa da sala de cuidado, 127 o quiz das regras e 114 o guia de entrada.
 * Desligada, o encaixe fica vazio e nada aparece.
 */
const NoAltoDaComunidade = dynamic(() => import("./NoAltoDaComunidade").then((m) => m.NoAltoDaComunidade), { ssr: false }) as React.ComponentType<ContextoDoEncaixe & { slug: string }>;

const ROTULO: Record<string, string> = { pt: "Conta e convivência", en: "Account and community", es: "Cuenta y convivencia", fr: "Compte et vivre-ensemble", ru: "Аккаунт и сообщество", zh: "账户与社区" };

/** 79. Releia antes de enviar: a conta é só no aparelho (lib/rede/conta/regras.ts); nada vai ao servidor por aqui. */
export async function releiaAntesDePublicar(pedido: PedidoDePublicacao, ctx: ContextoDoEncaixe): Promise<ResultadoAntesDePublicar> {
  const motivos = pareceAgressivo(pedido.texto);
  if (motivos.length === 0) return { ok: true };
  const t = await carregarTextosDaConta(ctx.lang);
  const nomes = t.releia.motivos as Record<string, string>;
  return { ok: false, aviso: preencher(t.releia.aviso, { motivos: motivos.map((m) => nomes[m] ?? m).join("; ") }) };
}

export const encaixe: Encaixe = !rotaNovaLigada("conta") ? {} : {
  menu: [
    {
      chave: "conta-p4",
      lugar: "conta",
      rotulo: ({ lang }) => ROTULO[lang] ?? ROTULO.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.5 5 6.5v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9v-5z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/conta` : null),
    },
  ],
  antesDePublicar: [releiaAntesDePublicar],
  altoDaComunidade: [NoAltoDaComunidade],
};
