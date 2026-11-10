// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post, Situacao } from "@/lib/rede/tipos";
import type { ItemDoMenu } from "./Casca";

/** O que a casca entrega a uma tela de pacote. Os textos do próprio pacote vêm do arquivo de textos dele (i18n/rede/<pacote>/). */
export interface PropsDaTelaDoPacote {
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  params: Record<string, string>;
  /** Abre o "Escrever" (em tela cheia no celular); com um post, é uma resposta a ele. */
  aoEscrever: (respostaA?: Post | null) => void;
}

export interface EntradaDoRegistro {
  componente: ComponentType<PropsDaTelaDoPacote>;
  /** Qual item do menu fica marcado enquanto a tela está aberta. */
  menu: ItemDoMenu;
}

/**
 * As telas que os pacotes acrescentam à casca, por nome. Cada pacote põe UMA linha aqui (e a rota dele em
 * app/[lang]/alumia/<rota>/page.tsx, com tela={{ tipo: "pacote", nome: "avisos" }}), sempre com import dinâmico, para a
 * tela só chegar ao navegador quando é aberta:
 *
 *   avisos: { componente: dynamic(() => import("./avisos/Tela"), { ssr: false }), menu: "avisos" },
 *
 * Sem entrada, a casca mostra "em breve" (estados.emBreve) em vez de quebrar.
 */
export const REGISTRO: Record<string, EntradaDoRegistro> = {
  // Pacote comunidades: lista, proposta, "discutir esta aula", núcleos e turma (/alumia/{comunidades,propor,aula/…,nucleos}).
  comunidades: { componente: dynamic(() => import("./comunidades/Lista"), { ssr: false }), menu: "comunidades" },
  propor: { componente: dynamic(() => import("./comunidades/Propor"), { ssr: false }), menu: "comunidades" },
  aula: { componente: dynamic(() => import("./comunidades/TelaAula"), { ssr: false }), menu: "comunidades" },
  nucleos: { componente: dynamic(() => import("./comunidades/Nucleos"), { ssr: false }), menu: "nucleos" },
  // Pacote avisos: avisos agrupados e preferências (/alumia/avisos).
  avisos: { componente: dynamic(() => import("./avisos/Tela"), { ssr: false }), menu: "avisos" },
  // Pacote descoberta: Explorar, busca e página de hashtag.
  explorar: { componente: dynamic(() => import("./descoberta/Explorar"), { ssr: false }), menu: "explorar" },
  buscar: { componente: dynamic(() => import("./descoberta/Buscar"), { ssr: false }), menu: "explorar" },
  tag: { componente: dynamic(() => import("./descoberta/Tag"), { ssr: false }), menu: "explorar" },
  // Pacote perfil: editar o perfil (/alumia/editar-perfil).
  "editar-perfil": { componente: dynamic(() => import("./perfil/EditarPerfil"), { ssr: false }), menu: "perfil" },
  // Pacote moderacao: painel, denúncias e recursos, silenciados e a página de regras (/alumia/{moderacao,denuncias,silenciados,cuidado}).
  moderacao: { componente: dynamic(() => import("./moderacao/TelaModeracao"), { ssr: false }), menu: "perfil" },
  denuncias: { componente: dynamic(() => import("./moderacao/TelaDenuncias"), { ssr: false }), menu: "perfil" },
  silenciados: { componente: dynamic(() => import("./moderacao/TelaSilenciados"), { ssr: false }), menu: "perfil" },
  cuidado: { componente: dynamic(() => import("./moderacao/TelaCuidado"), { ssr: false }), menu: "perfil" },
  // Pacote alumia: Salvos e a federação com o Fediverso (/alumia/{salvos,fediverso}; docs/rede/FEDIVERSO.md).
  salvos: { componente: dynamic(() => import("./alumia/Salvos"), { ssr: false }), menu: "salvos" },
  fediverso: { componente: dynamic(() => import("./alumia/Fediverso"), { ssr: false }), menu: "fediverso" },
  // Chat privado cifrado de ponta a ponta (/alumia/conversas; docs/rede/CHAT-PRIVADO.md). Nada dele vai ao Fediverso.
  conversas: { componente: dynamic(() => import("./chat/Tela"), { ssr: false }), menu: "conversas" },

  // ───── Onda 5 (PLANO-ALUMIA F0): as telas novas, cada uma no arquivo da frente dona; as rotas e as flags em
  // lib/rede/rotas-novas.ts. Por enquanto todas mostram "em construção" (components/rede/onda5/EmConstrucao.tsx). ─────
  // F2 · atos (/alumia/atos, /alumia/ato/[id], /alumia/calendario).
  atos: { componente: dynamic(() => import("./atos/TelaDosAtos"), { ssr: false }), menu: "chamados" },
  ato: { componente: dynamic(() => import("./atos/PaginaDoAto"), { ssr: false }), menu: "chamados" },
  calendario: { componente: dynamic(() => import("./atos/Calendario"), { ssr: false }), menu: "chamados" },
  // F4 · organizações (/alumia/organizacoes).
  organizacoes: { componente: dynamic(() => import("./org/PaginaParaOrganizacoes"), { ssr: false }), menu: "comunidades" },
  "organizacoes-exemplo": { componente: dynamic(() => import("./org/PerfilDeExemplo"), { ssr: false }), menu: "comunidades" },
  // F5 · stories (/alumia/stories).
  stories: { componente: dynamic(() => import("./stories/TelaDeStories"), { ssr: false }), menu: "inicio" },
  // F6 · segurança pessoal (/alumia/{seguranca,identidades,aparelhos,o-que-guardamos}).
  seguranca: { componente: dynamic(() => import("./seguranca/TelaDaSeguranca"), { ssr: false }), menu: "perfil" },
  identidades: { componente: dynamic(() => import("./seguranca/TelaDasIdentidades"), { ssr: false }), menu: "perfil" },
  aparelhos: { componente: dynamic(() => import("./seguranca/TelaDosAparelhos"), { ssr: false }), menu: "perfil" },
  "o-que-guardamos": { componente: dynamic(() => import("./seguranca/OQueGuardamos"), { ssr: false }), menu: "perfil" },
  // F8 · transparência (/alumia/transparencia).
  transparencia: { componente: dynamic(() => import("./protecao/TelaDaTransparencia"), { ssr: false }), menu: "perfil" },
  // F9 · alcance (/alumia/listas, /alumia/leve).
  listas: { componente: dynamic(() => import("./alcance/TelaDasListas"), { ssr: false }), menu: "inicio" },
  leve: { componente: dynamic(() => import("./alcance/VersaoLeve"), { ssr: false }), menu: "inicio" },
};
