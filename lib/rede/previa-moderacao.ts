// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O dublê da fila de moderação na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): as mesmas formas que as funções rede_mod_* devolvem
// (supabase/migracoes/2026-11-rede-moderacao.sql e 20261115-alumia-o9-moderacao.sql), com exemplos. Nada vai ao banco, e nenhum
// exemplo tem gente de verdade. As funções da moderação da comunidade (alumia_*) caem no dublê de comunidade-moderacao.ts.
// Sem "@/" de propósito.
import type { Chamar } from "./cliente";
import type { DenunciaAberta, EscopoDeModeracao, ItemDaFila, ItemDeLista, PostRetido, RecursoDaFila, Silenciado } from "./tipos-moderacao";

const H = 3_600_000;
const daqui = (horas: number) => new Date(Date.now() + horas * H).toISOString();

export function chamarDubleDaFila(depois: Chamar): Chamar {
  const escopo: EscopoDeModeracao = { cuida: true, coord: false, comunidades: ["moradia", "passe-livre"], nomes: { moradia: "Moradia digna", "passe-livre": "Passe Livre" }, nucleos: [] };
  let fila: ItemDaFila[] = [
    { id: "d1", protocolo: "7F3A20C91B", alvo_tipo: "post", alvo: "p1", categoria: "ilegal" as ItemDaFila["categoria"], prioridade: 1, situacao: "aberta", criado_em: daqui(-27), texto: "Venda de remédio controlado sem receita.", comunidade: "moradia", titulo: null, trecho: "Tenho caixas de [remédio] para vender, chama no privado...", nucleo: false, mesmas: 3, responder_ate: daqui(-3), vencida: true },
    { id: "d2", protocolo: "5A2C7E19F0", alvo_tipo: "perfil", alvo: "faisca_do_norte", categoria: "menores", prioridade: 1, situacao: "aberta", criado_em: daqui(-5), texto: "Escreveu numa resposta que tem 15 anos.", comunidade: null, titulo: null, trecho: null, nucleo: false, mesmas: 1, responder_ate: daqui(19), vencida: false },
    { id: "d3", protocolo: "C04E9B21D7", alvo_tipo: "post", alvo: "p3", categoria: "assedio", prioridade: 2, situacao: "em_analise", criado_em: daqui(-30), texto: "", comunidade: "passe-livre", titulo: null, trecho: "Vocês da comissão são todos uns...", nucleo: false, mesmas: 1, responder_ate: daqui(42), vencida: false },
    { id: "d4", protocolo: "91B0F3E6A4", alvo_tipo: "post", alvo: "p4", categoria: "spam", prioridade: 3, situacao: "aberta", criado_em: daqui(-2), texto: "", comunidade: "moradia", titulo: null, trecho: "Ganhe dinheiro em casa, link na bio!!!", nucleo: false, mesmas: 4, responder_ate: daqui(166), vencida: false },
  ];
  let retidos: PostRetido[] = [
    { id: "r1", titulo: null, trecho: "Gente, olhem isso: https://encurta.exemplo/x9 e https://encurta.exemplo/y2", comunidade: "moradia", motivo: "automod_links", criado_em: daqui(-1), autor: "Vento Sul", autor_nivel: 0 },
    { id: "r2", titulo: null, trecho: "Oi, cheguei agora! Moro na ocupação da Rua do Carmo e quero ajudar na cozinha.", comunidade: "moradia", motivo: "recem_chegada", criado_em: daqui(-3), autor: "Maré Cheia", autor_nivel: 0 },
    { id: "r3", titulo: null, trecho: "Assembleia remarcada para quinta, 19h, no salão da paróquia.", comunidade: "passe-livre", motivo: "automod_conta_nova", criado_em: daqui(-6), autor: "Catraca Aberta", autor_nivel: 0 },
  ];
  let recursos: RecursoDaFila[] = [
    { id: "c1", texto: "A foto era de um ato público e todo mundo nela tinha pedido para aparecer.", criado_em: daqui(-190), situacao: "aberto", responder_ate: daqui(-22), vencido: true,
      acao: { id: "a1", acao: "remover", alvo_tipo: "post", alvo: "p9", regra: "ninguem_exposto", motivo: "Rosto de pessoas sem borrar.", criado_em: daqui(-200), automatica: false }, conta: null, minha: false },
    { id: "c2", texto: "Errei a idade no formulário: tenho 19 anos.", criado_em: daqui(-30), situacao: "aberto", responder_ate: daqui(138), vencido: false,
      acao: { id: "a2", acao: "reter", alvo_tipo: "perfil", alvo: "u2", regra: "precaucao_menor", motivo: "Conta retida por precaução até a mediação ler a denúncia.", criado_em: daqui(-40), automatica: true }, conta: "Rua de Baixo", minha: false },
  ];
  let palavras: ItemDeLista[] = [
    { id: "w1", tipo: "palavra", palavra: "ganhe dinheiro", pessoa: null, motivo: "", criado_em: daqui(-400) },
    { id: "w2", tipo: "palavra", palavra: "pix premiado", pessoa: null, motivo: "", criado_em: daqui(-300) },
  ];
  const silenciados: Silenciado[] = [
    { id: "s1", tipo: "comunidade", rotulo: "futebol-de-varzea", ate: daqui(24 * 6), criado_em: daqui(-24) },
    { id: "s2", tipo: "palavra", rotulo: "spoiler", ate: null, criado_em: daqui(-48) },
  ];
  return async <T,>(funcao: string, argumentos: Record<string, unknown> = {}): Promise<T> => {
    if (funcao.startsWith("alumia_") || funcao === "rede_com_decidir_pedido") return depois<T>(funcao, argumentos);
    await new Promise((r) => setTimeout(r, 200));
    switch (funcao) {
      case "rede_mod_escopo":
        return escopo as T;
      case "rede_mod_fila":
        return (argumentos.p_situacao === "fechadas" ? [] : fila) as T;
      case "rede_mod_abrir": {
        const d = fila.find((x) => x.id === argumentos.p_denuncia) ?? fila[0];
        const aberta: DenunciaAberta = { denuncia: d, alvo: d.alvo_tipo === "post" ? { id: d.alvo, texto: d.trecho ?? "", autor: "Vento Sul", autor_nivel: 0, autor_procedentes_90: 0 } : { codinome: "Faísca do Norte", handle: d.alvo, nivel: 0, procedentes_90: 0 }, historico: [] };
        return aberta as T;
      }
      case "rede_mod_retidos":
        return retidos as T;
      case "rede_mod_recursos":
        return recursos as T;
      case "rede_mod_lista":
        return palavras as T;
      case "rede_mod_lista_adicionar":
        palavras = [...palavras, { id: `w${palavras.length + 9}`, tipo: "palavra", palavra: String(argumentos.p_valor ?? ""), pessoa: null, motivo: "", criado_em: daqui(0) }];
        return { id: "w" } as T;
      case "rede_mod_lista_remover":
        palavras = palavras.filter((p) => p.id !== argumentos.p_id);
        return { ok: true } as T;
      case "rede_mod_lento_de":
        return 600 as T;
      case "rede_mod_silenciados":
        return silenciados as T;
      case "rede_mod_detalhes":
        return {} as T;
      case "rede_mod_agir":
        retidos = retidos.filter((r) => r.id !== argumentos.p_alvo);
        fila = fila.filter((d) => d.id !== argumentos.p_denuncia);
        return { acao: String(argumentos.p_acao ?? "") } as T;
      case "rede_mod_rever":
        recursos = recursos.filter((r) => r.id !== argumentos.p_recurso);
        return { situacao: String(argumentos.p_decisao ?? "") } as T;
      case "rede_mod_denunciar":
        return { protocolo: "E4B7C2A90D", prioridade: 3, retido: false, ja: false } as T;
      // As listas da própria pessoa (a tela /alumia/denuncias): vazias na prévia. Sem isto caíam no "ok" de baixo e a tela quebrava.
      case "rede_mod_minhas_denuncias":
      case "rede_mod_minhas_decisoes":
        return [] as T;
      default:
        return { ok: true, id: "x" } as T;
    }
  };
}
