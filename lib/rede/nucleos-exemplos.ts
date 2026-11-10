// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ dos núcleos e da turma do mês (rede_com_nucleos, rede_com_nucleo, rede_com_nucleo_linha, rede_com_nucleo_sair,
// rede_com_encontro_salvar, rede_com_encontro_remover, rede_com_turma, rede_com_turma_entrar), só para a prévia
// (NEXT_PUBLIC_ALUMIA_PREVIA=sim). Tudo na memória da aba; nada sai do aparelho. Encontros só em lugar público, como no banco;
// a mediação aparece por codinome. Nomes inventados, nenhuma pessoa real. Sem "@/" de propósito (roda no Node nos testes).
import { postDeExemplo } from "./conversa/exemplos";
import type { PaginaDaLinha } from "./tipos";
import type { EncontroDoNucleo, LocalDoEncontro, NucleoResumo, PaginaDoNucleo, SituacaoDaTurma } from "./tipos-comunidades";

const DIA = 86_400_000;
const MIN = 60_000;

/** Os ids têm a forma de uuid (as telas conferem o id antes de pedir). */
export const NUCLEOS_DE_EXEMPLO = {
  itaquera: "00000000-0000-4000-8000-00000000e101",
  ufpe: "00000000-0000-4000-8000-00000000e102",
} as const;

interface Estado {
  nucleos: (PaginaDoNucleo & { saiu: boolean })[];
  turma: SituacaoDaTurma;
  seq: number;
}

function estadoInicial(agora: number, mes: string): Estado {
  const dia = (n: number, h: number) => {
    const d = new Date(agora + n * DIA);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const encontro = (id: string, quando: string, local_tipo: LocalDoEncontro, local_texto: string): EncontroDoNucleo => ({ id, quando, local_tipo, local_texto });
  return {
    seq: 0,
    turma: { mes, slug: "marxismo", inscrito: true, entrou: false },
    nucleos: [
      {
        id: NUCLEOS_DE_EXEMPLO.itaquera,
        nome: "Núcleo Passe Livre Itaquera",
        cidade: "São Paulo",
        trilha: "introducao-ao-marxismo",
        papel: "mediacao",
        mediacao: ["Faísca", "Sara do Grajaú"],
        encontros: [
          encontro("exemplo-enc-1", dia(2, 19), "biblioteca", "Biblioteca Pública de Itaquera, sala 2"),
          encontro("exemplo-enc-2", dia(9, 10), "praca", "Praça Brasil, perto do coreto"),
        ],
        saiu: false,
      },
      {
        id: NUCLEOS_DE_EXEMPLO.ufpe,
        nome: "Núcleo de leitura do DCE",
        cidade: "Recife",
        trilha: null,
        papel: "membro",
        mediacao: ["Rosa Vermelha"],
        encontros: [encontro("exemplo-enc-3", dia(4, 18), "universidade", "Centro de Convivência da UFPE")],
        saiu: false,
      },
    ],
  };
}

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

/** As respostas do dublê às funções dos núcleos e da turma. */
export function criarDubleDosNucleos(agora: number = Date.now(), mes = new Date(agora).toISOString().slice(0, 7), estado: Estado = estadoInicial(agora, mes)) {
  const achar = (id: unknown) => {
    const n = estado.nucleos.find((x) => x.id === id && !x.saiu);
    if (!n) throw erro("nao_encontrado");
    return n;
  };
  const resumo = ({ id, nome, cidade, trilha, papel }: PaginaDoNucleo): NucleoResumo => ({ id, nome, cidade, trilha, papel });
  const mural = (n: PaginaDoNucleo): PaginaDaLinha => {
    const base = { comunidade: null, publico: "nucleo" as const };
    const itens =
      n.id === NUCLEOS_DE_EXEMPLO.itaquera
        ? [
            postDeExemplo({ ...base, id: "exemplo-nucleo-1", texto: "Pauta de quinta: mapa das linhas que mais atrasam e a carta para a subprefeitura. Quem puder, traga os horários anotados da semana.", autor: { id: null, codinome: "Sara do Grajaú", handle: "saradograjau", perfil: true, equipe: false }, criado_em: new Date(agora - 50 * MIN).toISOString(), respostas: 4 }, agora),
            postDeExemplo({ ...base, id: "exemplo-nucleo-2", texto: "Terminei o capítulo 2 da trilha. A parte do valor de troca ficou bem mais clara com o exemplo da passagem.", autor: { id: null, codinome: "Faísca", handle: "faisca", perfil: true, equipe: false }, meu: true, criado_em: new Date(agora - 300 * MIN).toISOString(), respostas: 2 }, agora),
          ]
        : [postDeExemplo({ ...base, id: "exemplo-nucleo-3", texto: "Texto da semana: o primeiro capítulo do Manifesto. Leitura em voz alta no começo do encontro.", autor: { id: null, codinome: "Rosa Vermelha", handle: "rosavermelha", perfil: true, equipe: false }, criado_em: new Date(agora - 600 * MIN).toISOString(), respostas: 6 }, agora)];
    return { itens, proximo: null };
  };
  return {
    rede_com_nucleos() {
      return { itens: estado.nucleos.filter((n) => !n.saiu).map(resumo) };
    },
    rede_com_nucleo(a: { p_id?: string }): PaginaDoNucleo {
      const { saiu: _saiu, ...n } = achar(a.p_id);
      void _saiu;
      return { ...n, encontros: [...n.encontros].sort((x, y) => x.quando.localeCompare(y.quando)) };
    },
    rede_com_nucleo_linha(a: { p_id?: string }) {
      return mural(achar(a.p_id));
    },
    rede_com_nucleo_sair(a: { p_id?: string }) {
      achar(a.p_id).saiu = true;
      return { ok: true };
    },
    rede_com_encontro_salvar(a: { p?: { nucleo?: string; quando?: string; local_tipo?: LocalDoEncontro; local_texto?: string } }) {
      const p = a.p ?? {};
      const n = achar(p.nucleo);
      if (n.papel !== "mediacao") throw erro("sem_permissao");
      if (!p.quando || Number.isNaN(Date.parse(p.quando))) throw erro("invalido");
      const id = `exemplo-enc-n${++estado.seq}`;
      n.encontros.push({ id, quando: p.quando, local_tipo: p.local_tipo ?? "praca", local_texto: (p.local_texto ?? "").slice(0, 140) });
      return { id };
    },
    rede_com_encontro_remover(a: { p_id?: string }) {
      for (const n of estado.nucleos) if (n.papel === "mediacao") n.encontros = n.encontros.filter((e) => e.id !== a.p_id);
      return { ok: true };
    },
    rede_com_turma(): SituacaoDaTurma {
      return { ...estado.turma };
    },
    rede_com_turma_entrar() {
      estado.turma.entrou = true;
      return { slug: estado.turma.slug };
    },
  };
}
