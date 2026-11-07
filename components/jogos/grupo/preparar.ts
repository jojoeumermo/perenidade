// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O anfitrião monta o conteúdo da partida no próprio navegador: o glossário, as frases, as datas e as checagens já vieram
// com a página; as questões de uma disciplina e os cartões de debate são baixados agora, do próprio site
// (/api/jogos-em-grupo/<banco>, um arquivo estático igual para todo mundo). Só quem anima a sala baixa; quem joga recebe
// cada pergunta pela sala, na hora dela.
import type { Verbete } from "@/lib/jogos/base";
import { criarSorteio, sementeNova } from "@/lib/jogos/base";
import { cartasDaHistoria, conceitosDoBingo, palavrasDaForca, perguntasDeChecagens, perguntasDeFrases, perguntasDoBanco, perguntasDoGlossario, type ChecagemDoJogo, type FatoComAno, type FraseParaJogo, type QuestaoDoBanco, type TemaDeDebate } from "@/lib/jogos/grupo/banco";
import type { IdDoJogoEmGrupo, Opcoes, Pacote } from "@/lib/jogos/grupo/motor";

export interface DisciplinaDoJogo {
  area: string;
  nome: string;
  n: number;
}

export interface BancoDoGrupo {
  verbetes: Verbete[];
  frases: FraseParaJogo[];
  fatos: FatoComAno[];
  checagens: ChecagemDoJogo[];
  disciplinas: DisciplinaDoJogo[];
}

const guardados = new Map<string, Promise<unknown>>();
function baixar<T>(banco: string): Promise<T> {
  if (!/^[a-z0-9-]{2,40}$/.test(banco)) return Promise.reject(new Error("banco"));
  if (!guardados.has(banco)) {
    const pedido = fetch(`/api/jogos-em-grupo/${banco}`, { credentials: "omit" }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
    pedido.catch(() => guardados.delete(banco));
    guardados.set(banco, pedido);
  }
  return guardados.get(banco) as Promise<T>;
}

/**
 * Os endereços das fontes de um cartão de debate, como estão no banco do próprio site (T33). Quem joga só mostra como link
 * a fonte que bate com o banco: a vista pode vir de um anfitrião que não é o site, e um link qualquer levaria a criança para
 * fora (um grupo de mensagens, por exemplo). Sem o banco, nenhum link.
 */
export async function urlsDasFontes(slug: string): Promise<Set<string>> {
  const { temas } = await baixar<{ temas: TemaDeDebate[] }>("debates");
  const tema = temas.find((t) => t.slug === slug);
  return new Set((tema?.fontes ?? []).map((f) => f.url ?? "").filter(Boolean));
}

/** Bingo: cartela 3x3 com 18 conceitos (uma partida de uns 15 minutos), ou 4x4 com 30 quando pedem mais rodadas. */
export const ladoDoBingo = (rodadas: number) => (rodadas >= 12 ? 4 : 3);

export async function montarPacote(jogo: IdDoJogoEmGrupo, opcoes: Opcoes, banco: BancoDoGrupo): Promise<Pacote | null> {
  const rnd = criarSorteio(sementeNova());
  const n = opcoes.rodadas;
  switch (jogo) {
    case "corrida":
    case "mutirao": {
      if (opcoes.fonte === "glossario") return { tipo: "perguntas", perguntas: perguntasDoGlossario(banco.verbetes, n, rnd) };
      const { questoes } = await baixar<{ questoes: QuestaoDoBanco[] }>(opcoes.fonte);
      return { tipo: "perguntas", perguntas: perguntasDoBanco(questoes, n, rnd) };
    }
    case "quem-disse":
      return { tipo: "perguntas", perguntas: perguntasDeFrases(banco.frases, n, rnd) };
    case "fato-ou-boato":
      return { tipo: "perguntas", perguntas: perguntasDeChecagens(banco.checagens, n, rnd) };
    case "assembleia": {
      const { temas } = await baixar<{ temas: TemaDeDebate[] }>("debates");
      if (!temas.length) return null;
      return { tipo: "debate", tema: temas[Math.floor(rnd() * temas.length)] };
    }
    case "forca":
      return { tipo: "forca", palavras: palavrasDaForca(banco.verbetes, n, rnd) };
    case "bingo": {
      const lado = ladoDoBingo(n);
      return { tipo: "bingo", conceitos: conceitosDoBingo(banco.verbetes, lado === 4 ? 30 : 18, rnd), lado, semente: sementeNova() };
    }
    case "fio":
      return { tipo: "fio", cartas: cartasDaHistoria(banco.fatos, n + 1, rnd) };
  }
}
