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
 * app/[lang]/comunidade/<rota>/page.tsx, com tela={{ tipo: "pacote", nome: "avisos" }}), sempre com import dinâmico, para a
 * tela só chegar ao navegador quando é aberta:
 *
 *   avisos: { componente: dynamic(() => import("./avisos/Tela"), { ssr: false }), menu: "avisos" },
 *
 * Sem entrada, a casca mostra "em breve" (estados.emBreve) em vez de quebrar.
 */
export const REGISTRO: Record<string, EntradaDoRegistro> = {
  // Pacote comunidades: lista, proposta, "discutir esta aula", núcleos e turma (/comunidade/{comunidades,propor,aula/…,nucleos}).
  comunidades: { componente: dynamic(() => import("./comunidades/Lista"), { ssr: false }), menu: "comunidades" },
  propor: { componente: dynamic(() => import("./comunidades/Propor"), { ssr: false }), menu: "comunidades" },
  aula: { componente: dynamic(() => import("./comunidades/TelaAula"), { ssr: false }), menu: "comunidades" },
  nucleos: { componente: dynamic(() => import("./comunidades/Nucleos"), { ssr: false }), menu: "nucleos" },
  // Pacote avisos: avisos agrupados e preferências (/comunidade/avisos).
  avisos: { componente: dynamic(() => import("./avisos/Tela"), { ssr: false }), menu: "avisos" },
  // Pacote descoberta: Explorar, busca e página de hashtag.
  explorar: { componente: dynamic(() => import("./descoberta/Explorar"), { ssr: false }), menu: "explorar" },
  buscar: { componente: dynamic(() => import("./descoberta/Buscar"), { ssr: false }), menu: "explorar" },
  tag: { componente: dynamic(() => import("./descoberta/Tag"), { ssr: false }), menu: "explorar" },
  // Pacote perfil: editar o perfil (/comunidade/editar-perfil).
  "editar-perfil": { componente: dynamic(() => import("./perfil/EditarPerfil"), { ssr: false }), menu: "perfil" },
  // Pacote moderacao: painel, denúncias e recursos, silenciados e a página de regras (/comunidade/{moderacao,denuncias,silenciados,cuidado}).
  moderacao: { componente: dynamic(() => import("./moderacao/TelaModeracao"), { ssr: false }), menu: "perfil" },
  denuncias: { componente: dynamic(() => import("./moderacao/TelaDenuncias"), { ssr: false }), menu: "perfil" },
  silenciados: { componente: dynamic(() => import("./moderacao/TelaSilenciados"), { ssr: false }), menu: "perfil" },
  cuidado: { componente: dynamic(() => import("./moderacao/TelaCuidado"), { ssr: false }), menu: "perfil" },
};
