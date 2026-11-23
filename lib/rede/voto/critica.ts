// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de críticas anônimas da equipe, do lado do servidor (app/api/alumia/voto/marca/route.ts). Duas peças, as duas só na memória
// do processo, para que nem quem tem o servidor ou os registros ligue a crítica a quem a mandou:
//   - a cota (três por dia): um contador por HMAC-SHA-256(ALUMIA_VOTO_SEGREDO, conta|dia), sem o id da pessoa e sem a hora de cada
//     envio. Vira o dia (São Paulo), tudo some;
//   - a fila: a crítica aceita não é gravada na requisição. Ela espera numa fila só com o texto e o destino (nem a hora de chegada), e
//     sai em lote embaralhado depois de um ou dois intervalos sorteados, longe da conferência da pessoa (que fica nos registros do
//     serviço de contas). Com isso, nem a ordem das linhas em interno.criticas nem a hora da gravação casam com quem mandou.
// O preço: uma crítica na fila se perde se o processo do site parar antes do lote sair (troca de versão). A tela avisa que a crítica
// chega em até uma hora.
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node.
import { createHmac, randomInt } from "node:crypto";
import { embaralhar } from "./servidor";

/** O dia de hoje em São Paulo (AAAA-MM-DD): a cota vira junto com o dia da equipe. */
export function diaDeSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export type CotaDaCritica = {
  /** Conta mais um envio desta conta hoje. Falso se a cota do dia acabou. */
  (segredo: string, conta: string, hoje?: string): boolean;
  /** O que a cota guarda (para o teste): o dia e, por chave opaca, só quantos envios. */
  retrato(): { dia: string; chaves: [string, number][] };
};

/** A cota de `maximo` críticas por dia por pessoa, sem guardar a pessoa nem a hora. */
export function criarCotaDaCritica(maximo: number): CotaDaCritica {
  let dia = "";
  const contas = new Map<string, number>();
  const cota = ((segredo: string, conta: string, hoje: string = diaDeSaoPaulo()) => {
    if (hoje !== dia) {
      contas.clear();
      dia = hoje;
    }
    const chave = createHmac("sha256", segredo).update(`alumia:voto:critica-cota:${conta}|${hoje}`).digest("hex");
    const usados = contas.get(chave) ?? 0;
    if (usados >= maximo) return false;
    contas.set(chave, usados + 1);
    return true;
  }) as CotaDaCritica;
  cota.retrato = () => ({ dia, chaves: [...contas.entries()] });
  return cota;
}

export type CriticaNaFila = { texto: string; para: string };
type Item = CriticaNaFila & { tentativas: number };

export type OpcoesDaFila = {
  /** Grava uma crítica no banco. Verdadeiro se gravou. */
  gravar: (c: CriticaNaFila) => Promise<boolean>;
  /** O intervalo entre dois lotes, sorteado entre os dois (ms). */
  menorMs?: number;
  maiorMs?: number;
  /** Para o teste: o agendador. */
  agendar?: (f: () => Promise<void>, ms: number) => unknown;
};

/**
 * A fila das críticas: guarda só texto e destino (nem a hora de chegada) e grava em lote embaralhado. Em cada volta, sai o lote que
 * chegou ANTES da volta anterior, e o que chegou desde então passa a esperar a próxima: toda crítica espera pelo menos um intervalo
 * sorteado inteiro, e a que chega perto de uma saída não sai nela.
 */
export function criarFilaDaCritica({ gravar, menorMs = 10 * 60_000, maiorMs = 30 * 60_000, agendar }: OpcoesDaFila) {
  let chegando: Item[] = [];
  let prontas: Item[] = [];
  let marcado = false;
  const programar = (f: () => Promise<void>, ms: number) => {
    if (agendar) return agendar(f, ms);
    const t = setTimeout(() => void f(), ms);
    t.unref?.();
    return t;
  };

  function agendarVolta() {
    if (marcado || chegando.length + prontas.length === 0) return;
    marcado = true;
    programar(() => volta(), menorMs + randomInt(Math.max(1, maiorMs - menorMs + 1)));
  }

  /** Uma volta: grava as prontas, em ordem sorteada (as que falharem tentam de novo, até três vezes), e as que chegaram passam a prontas. */
  async function volta() {
    marcado = false;
    const lote = embaralhar(prontas, (n) => randomInt(n));
    prontas = chegando;
    chegando = [];
    for (const c of lote) {
      let gravou = false;
      try {
        gravou = await gravar({ texto: c.texto, para: c.para });
      } catch {
        gravou = false;
      }
      if (!gravou && c.tentativas < 2) prontas.push({ ...c, tentativas: c.tentativas + 1 });
    }
    agendarVolta();
  }

  return {
    /** Põe na fila. Falso se a fila está cheia (o banco está fora há muito tempo). */
    por(c: CriticaNaFila): boolean {
      if (chegando.length + prontas.length >= 500) return false;
      chegando.push({ texto: c.texto, para: c.para, tentativas: 0 });
      agendarVolta();
      return true;
    },
    tamanho: () => chegando.length + prontas.length,
    /** O que a fila guarda (para o teste). */
    retrato: () => [...prontas, ...chegando],
    volta,
  };
}
