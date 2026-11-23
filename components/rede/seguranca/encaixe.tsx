// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../encaixes";

/**
 * Encaixe da F6 (privacidade e segurança pessoal; onda 8, conta segura): o que esta frente pendura nas telas comuns. Com a rota
 * "seguranca" ligada (lib/rede/rotas-novas.ts), o item "Segurança" entra no menu de quem tem conta e leva aos Ajustes de segurança
 * (/alumia/seguranca: pânico, aplicativo autenticador, códigos de recuperação, aparelhos conectados, fora da busca). Desligada,
 * o encaixe fica vazio. A limpeza do aparelho no pânico é a saída do site inteiro (lib/rede/saida.ts, sairDeTudo), que já roda
 * as limpezas dos outros encaixes; por isso não há aoSairRapido aqui.
 */
const NOME: Record<string, string> = { pt: "Segurança", en: "Security", es: "Seguridad", fr: "Sécurité", ru: "Безопасность", zh: "安全" };

export const encaixe: Encaixe = !rotaNovaLigada("seguranca") ? {} : {
  menu: [
    {
      chave: "seguranca",
      lugar: "seguranca",
      rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/seguranca` : null),
    },
  ],
};
