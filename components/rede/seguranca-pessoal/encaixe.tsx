// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../encaixes";

/**
 * Encaixe da segurança pessoal (Prompt 4, itens 10 a 12). Com a rota "seguranca-pessoal" ligada (lib/rede/rotas-novas.ts, flag
 * "alumia-p4-seguranca-pessoal"), o item "Segurança pessoal" entra no painel do botão Segurança de quem tem conta. Desligada, o encaixe
 * fica vazio e nada aparece. A chave deste aparelho sai com o Sair rápido pela lista de bases do modo seguro (lib/modo-seguro.ts).
 */
const NOME: Record<string, string> = { pt: "Segurança pessoal", en: "Personal safety", es: "Seguridad personal", fr: "Sécurité personnelle", ru: "Личная безопасность", zh: "个人安全" };

export const encaixe: Encaixe = !rotaNovaLigada("seguranca-pessoal") ? {} : {
  menu: [
    {
      chave: "seguranca-pessoal",
      lugar: "seguranca",
      rotulo: ({ lang }) => NOME[lang] ?? NOME.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
          <rect x="9" y="10.5" width="6" height="5" rx="1" />
          <path d="M10.2 10.5V9a1.8 1.8 0 0 1 3.6 0v1.5" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/seguranca-pessoal` : null),
    },
  ],
};
