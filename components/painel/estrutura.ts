// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A estrutura do painel novo: os 8 espaços do menu, os 4 moldes de tela e o mapa "seção, espaço, molde".
// Só dados e funções puras (sem importar nada do site), para o menu, a paleta, o teste e a documentação lerem o mesmo mapa.
// Nenhuma seção some: o teste (scripts/testar-painel-fundacao.mjs) confere que todo id do registro de seções (casca/Dentro.tsx) está aqui.

export type IdDoEspaco = "mesa" | "producao" | "revisao" | "comunidade" | "equipe" | "site" | "seguranca" | "conta";
export type Molde = "fila" | "tabela" | "registro" | "configuracao";

export interface Espaco {
  id: IdDoEspaco;
  nome: string;
  /** Uma linha: para que serve o espaço. */
  sobre: string;
  /** Nome do ícone Lucide do espaço (o componente sai de icones.tsx: aqui ficam só dados, sem importar biblioteca). */
  icone: NomeDoIconeDoEspaco;
  /** Traço do ícone antigo (viewBox 24, traço de 2). Fica enquanto algo de fora ainda desenha por ele. */
  desenho: string;
}

/** Os ícones Lucide dos 8 espaços (contrato: docs/PAINEL-REDESENHO.md, seção 6). */
export type NomeDoIconeDoEspaco = "House" | "PenTool" | "CheckCheck" | "HeartHandshake" | "Users" | "Settings2" | "Shield" | "UserRound";

/** Os 8 espaços, na ordem do trabalho. */
export const ESPACOS: Espaco[] = [
  { id: "mesa", nome: "Mesa", sobre: "O que espera por você hoje.", icone: "House", desenho: "M4 11l8-7 8 7v9h-5.5v-6h-5v6H4z" },
  { id: "producao", nome: "Escrever e produzir", sobre: "Aulas, matérias, vídeos, podcast, arte e tudo o que vai para o site.", icone: "PenTool", desenho: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" },
  { id: "revisao", nome: "Revisar e publicar", sobre: "Filas de leitura, parecer e decisão do que vai ao ar.", icone: "CheckCheck", desenho: "M4 7l2 2 4-4M4 17l2 2 4-4M13 7h7M13 17h7" },
  { id: "comunidade", nome: "Comunidade e atendimento", sobre: "Quem escreve ao instituto: denúncias, dúvidas, murais e boletim.", icone: "HeartHandshake", desenho: "M4 5h16v11H10l-4.5 4v-4H4z" },
  { id: "equipe", nome: "Equipe", sobre: "Pessoas, departamentos, conversas, horas, termos e decisões coletivas.", icone: "Users", desenho: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.7-3.5 3.3-5.5 6.5-5.5s5.8 2 6.5 5.5M16 4.5a3.2 3.2 0 0 1 0 6.3M18 14.5c2 .6 3.3 2.6 3.6 5.5" },
  { id: "site", nome: "Site e operação", sobre: "Faixa, avisos de abertura, rádio, apoio e o estado técnico.", icone: "Settings2", desenho: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" },
  { id: "seguranca", nome: "Segurança", sobre: "Segundo fator, sucessão, interdição e o registro do que foi decidido.", icone: "Shield", desenho: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" },
  { id: "conta", nome: "Minha conta", sobre: "Seu perfil, suas contribuições e a proteção da sua conta.", icone: "UserRound", desenho: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" },
];

export interface Molde4 {
  id: Molde;
  nome: string;
  sobre: string;
}

/** Os 4 moldes de tela. */
export const MOLDES: Molde4[] = [
  { id: "fila", nome: "Fila", sobre: "Uma lista de coisas esperando decisão, com o item aberto ao lado: ler, decidir, próximo." },
  { id: "tabela", nome: "Tabela", sobre: "Muitos registros iguais, com busca, ordem e páginas." },
  { id: "registro", nome: "Registro", sobre: "Um item (ou uma área de trabalho) com seções e um lado de apoio." },
  { id: "configuracao", nome: "Configuração", sobre: "Grupos de campos com um rodapé que guarda tudo de uma vez." },
];

export interface Mapeamento {
  espaco: IdDoEspaco;
  molde: Molde;
}

/** Id da seção (registro de components/painel/casca/Dentro.tsx) → espaço e molde. Os 55 ids do registro, sem exceção. */
export const MAPA: Record<string, Mapeamento> = {
  // Mesa
  mesa: { espaco: "mesa", molde: "fila" },
  atividade: { espaco: "mesa", molde: "fila" },
  tarefas: { espaco: "mesa", molde: "fila" },
  // Escrever e produzir
  escrever: { espaco: "producao", molde: "registro" },
  "aulas-a-escrever": { espaco: "producao", molde: "fila" },
  minhas: { espaco: "producao", molde: "fila" },
  juntas: { espaco: "producao", molde: "fila" },
  videoaulas: { espaco: "producao", molde: "registro" },
  aovivo: { espaco: "producao", molde: "registro" },
  estudio: { espaco: "producao", molde: "registro" },
  escritorio: { espaco: "producao", molde: "registro" },
  caderno: { espaco: "producao", molde: "registro" },
  exercicios: { espaco: "producao", molde: "registro" },
  podcast: { espaco: "producao", molde: "registro" },
  pautas: { espaco: "producao", molde: "registro" },
  materiais: { espaco: "producao", molde: "registro" },
  divulgacao: { espaco: "producao", molde: "registro" },
  fontes: { espaco: "producao", molde: "registro" },
  curriculo: { espaco: "producao", molde: "registro" },
  // Revisar e publicar
  fila: { espaco: "revisao", molde: "fila" },
  triagem: { espaco: "revisao", molde: "fila" },
  "vale-curadoria": { espaco: "revisao", molde: "fila" },
  traducoes: { espaco: "revisao", molde: "fila" },
  "acervo-dentro": { espaco: "revisao", molde: "tabela" },
  // Comunidade e atendimento
  comunidade: { espaco: "comunidade", molde: "fila" },
  "rede-propostas": { espaco: "comunidade", molde: "fila" },
  "rede-semeadura": { espaco: "comunidade", molde: "tabela" },
  reforco: { espaco: "comunidade", molde: "fila" },
  mural: { espaco: "comunidade", molde: "fila" },
  gaveta: { espaco: "comunidade", molde: "fila" },
  boletim: { espaco: "comunidade", molde: "tabela" },
  saude: { espaco: "comunidade", molde: "registro" },
  // Equipe
  conversas: { espaco: "equipe", molde: "registro" },
  reunioes: { espaco: "equipe", molde: "registro" },
  rede: { espaco: "equipe", molde: "registro" },
  assembleias: { espaco: "equipe", molde: "registro" },
  nucleos: { espaco: "equipe", molde: "registro" },
  departamentos: { espaco: "equipe", molde: "registro" },
  pessoas: { espaco: "equipe", molde: "tabela" },
  escola: { espaco: "equipe", molde: "tabela" },
  supervisao: { espaco: "equipe", molde: "fila" },
  horas: { espaco: "equipe", molde: "tabela" },
  termos: { espaco: "equipe", molde: "tabela" },
  "eixos-equipe": { espaco: "equipe", molde: "configuracao" },
  // backend-2
  operacao: { espaco: "site", molde: "configuracao" },
  imprensa: { espaco: "comunidade", molde: "fila" },
  ensino: { espaco: "producao", molde: "registro" },
  previa: { espaco: "equipe", molde: "configuracao" },
  estatisticas: { espaco: "equipe", molde: "tabela" },
  avisos: { espaco: "equipe", molde: "configuracao" },
  biblioteca: { espaco: "equipe", molde: "registro" },
  // backend-1
  "controles-avancados": { espaco: "site", molde: "configuracao" },
  confirmacoes: { espaco: "seguranca", molde: "fila" },
  // Site e operação
  site: { espaco: "site", molde: "configuracao" },
  centro: { espaco: "site", molde: "registro" },
  abertura: { espaco: "site", molde: "configuracao" },
  emissoras: { espaco: "site", molde: "configuracao" },
  apoiadores: { espaco: "site", molde: "configuracao" },
  erros: { espaco: "site", molde: "fila" },
  tecnico: { espaco: "site", molde: "configuracao" },
  // Segurança
  seguranca: { espaco: "seguranca", molde: "configuracao" },
  interdicao: { espaco: "seguranca", molde: "configuracao" },
  registro: { espaco: "seguranca", molde: "tabela" },
  // Minha conta
  contribuicoes: { espaco: "conta", molde: "registro" },
  conta: { espaco: "conta", molde: "configuracao" },
};

/** O grupo antigo do menu (campo "grupo" das seções) → espaço. Seção nova sem entrada no mapa cai aqui: nada fica fora do menu. */
const POR_GRUPO_ANTIGO: Record<string, IdDoEspaco> = {
  "": "mesa",
  "Produção": "producao",
  "Atendimento": "comunidade",
  "Pessoas": "equipe",
  "Site": "site",
  "Segurança": "seguranca",
  "Você": "conta",
};

/** O espaço de uma seção: o do mapa; se for seção nova, o do grupo antigo; na falta de tudo, a Mesa. */
export function espacoDe(id: string, grupoAntigo = ""): IdDoEspaco {
  return MAPA[id]?.espaco ?? POR_GRUPO_ANTIGO[grupoAntigo] ?? "mesa";
}

/** O molde de uma seção (seção nova sem entrada: Registro, o mais livre). */
export function moldeDe(id: string): Molde {
  return MAPA[id]?.molde ?? "registro";
}

export function nomeDoEspaco(id: IdDoEspaco): string {
  return ESPACOS.find((e) => e.id === id)?.nome ?? id;
}
