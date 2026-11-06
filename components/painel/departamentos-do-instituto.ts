// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os departamentos do instituto, na ordem e com os nomes dos grupos da equipe (T30, novembro de 2026). O id é o nome
// interno guardado no banco e não muda (nada se perde: "jornalismo" continua sendo a Comunicação, "mentoria" o Reforço).
// Há dois jeitos de ser de um departamento:
//   - por função de trabalho (quem tem a função de revisão é da Revisão), como sempre foi;
//   - por participação (Parcerias, Influenciadores, Representantes, RH, Revolucionários), escolhida pela coordenação em
//     Pessoas › Confiar função. Fica em interno.departamento_membros (supabase/migracoes/20261106-pessoas-painel.sql).
// Revolucionários é dado sensível (opinião e filiação política, LGPD art. 5º, II, e art. 11): quem participa só aparece
// para a coordenação e para o próprio departamento.

import type { Role } from "@/lib/backend";

export interface DepartamentoDoInstituto {
  id: string;
  /** O nome que aparece no painel (o do grupo da equipe). */
  nome: string;
  /** Uma linha: quem é e o que faz. */
  sobre: string;
  /** As funções que põem a pessoa no departamento. Vazio: só por participação. */
  funcoes: Role["papel"][];
  /** Entra-se por participação (escolha da coordenação), não por função. */
  participacao?: boolean;
  /** Quem participa é dado sensível: só a coordenação vê e põe ou tira. */
  sensivel?: boolean;
}

export const DEPARTAMENTOS_DO_INSTITUTO: DepartamentoDoInstituto[] = [
  { id: "coordenacao", nome: "Coordenação", sobre: "Coordenação comunitária e pedagógica: decide, acompanha e responde pelo instituto.", funcoes: ["coordenacao", "vice"] },
  { id: "parcerias", nome: "Parcerias", sobre: "Os coletivos parceiros: quem constrói junto com o instituto, cada um no seu território.", funcoes: [], participacao: true },
  { id: "jornalismo", nome: "Comunicação", sobre: "Jornal, rádio, podcast e marketing: o que o instituto diz e como chega às pessoas.", funcoes: ["jornalismo", "marketing"] },
  { id: "design", nome: "Arte e design (Comunicação)", sobre: "Arte e design gráfico das peças, das páginas e das campanhas.", funcoes: ["design", "marketing"] },
  { id: "influenciadores", nome: "Influenciadores", sobre: "Quem leva o instituto para as redes com a própria voz: criadores de conteúdo e perfis parceiros.", funcoes: [], participacao: true },
  { id: "representantes", nome: "Representantes", sobre: "Os representantes de todos os departamentos juntos. Quem é nomeado representante entra sozinho.", funcoes: ["representante"], participacao: true },
  { id: "rh", nome: "RH · Recursos Humanos", sobre: "Acolher quem chega, acompanhar voluntários (termos, horas, férias) e cuidar da equipe.", funcoes: [], participacao: true },
  { id: "revisao", nome: "Revisão", sobre: "Revisão dos textos, das aulas e das matérias antes de irem ao ar.", funcoes: ["revisao"] },
  { id: "desenvolvimento", nome: "UI/UX e Desenvolvimento", sobre: "O site, o painel e as ferramentas: desenho de telas e programação.", funcoes: ["desenvolvimento"] },
  { id: "traducao", nome: "Tradução", sobre: "As versões do site e dos materiais em outros idiomas.", funcoes: ["traducao"] },
  { id: "mentoria", nome: "Reforço", sobre: "Aula de reforço, por disciplina.", funcoes: ["mentoria"] },
  { id: "saude", nome: "Saúde", sobre: "Profissionais de saúde do Mural de Saúde.", funcoes: ["saude"] },
  { id: "mediacao", nome: "Mediação", sobre: "Comunidade e mediação: cuidar das conversas, das denúncias e do acolhimento.", funcoes: ["mediacao"] },
  { id: "curadoria", nome: "Acervo e curadoria", sobre: "O acervo, a biblioteca e a curadoria do que entra no site.", funcoes: ["curadoria"] },
  { id: "educacao", nome: "Educadores", sobre: "Quem ensina, por disciplina (as áreas reúnem as disciplinas). Também chamado de Pedagógico.", funcoes: ["educacao", "educacao_secundaria"] },
  { id: "revolucionarios", nome: "Revolucionários", sobre: "Os militantes da Frente Revolucionária Lúcia. Quem participa só aparece para a coordenação e para o próprio departamento.", funcoes: [], participacao: true, sensivel: true },
];

/** Os departamentos em que se entra por participação (o mesmo de interno.departamentos_de_participacao no banco). */
export const DEPARTAMENTOS_DE_PARTICIPACAO = DEPARTAMENTOS_DO_INSTITUTO.filter((d) => d.participacao);

/** id → nome, na ordem dos grupos da equipe. */
export const NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO: Record<string, string> = Object.fromEntries(DEPARTAMENTOS_DO_INSTITUTO.map((d) => [d.id, d.nome]));
