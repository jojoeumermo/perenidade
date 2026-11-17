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
  /** Qual item do menu fica marcado enquanto a tela está aberta ("nenhum": a tela tem item próprio, vindo de um encaixe do menu). */
  menu: ItemDoMenu | "nenhum";
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
  // F9 · alcance (/alumia/listas) e, da onda 13, o leve (/alumia/leve, components/rede/leve/TelaLeve por dentro da VersaoLeve).
  listas: { componente: dynamic(() => import("./alcance/TelaDasListas"), { ssr: false }), menu: "perfil" },
  leve: { componente: dynamic(() => import("./alcance/VersaoLeve"), { ssr: false }), menu: "perfil" },

  // ───── Acabamento da Faixa 1: aparência e leitura, posts que se repetem e a linha dos #temas
  // (/alumia/{aparencia,series,temas}; as pastas e as buscas salvas moram em Salvos e em Buscar). ─────
  aparencia: { componente: dynamic(() => import("./aparencia/TelaDaAparencia"), { ssr: false }), menu: "perfil" },
  series: { componente: dynamic(() => import("./aparencia/TelaDasSeries"), { ssr: false }), menu: "perfil" },
  temas: { componente: dynamic(() => import("./aparencia/TelaDosTemas"), { ssr: false }), menu: "explorar" },
  // A linha com regra aberta (/alumia/linhas e /alumia/como-a-linha), atrás do interruptor "alumia-linha-aberta".
  linhas: { componente: dynamic(() => import("./linha/TelaDasLinhas"), { ssr: false }), menu: "inicio" },
  "como-a-linha": { componente: dynamic(() => import("./linha/ComoALinha"), { ssr: false }), menu: "inicio" },

  // ───── Onda 8: a lei e a ajuda (/alumia/{termos,privacidade,regras,ajuda}; o que guardamos fica na rota da onda 5) e os meus
  // dados (/alumia/meus-dados: baixar uma cópia e apagar a conta). ─────
  termos: { componente: dynamic(() => import("./lei/TelaDosTermos"), { ssr: false }), menu: "perfil" },
  privacidade: { componente: dynamic(() => import("./lei/TelaDaPrivacidade"), { ssr: false }), menu: "perfil" },
  regras: { componente: dynamic(() => import("./lei/TelaDasRegras"), { ssr: false }), menu: "perfil" },
  ajuda: { componente: dynamic(() => import("./lei/TelaDaAjuda"), { ssr: false }), menu: "perfil" },
  "meus-dados": { componente: dynamic(() => import("./meusdados/TelaMeusDados"), { ssr: false }), menu: "perfil" },
  // Os convites de quem já está dentro (/alumia/convite, atrás de "alumia-convites"); o convite aberto por link (/alumia/convite/<código>)
  // continua fora da casca, porque abre sem conta.
  convite: { componente: dynamic(() => import("./convites/TelaDosConvites"), { ssr: false }), menu: "perfil" },

  // ───── Onda 9: o modo ato (/alumia/modo-ato, atrás de "alumia-modo-ato"; o guia /alumia/modo-ato/sem-sinal abre sem casca) e os
  // rótulos assináveis (/alumia/rotulos, atrás de "alumia-proximas"). ─────
  "modo-ato": { componente: dynamic(() => import("./modoato/TelaDoModoAto"), { ssr: false }), menu: "perfil" },
  rotulos: { componente: dynamic(() => import("./rotulos/TelaDosRotulos"), { ssr: false }), menu: "perfil" },

  // ───── Onda 11 (estudo): o banco de questões (/alumia/questoes), as turmas e a agenda de provas e monitoria (/alumia/turmas e
  // /alumia/agenda) e a redação entre pares (/alumia/redacao), atrás de "alumia-estudo"; as conquistas e o mural de aprovados
  // (/alumia/conquistas e /alumia/aprovados), atrás de "alumia-2". As quatro do estudo têm item próprio no menu (o encaixe de cada
// uma), que se marca pelo endereço: nenhum item fixo fica marcado junto. ─────
  questoes: { componente: dynamic(() => import("./estudo/questoes/TelaDasQuestoes"), { ssr: false }), menu: "nenhum" },
  turmas: { componente: dynamic(() => import("./estudo/turma/TelaDasTurmas"), { ssr: false }), menu: "nenhum" },
  agenda: { componente: dynamic(() => import("./estudo/agenda/TelaDaAgenda"), { ssr: false }), menu: "nenhum" },
  redacao: { componente: dynamic(() => import("./estudo/redacao/TelaDaRedacao"), { ssr: false }), menu: "nenhum" },
  conquistas: { componente: dynamic(() => import("./estudo/conquistas/TelaConquistas"), { ssr: false }), menu: "perfil" },
  aprovados: { componente: dynamic(() => import("./estudo/conquistas/TelaMural"), { ssr: false }), menu: "perfil" },
  // ───── Onda 12 (perfil): o pacote inicial (/alumia/pacote/[slug]), com quem aceitou entrar nele, atrás de "alumia-2". ─────
  "pacote-inicial": { componente: dynamic(() => import("./perfil/secoes/TelaDoPacote"), { ssr: false }), menu: "explorar" },
  // ───── Onda 13: o mapa por cidade e o ao vivo (/alumia/mapa e /alumia/mapa/ao-vivo, atrás de "alumia-mapa" e "alumia-ao-vivo"), as
  // pontes da organização e o Mural dos Trabalhadores (/alumia/pontes e /alumia/trabalhadores, com "alumia-org"). ─────
  mapa: { componente: dynamic<PropsDaTelaDoPacote>(() => import("./mapa/TelaDoMapa"), { ssr: false }), menu: "nenhum" },
  "ao-vivo": { componente: dynamic<PropsDaTelaDoPacote>(() => import("./aovivo/TelaAoVivo"), { ssr: false }), menu: "nenhum" },
  pontes: { componente: dynamic(() => import("./pontes/TelaDasPontes"), { ssr: false }), menu: "perfil" },
  trabalhadores: { componente: dynamic(() => import("./pontes/TelaDosTrabalhadores"), { ssr: false }), menu: "nenhum" },
};
