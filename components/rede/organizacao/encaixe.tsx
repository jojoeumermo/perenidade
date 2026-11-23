// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";
import dynamic from "next/dynamic";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import type { Post } from "@/lib/rede/tipos";

/**
 * Encaixe do grupo "organização e ação coletiva" (Prompt 4, itens 52 a 67 e 122). Com a rota "organizar" ligada
 * (lib/rede/rotas-novas.ts, flag "alumia-p4-organizacao"): o item "Organizar" no grupo "Mais" do menu, para quem tem conta.
 * Desligada, o encaixe fica vazio e nada aparece.
 *   acoesDoCartao     66: "Pedir checagem ao Instituto" no menu "mais" do cartão, só em post aberto à internet.
 *   abasDoPerfil      65: o jeito de apoiar a pessoa (chave Pix aleatória ou link), acima das abas do perfil, só quando ela pôs.
 */
const ApoioNoPerfil = dynamic(() => import("./AbaApoio").then((m) => m.ApoioNoPerfil), { ssr: false }) as React.ComponentType<ContextoDoEncaixe & { handle: string }>;
const PedirChecagem = dynamic(() => import("./PedirChecagem").then((m) => m.PedirChecagem), { ssr: false }) as React.ComponentType<ContextoDoEncaixe & { post: Post }>;
const APOIAR: Record<string, string> = { pt: "Apoiar", en: "Support", es: "Apoyar", fr: "Soutenir", ru: "Поддержать", zh: "支持" };

const ORGANIZAR: Record<string, string> = { pt: "Organizar", en: "Organize", es: "Organizar", fr: "S’organiser", ru: "Организоваться", zh: "组织起来" };

export const encaixe: Encaixe = !rotaNovaLigada("organizar") ? {} : {
  menu: [
    {
      chave: "organizar",
      lugar: "mais",
      rotulo: ({ lang }) => ORGANIZAR[lang] ?? ORGANIZAR.pt,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4.5h4.5v15H4zM9.75 4.5h4.5v10h-4.5zM15.5 4.5H20v6.5h-4.5z" />
        </svg>
      ),
      href: ({ lang, situacao }) => (situacao.logado ? `/${lang}/alumia/organizar` : null),
    },
  ],
  acoesDoCartao: [PedirChecagem],
  abasDoPerfil: [{ chave: "apoio-direto", rotulo: ({ lang }) => APOIAR[lang] ?? APOIAR.pt, Componente: ApoioNoPerfil }],
};
