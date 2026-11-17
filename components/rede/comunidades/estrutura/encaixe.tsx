// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Encaixe da frente 10C (estrutura das comunidades). Quem junta acrescenta `estrutura` à lista de components/rede/encaixes.tsx
// (import de "./comunidades/estrutura/encaixe"). Pendura:
//   abasDaComunidade   a aba "Estrutura" (mãe, subcomunidades, cidade e bairro, organização; o painel da moderação);
//   acoesDoCartao      "Levar a outra comunidade" no menu "mais" do cartão (post de primeiro nível com público de toda a Alumia);
//   anexosDoCartao     "Trazido de …" embaixo do texto de um post levado de outra comunidade;
//   antesDePublicar    numa comunidade de avisos, quem não pode abrir post fica sabendo antes (o gatilho do banco barra de verdade);
//   altoDaComunidade   o carimbo "Comunidade de avisos" (AvisoDeSoLeitura) entre a capa e as abas e, para quem não abre post, a
//                      regra no lugar do "Escrever aqui".
// Os Espaços da organização (EspacosDaOrg) NÃO entram em abasDoPerfil: esse encaixe desenha acima das abas de todo perfil. Quem
// junta põe <EspacosDaOrg handle=… /> como aba do perfil da organização (components/rede/org/PerfilDaOrg.tsx, lib/rede/org/abas.ts).
import { estrutura as cliente } from "@/lib/rede/estrutura/cliente";
import { carregarTextosEstrutura } from "@/lib/rede/estrutura/textos";
import type { Encaixe, PedidoDePublicacao, ResultadoAntesDePublicar } from "../../encaixes";
import { AbaDaEstrutura } from "./AbaDaEstrutura";
import { AvisoDeSoLeitura } from "./AvisoDeSoLeitura";
import { LevarParaOutra } from "./LevarParaOutra";
import { OrigemDoRepost } from "./OrigemDoRepost";

const ROTULO: Record<string, string> = { pt: "Estrutura", en: "Structure", es: "Estructura", fr: "Structure", ru: "Структура", zh: "结构" };

/** Comunidade de avisos: quem não pode abrir post (ou responder, na resposta) para antes de escrever. */
export async function avisoDeSoLeitura(pedido: PedidoDePublicacao, lang: string): Promise<ResultadoAntesDePublicar> {
  if (!pedido.comunidade) return { ok: true };
  const e = await cliente.ver(pedido.comunidade);
  const resposta = Boolean(pedido.extras?.resposta_a);
  if (!e.so_leitura || (resposta ? e.posso_responder : e.posso_abrir_post)) return { ok: true };
  const te = await carregarTextosEstrutura(lang);
  return { ok: false, bloqueia: true, aviso: resposta ? te.erros.so_leitura_respostas : te.antes.soLeitura };
}

export const encaixe: Encaixe = {
  abasDaComunidade: [{ chave: "estrutura", rotulo: ({ lang }) => ROTULO[lang] ?? ROTULO.pt, Componente: AbaDaEstrutura }],
  altoDaComunidade: [AvisoDeSoLeitura],
  acoesDoCartao: [LevarParaOutra],
  anexosDoCartao: [OrigemDoRepost],
  antesDePublicar: [(pedido, ctx) => avisoDeSoLeitura(pedido, ctx.lang)],
};
