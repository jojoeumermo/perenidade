// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os recados da Mesa em grupos (T27, 06/11/2026: "os recados deixa mais organizado, ta um monte de informação jogada").
// Antes era uma lista corrida, com o mesmo recado repetido ("Sua conta foi aberta em um aparelho novo" duas vezes no mesmo
// minuto). Agora: grupos por assunto, na ordem do que pede atenção (acessos à própria conta primeiro), o que não foi lido no
// alto de cada grupo e os recados iguais juntos numa linha só ("2 vezes"). Função pura, sem React: `npm run testar:mesa`
// a confere direto no Node. Nada sai do aparelho: o agrupamento é feito na tela, com o que o banco já devolvia.

export interface RecadoBruto {
  id: string;
  texto: string;
  lido: boolean;
  criado_em: string;
  /** "conta", "rede" ou "equipe" (interno.avisos.categoria). Só vem depois da migração 20261106-painel-recados.sql. */
  categoria?: string | null;
}

export type GrupoDeRecado = "acesso" | "equipe" | "contribuicoes" | "rede" | "outros";

export const NOME_DO_GRUPO: Record<GrupoDeRecado, string> = {
  acesso: "Acessos e aparelhos",
  equipe: "Equipe e funções",
  contribuicoes: "Contribuições e publicação",
  rede: "Rede",
  outros: "Outros recados",
};

/** A ordem dos grupos na tela: segurança da conta antes, o resto depois. */
export const ORDEM_DOS_GRUPOS: GrupoDeRecado[] = ["acesso", "equipe", "contribuicoes", "rede", "outros"];

/** Um recado na tela: o mais novo de um conjunto de recados iguais. */
export interface RecadoJunto {
  id: string;
  texto: string;
  /** Algum dos iguais ainda não foi lido. */
  novo: boolean;
  /** Quando chegou o mais novo. */
  em: string;
  /** Quantos recados iguais (mesmo texto) ficaram nesta linha. */
  vezes: number;
}

export interface GrupoDeRecados {
  grupo: GrupoDeRecado;
  nome: string;
  novos: number;
  itens: RecadoJunto[];
}

/** Para que serve o recado, pelo texto (os textos vêm das funções do banco, sempre no mesmo molde). */
export function grupoDoRecado(r: Pick<RecadoBruto, "texto" | "categoria">): GrupoDeRecado {
  const t = r.texto.toLocaleLowerCase("pt-BR");
  if (/aparelho|senha|verifica[çc][ãa]o em duas|2fa|chave de acesso|impress[ãa]o digital|sess[ãa]o|entrou na sua conta/.test(t)) return "acesso";
  if (r.categoria === "conta") return "acesso";
  if (r.categoria === "rede") return "rede";
  if (/fun[çc][ãa]o|papel|departamento|convite|coordena|supervis|volunt[áa]ri|agradec|equipe|f[ée]rias/.test(t)) return "equipe";
  if (/contribui|envio|enviad|publica|revis|rascunho|aula|corre[çc][ãa]o|texto/.test(t)) return "contribuicoes";
  return "outros";
}

/**
 * Junta e ordena: grupos na ORDEM_DOS_GRUPOS (só os que têm recado); dentro de cada um, os não lidos primeiro e, em cada
 * lado, do mais novo para o mais antigo; recados de texto igual viram uma linha só.
 */
export function agruparRecados(recados: RecadoBruto[]): GrupoDeRecados[] {
  const porGrupo = new Map<GrupoDeRecado, Map<string, RecadoJunto>>();
  const ordenados = [...recados].sort((a, b) => (a.criado_em < b.criado_em ? 1 : a.criado_em > b.criado_em ? -1 : 0));
  for (const r of ordenados) {
    const g = grupoDoRecado(r);
    const iguais = porGrupo.get(g) ?? new Map<string, RecadoJunto>();
    porGrupo.set(g, iguais);
    const chave = r.texto.trim();
    const ja = iguais.get(chave);
    if (ja) {
      ja.vezes += 1;
      ja.novo = ja.novo || !r.lido;
    } else {
      iguais.set(chave, { id: r.id, texto: r.texto, novo: !r.lido, em: r.criado_em, vezes: 1 });
    }
  }
  return ORDEM_DOS_GRUPOS.filter((g) => porGrupo.has(g)).map((g) => {
    const itens = [...porGrupo.get(g)!.values()];
    // sort é estável: dentro do mesmo lado fica a ordem do mais novo para o mais antigo.
    itens.sort((a, b) => Number(b.novo) - Number(a.novo));
    return { grupo: g, nome: NOME_DO_GRUPO[g], novos: itens.filter((i) => i.novo).length, itens };
  });
}
