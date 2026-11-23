// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O motor dos grupos MLS da Alumia (núcleos, comunidades fechadas, posts restritos "p2", voz) e do chat da equipe, sobre o OpenMLS
// do @wireapp/core-crypto na suíte híbrida ML-KEM-768 + X25519 (SUITE_MLS). Documento:
// docs/rede/POSTS-RESTRITOS.md.
//
// O que este arquivo garante, e como:
//   - ÉPOCAS: cada entrada e saída é um commit que leva o grupo à época seguinte, com segredo novo (o MLS faz). Quem saiu não deriva
//     nada da época nova; quem entrou não deriva nada de antes. Tudo do grupo numa época (embrulho, posts, voz, mensagens) sai do
//     exporter daquela época (epoca.ts).
//   - UM COMMIT POR ÉPOCA: o commit vai ao servidor marcado com a época a que leva; o servidor aceita um só por época ("ocupada" para
//     o segundo). O motor manda o commit pelo transporte ANTES de juntá-lo ao estado: com "ocupada", o transporte recusa, a biblioteca
//     desfaz a operação (nada é juntado) e este aparelho lê o commit de quem chegou primeiro e tenta de novo. Sem isso, dois aparelhos
//     ficariam em épocas diferentes com o mesmo número (o grupo se partiria) [provado em scripts/testar-r2-grupos.mjs].
//   - NADA DO MLS SAI SEM EMBRULHO: o commit (mensagem pública do MLS, com quem manda e quem entra) vai embrulhado com a chave da
//     época em que foi feito (embrulho-da-epoca.ts). A GroupInfo (a árvore em texto aberto) nunca sai do aparelho; quem entra recebe as
//     boas-vindas (Welcome, cifradas pelo MLS para o pacote de chave da pessoa).
//   - REENTRADA: a folha que está na árvore mas cujo aparelho ficou sem o grupo (boas-vindas vencidas, ou a conta saiu e voltou antes
//     de alguém tirá-la) é tirada e posta de novo, com boas-vindas novas (`reentrar`). Sem isso, ela ficaria presa: os outros a veem
//     no grupo, e ela não tem como ler.
//   - REMOÇÃO: quem o servidor diz que saiu (a conta, ou um aparelho dela) é tirado pelo próximo aparelho do grupo que sincronizar
//     (um commit de remoção); o aparelho tirado, ao ler esse commit, perde o grupo (a biblioteca apaga o estado). Os segredos das
//     épocas em que estava ficam guardados neste aparelho só para reler o que já podia ler.
//   - APARELHOS: cada aparelho é uma folha com nome próprio (ClientId "<conta>:<aparelho>@alumia.invalid"). O servidor diz quais
//     folhas cada conta tem agora (`folhas`); aparelho que perdeu o estado (o "Sair rápido" apaga a loja) volta com nome novo, os
//     outros tiram a folha velha e põem a nova. Nada de GroupInfo no servidor: ninguém entra sozinho, só por boas-vindas.
//   - "grupo_suspeito": o servidor decide QUEM é do grupo, mas não consegue pôr uma chave falsa no lugar de ninguém sem o aparelho
//     notar. Antes de pôr alguém, o aparelho lê do pacote de chave a conta e a chave de assinatura (pacote.ts) e pergunta à política
//     (`aceitarFolha`); depois de cada sincronização, confere a árvore inteira (cada folha aceita; no grupo da rede, ninguém duas
//     vezes). Algo que não confere: lança "grupo_suspeito" e não escreve nada no grupo.
//
//   - FOLHA VELHA (onda R3, item 1.1): a suíte já é híbrida pós-quântica e cada commit com caminho de atualização cura o grupo. Para
//     que a cura não dependa de alguém escrever, cada aparelho troca a chave da PRÓPRIA folha (updateKeyingMaterial) quando ela tem
//     mais de 7 dias ou quando ele mandou 200 mensagens desde a última troca: o prazo é conferido a cada sincronização (também de
//     quem só lê) e a contagem, por `aoMandar`. Uma troca que perde a corrida ("ocupada") fica para a próxima; erro nunca impede ler.
//
// A política (quem é aceito) é de quem usa: a rede confia na primeira chave vista de cada aparelho, recusa troca de chave no mesmo
// aparelho e avisa quando uma conta aparece com aparelho novo (chaveiro.ts); a equipe confere o certificado da identidade da pessoa
// para cada aparelho (lib/equipe/mls.ts). Sem "@/": roda no Node nos testes.
import type { ConversationId, KeyPackage } from "@wireapp/core-crypto";
import type { AparelhoMls, Contexto } from "./aparelho";
import { desembrulhar, embrulhar, TIPO } from "./embrulho-da-epoca";
import { segredosDaEpoca, type SegredosDaEpoca, type TipoDeGrupo } from "./epoca";
import { lerNome, lerPacote, type Membro, type PacoteLido } from "./pacote";
import { SUITE_MLS } from "../cifra/motor";

/** O que o servidor diz do grupo. */
export interface EstadoNoServidor {
  /** A época mais nova registrada (null: o grupo ainda não existe no servidor). */
  epoca: number | null;
  /** As contas que o servidor diz serem do grupo. */
  membros: string[];
  /** Os nomes de membro (ClientId) dos aparelhos dessas contas que devem estar no grupo. */
  folhas: string[];
  /** Os commits embrulhados depois da época pedida, em ordem (`epoca` = a época a que o commit leva). */
  commits: { epoca: number; corpo: Uint8Array }[];
  /** As boas-vindas mais novas feitas para este aparelho. */
  boasvindas: { epoca: number; welcome: Uint8Array } | null;
  /**
   * Folhas que estão na árvore mas sem o grupo no aparelho delas (perderam as boas-vindas, ou a conta saiu e voltou antes de alguém
   * tirá-las): saem num commit e entram de novo no seguinte, com boas-vindas novas. Opcional (os grupos da rede não usam).
   */
  reentrar?: string[];
}

export interface TransporteDeGrupo {
  estado(grupo: string, desde: number): Promise<EstadoNoServidor>;
  /** Um pacote de chave para cada nome de aparelho pedido. `para`: o nome a quem vão as boas-vindas. */
  pacotes(grupo: string, faltam: string[]): Promise<{ para: string; pacote: Uint8Array }[]>;
  /** Grava o commit que leva o grupo a `epoca`. "ocupada": outro aparelho gravou essa época antes. */
  gravarCommit(grupo: string, epoca: number, corpo: Uint8Array, boasvindas: { para: string; welcome: Uint8Array }[]): Promise<"ok" | "ocupada">;
}

/** Onde o aparelho guarda (chave → valor): os segredos de cada época, para reler. No navegador, IndexedDB; nos testes, a memória. */
export interface GuardaDoGrupo {
  ler: <T>(chave: string) => Promise<T | null>;
  guardar: (chave: string, valor: unknown) => Promise<void>;
  apagar: (chave: string) => Promise<void>;
}

export interface Politica {
  /** A folha (conta, aparelho, impressão da chave de assinatura) é aceita por este aparelho? */
  aceitarFolha(f: Membro & { impressao: string }): Promise<boolean>;
}

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
/** Quantos entram num commit só (o commit embrulhado precisa caber em 131072 bytes; cada pacote híbrido tem ~2,7 KB). */
const ENTRADAS_POR_COMMIT = 25;
/** A folha deste aparelho é trocada quando passa disto (onda R3, item 1.1). */
export const FOLHA_DIAS = 7;
export const FOLHA_MENSAGENS = 200;
/** Quantas épocas o aparelho guarda para reler (as mais novas). */
const EPOCAS_GUARDADAS = 1000;

const paraB64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const deB64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
const nomeDe = (bytes: Uint8Array) => lerNome(new TextDecoder().decode(bytes));

/** O identificador do grupo no MLS: fixo, tirado do nome do grupo (todos os membros chegam ao mesmo). */
export const idDoGrupo = (tipo: TipoDeGrupo, grupo: string) => new TextEncoder().encode(`alumia:${tipo}:${grupo}`);

export function criarMotorDeGrupo(opcoes: {
  tipo: TipoDeGrupo;
  aparelho: () => Promise<AparelhoMls>;
  transporte: TransporteDeGrupo;
  guarda: GuardaDoGrupo;
  politica: Politica;
  /** O relógio (os testes trocam). */
  agora?: () => number;
}) {
  const { tipo, transporte, guarda, politica } = opcoes;
  const agora = opcoes.agora ?? (() => Date.now());
  const kSegredos = (grupo: string) => `segredos:${tipo}:${grupo}`;
  /** Quando a folha deste aparelho foi trocada pela última vez e quantas mensagens ele mandou desde então. */
  const kFolha = (grupo: string) => `folha:${tipo}:${grupo}`;
  /** Uma sincronização por grupo de cada vez. */
  const emCurso = new Map<string, Promise<unknown>>();
  /** As boas-vindas que este aparelho já usou ou que falharam (cada uma é tentada uma vez só). */
  const boasvindasUsadas = new Set<string>();

  async function exportar(a: AparelhoMls, cid: ConversationId): Promise<{ epoca: bigint; exportado: Uint8Array }> {
    return a.operar(null, async (c) => {
      const epoca = await c.conversationEpoch(cid);
      const segredo = await c.exportSecretKey(cid, 32);
      return { epoca, exportado: segredo.copyBytes() };
    });
  }

  /** Guarda o segredo exportado da época atual (para reler depois) e devolve os segredos derivados. */
  async function anotar(a: AparelhoMls, grupo: string): Promise<{ epoca: bigint; segredos: SegredosDaEpoca }> {
    const id = idDoGrupo(tipo, grupo);
    const { epoca, exportado } = await exportar(a, new a.M.ConversationId(id));
    const guardados = (await guarda.ler<Record<string, string>>(kSegredos(grupo))) ?? {};
    if (!guardados[epoca.toString()]) {
      guardados[epoca.toString()] = paraB64(exportado);
      const epocas = Object.keys(guardados).map(Number).sort((x, y) => x - y);
      for (const velha of epocas.slice(0, Math.max(0, epocas.length - EPOCAS_GUARDADAS))) delete guardados[velha];
      await guarda.guardar(kSegredos(grupo), guardados);
    }
    const segredos = segredosDaEpoca(exportado, id, tipo);
    exportado.fill(0);
    return { epoca, segredos };
  }

  /** Os segredos de uma época que este aparelho viu (null se não viu). */
  async function segredosDe(grupo: string, epoca: number | bigint): Promise<SegredosDaEpoca | null> {
    const guardados = (await guarda.ler<Record<string, string>>(kSegredos(grupo))) ?? {};
    const b64 = guardados[epoca.toString()];
    if (!b64) return null;
    const exportado = deB64(b64);
    try {
      return segredosDaEpoca(exportado, idDoGrupo(tipo, grupo), tipo);
    } finally {
      exportado.fill(0);
    }
  }

  /** As folhas da árvore (nome e impressão de cada uma). */
  async function folhas(a: AparelhoMls, grupo: string): Promise<(Membro & { impressao: string })[]> {
    const cid = new a.M.ConversationId(idDoGrupo(tipo, grupo));
    return a.operar(null, async (c) => {
      const ids = await c.getClientIds(cid);
      const identidades = await c.getDeviceIdentities(cid, ids);
      return identidades.map((i) => {
        const nome = i.clientId ? nomeDe(i.clientId.copyBytes()) : null;
        if (!nome) throw erro("grupo_suspeito");
        return { ...nome, impressao: i.thumbprint };
      });
    });
  }

  /**
   * Confere a árvore: nenhum nome duas vezes, e cada folha que FICA no grupo (as que o servidor ainda lista) aceita pela política.
   * A folha que o servidor deixou de listar sai no commit seguinte (não precisa mais do certificado). Lança "grupo_suspeito".
   */
  async function conferirArvore(a: AparelhoMls, grupo: string, listadas: ReadonlySet<string>): Promise<(Membro & { impressao: string })[]> {
    const lista = await folhas(a, grupo);
    const nomes = new Set<string>();
    for (const f of lista) {
      if (nomes.has(f.nome)) throw erro("grupo_suspeito");
      nomes.add(f.nome);
      if (f.nome === a.eu.nome || !listadas.has(f.nome)) continue;
      if (!(await politica.aceitarFolha(f))) throw erro("grupo_suspeito");
    }
    return lista;
  }

  /**
   * Faz um commit (remoção, entrada ou troca de chave) pela rota: embrulha com a chave da época atual, grava no servidor marcado
   * com a época seguinte, e só então a biblioteca junta ao estado. Devolve "ocupada" se outro aparelho gravou essa época antes.
   */
  async function comitar(
    a: AparelhoMls,
    grupo: string,
    para: string[],
    fazer: (c: Contexto, cid: ConversationId) => Promise<unknown>,
  ): Promise<"ok" | "ocupada"> {
    const id = idDoGrupo(tipo, grupo);
    const cid = new a.M.ConversationId(id);
    const { epoca, exportado } = await exportar(a, cid);
    const s = segredosDaEpoca(exportado, id, tipo);
    exportado.fill(0);
    let resultado: "ok" | "ocupada" | null = null;
    try {
      await a.operar(
        async (pacote) => {
          const corpo = await embrulhar(s.embrulho, s.amarra, epoca, TIPO.commit, pacote.commit);
          const welcome = pacote.welcome?.serialize();
          resultado = await transporte.gravarCommit(grupo, Number(epoca) + 1, corpo, welcome ? para.map((p) => ({ para: p, welcome })) : []);
          if (resultado !== "ok") throw new a.M.MlsTransportError.MessageRejected({ reason: "ocupada" });
        },
        (c) => fazer(c, cid),
      );
    } catch (e) {
      if (resultado === "ocupada") return "ocupada";
      throw e;
    }
    if (resultado !== "ok") throw erro("commit_nao_saiu");
    return "ok";
  }

  /** Confere um pacote de chave vindo do servidor antes de pôr a pessoa no grupo. */
  async function pacoteAceito(lido: PacoteLido | null, membros: string[], pedidos: Set<string>): Promise<boolean> {
    if (!lido || lido.suite !== SUITE_MLS || !membros.includes(lido.usuario) || !pedidos.has(lido.nome)) return false;
    return politica.aceitarFolha(lido);
  }

  /**
   * Leva o grupo deste aparelho à época mais nova do servidor e acerta quem está nele com quem o servidor diz ser do grupo.
   * Devolve a época atual e os segredos dela, ou null se este aparelho não está no grupo (e ainda não recebeu as boas-vindas).
   */
  async function sincronizarAgora(grupo: string): Promise<{ epoca: bigint; segredos: SegredosDaEpoca } | null> {
    const a = await opcoes.aparelho();
    const id = idDoGrupo(tipo, grupo);
    const cid = new a.M.ConversationId(id);
    for (let volta = 0; volta < 8; volta++) {
      let existe = await a.operar(null, (c) => c.conversationExists(cid));
      let atual = existe ? Number(await a.operar(null, (c) => c.conversationEpoch(cid))) : 0;
      const banco = await transporte.estado(grupo, existe ? atual : 0);
      // 1. Sem o grupo aqui: entra pelas boas-vindas (se houver) ou cria (se o grupo ainda não existe no servidor).
      if (!existe && banco.boasvindas) {
        const marca = `${grupo}:${banco.boasvindas.epoca}`;
        if (!boasvindasUsadas.has(marca)) {
          // Cada boas-vindas é usada uma vez só: a que já serviu e depois foi seguida de uma remoção não traz este aparelho de volta.
          boasvindasUsadas.add(marca);
          try {
            const entrou = await a.operar(null, (c) => c.processWelcomeMessage(new a.M.Welcome(banco.boasvindas!.welcome)));
            if (!entrou.equals(cid)) {
              await a.operar(null, (c) => c.wipeConversation(entrou));
              throw erro("grupo_invalido");
            }
            await anotar(a, grupo);
            continue;
          } catch {
            // não serviu (pacote de chave que este aparelho não tem mais, ou mexida): fica marcada e não é tentada de novo
          }
        }
      }
      let criado = false;
      if (!existe) {
        if (banco.epoca !== null) return null; // o grupo existe e ainda não me puseram: espera as boas-vindas
        await a.operar(null, (c) => c.createConversation(cid, a.ref));
        await anotar(a, grupo);
        existe = criado = true;
        atual = 0;
      }
      // 2. Os commits que faltam, em ordem, cada um aberto com a chave da época em que foi feito.
      let saiu = false;
      for (const c of [...banco.commits].sort((x, y) => x.epoca - y.epoca)) {
        if (criado || c.epoca <= atual) continue;
        if (c.epoca !== atual + 1) break;
        const s = await segredosDe(grupo, atual);
        const aberto = s ? await desembrulhar(s.embrulho, s.amarra, c.corpo, TIPO.commit) : null;
        if (!aberto || aberto.epoca !== BigInt(atual)) throw erro("grupo_invalido");
        let r;
        try {
          r = await a.operar(null, (x) => x.decryptMessage(cid, aberto.bytes));
        } catch {
          throw erro("grupo_invalido");
        }
        if (String(r.tag) !== "Commit" || !("isActive" in r.inner)) throw erro("grupo_invalido");
        if (!r.inner.isActive || !(await a.operar(null, (x) => x.conversationExists(cid)))) {
          saiu = true;
          break;
        }
        atual = Number((await anotar(a, grupo)).epoca);
      }
      // Fui tirado: o estado foi apagado pela biblioteca. Se já me puseram de novo (boas-vindas novas), a próxima volta entra por elas.
      if (saiu) continue;
      if (banco.epoca !== null && atual < banco.epoca) {
        if (!banco.commits.some((c) => c.epoca === atual + 1)) throw erro("grupo_atrasado");
        continue; // há mais commits do que vieram nesta leitura
      }
      // 3. A árvore confere?
      const listadas = new Set(banco.folhas);
      const arvore = await conferirArvore(a, grupo, listadas);
      if (!banco.membros.includes(a.eu.usuario) || !banco.folhas.includes(a.eu.nome)) {
        if (criado) await a.operar(null, (c) => c.wipeConversation(cid));
        return null;
      }
      // 4. Quem saiu e quem entrou no grupo desde a última época.
      const reentrar = new Set(banco.reentrar ?? []);
      const sair = arvore.filter((f) => f.nome !== a.eu.nome && (!banco.membros.includes(f.usuario) || !banco.folhas.includes(f.nome) || reentrar.has(f.nome)));
      if (sair.length) {
        const r = await comitar(a, grupo, [], (c, g) => c.removeClientsFromConversation(g, sair.map((f) => new a.M.ClientId(new a.M.Uuid(f.usuario), new a.M.DeviceId(BigInt(`0x${f.dispositivo}`)), "alumia.invalid"))));
        if (r === "ocupada") continue;
        await anotar(a, grupo);
        continue;
      }
      const presentes = new Set(arvore.map((f) => f.nome));
      const faltam = banco.folhas.filter((x) => !presentes.has(x) && x !== a.eu.nome && banco.membros.includes(lerNome(x)?.usuario ?? ""));
      const entram: { para: string; pacote: KeyPackage }[] = [];
      if (faltam.length) {
        const pedidos = new Set(faltam.slice(0, ENTRADAS_POR_COMMIT));
        for (const p of await transporte.pacotes(grupo, [...pedidos])) {
          const lido = lerPacote(p.pacote);
          if (!(await pacoteAceito(lido, banco.membros, pedidos))) continue;
          pedidos.delete(lido!.nome);
          entram.push({ para: p.para, pacote: new a.M.KeyPackage(p.pacote) });
        }
      }
      if (!entram.length) {
        if (!criado) return { epoca: BigInt(atual), segredos: (await segredosDe(grupo, atual))! };
        // Grupo novo sem mais ninguém por enquanto: registra a época 1 no servidor com uma troca de chave.
        const r = await comitar(a, grupo, [], (c, g) => c.updateKeyingMaterial(g));
        if (r === "ocupada") {
          await a.operar(null, (c) => c.wipeConversation(cid));
          continue;
        }
        return anotar(a, grupo);
      }
      const r = await comitar(
        a,
        grupo,
        entram.map((e) => e.para),
        (c, g) => c.addClientsToConversation(g, entram.map((e) => e.pacote)),
      );
      if (r === "ocupada") {
        if (criado) await a.operar(null, (c) => c.wipeConversation(cid));
        continue;
      }
      await anotar(a, grupo);
      await conferirArvore(a, grupo, listadas);
    }
    throw erro("versao_ocupada");
  }

  /** Troca a chave da própria folha (commit com caminho de atualização). null: outro aparelho avançou antes. */
  async function trocarFolha(a: AparelhoMls, grupo: string): Promise<{ epoca: bigint; segredos: SegredosDaEpoca } | null> {
    const r = await comitar(a, grupo, [], (c, g) => c.updateKeyingMaterial(g));
    if (r === "ocupada") return null;
    const novo = await anotar(a, grupo);
    await guarda.guardar(kFolha(grupo), { em: agora(), mandadas: 0 });
    return novo;
  }

  /** A folha passou do prazo (7 dias) ou da contagem (200 mensagens)? Na primeira vez, só começa a contar. */
  async function folhaVencida(grupo: string): Promise<boolean> {
    const r = await guarda.ler<{ em: number; mandadas: number }>(kFolha(grupo));
    if (!r) {
      await guarda.guardar(kFolha(grupo), { em: agora(), mandadas: 0 });
      return false;
    }
    return agora() - r.em > FOLHA_DIAS * 86_400_000 || r.mandadas >= FOLHA_MENSAGENS;
  }

  /** Depois de sincronizar: troca a folha se venceu. Perder a corrida ou dar erro não impede nada (fica para a próxima). */
  async function sincronizarERenovar(grupo: string): Promise<{ epoca: bigint; segredos: SegredosDaEpoca } | null> {
    const atual = await sincronizarAgora(grupo);
    if (!atual) return atual;
    try {
      if (!(await folhaVencida(grupo))) return atual;
      return (await trocarFolha(await opcoes.aparelho(), grupo)) ?? atual;
    } catch {
      return atual;
    }
  }

  function sincronizar(grupo: string): Promise<{ epoca: bigint; segredos: SegredosDaEpoca } | null> {
    const antes = emCurso.get(grupo) ?? Promise.resolve();
    const vez = antes.then(
      () => sincronizarERenovar(grupo),
      () => sincronizarERenovar(grupo),
    );
    emCurso.set(grupo, vez.catch(() => undefined));
    return vez;
  }

  return {
    sincronizar,
    /** O nome de membro deste aparelho (para publicar no banco junto dos pacotes de chave). */
    async nome(): Promise<string> {
      return (await opcoes.aparelho()).eu.nome;
    },
    /** Os segredos de uma época já vista por este aparelho (para reler). */
    segredosDe,
    /**
     * Troca a chave da própria folha (segurança depois do comprometimento: um aparelho tomado deixa de servir quando o grupo avança).
     * Devolve a época nova, ou null se outro aparelho avançou antes (a próxima sincronização lê o dele).
     */
    async renovar(grupo: string): Promise<bigint | null> {
      const a = await opcoes.aparelho();
      if ((await sincronizar(grupo)) === null) return null;
      return (await trocarFolha(a, grupo))?.epoca ?? null;
    },
    /**
     * Conta uma mensagem mandada por este aparelho no grupo (onda R3): na 200ª desde a última troca, a próxima sincronização troca a
     * folha. Quem manda chama isto depois de cada mensagem; nunca falha.
     */
    async aoMandar(grupo: string): Promise<void> {
      try {
        const r = (await guarda.ler<{ em: number; mandadas: number }>(kFolha(grupo))) ?? { em: agora(), mandadas: 0 };
        await guarda.guardar(kFolha(grupo), { em: r.em, mandadas: r.mandadas + 1 });
      } catch {
        /* a contagem é só um gatilho a mais: o prazo de 7 dias continua valendo */
      }
    },
    /** Pacotes de chave novos deste aparelho (em bytes), para publicar. */
    async gerarPacotes(n: number): Promise<Uint8Array[]> {
      const a = await opcoes.aparelho();
      const saida: Uint8Array[] = [];
      for (let i = 0; i < n; i++) saida.push((await a.operar(null, (c) => c.generateKeyPackage(a.ref))).serialize());
      return saida;
    },
    /** As folhas da árvore deste aparelho para o grupo (para a tela e os testes). */
    async folhas(grupo: string) {
      const a = await opcoes.aparelho();
      if (!(await a.operar(null, (c) => c.conversationExists(new a.M.ConversationId(idDoGrupo(tipo, grupo)))))) return [];
      return folhas(a, grupo);
    },
    /** Esquece o grupo neste aparelho (estado do MLS e segredos guardados). */
    async esquecer(grupo: string): Promise<void> {
      const a = await opcoes.aparelho();
      const cid = new a.M.ConversationId(idDoGrupo(tipo, grupo));
      if (await a.operar(null, (c) => c.conversationExists(cid))) await a.operar(null, (c) => c.wipeConversation(cid));
      await guarda.apagar(kSegredos(grupo));
      await guarda.apagar(kFolha(grupo));
    },
  };
}

export type MotorDeGrupo = ReturnType<typeof criarMotorDeGrupo>;
