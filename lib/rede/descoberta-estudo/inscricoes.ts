// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 101 (Prompt 4): o calendário de inscrições (ENEM, SISU, ProUni, FIES, Encceja). As datas são as da agenda de provas da onda 11
// (interno.alumia_agenda_datas): cada uma escrita pela coordenação ou pela mediação COM a fonte oficial e o dia em que foi conferida
// (sem fonte, não entra), e quem assina recebe o lembrete 7 dias e 1 dia antes. Aqui só se agrupa por programa e se aponta a página
// oficial de cada um. Nenhuma data é inventada: programa sem data conferida mostra só a página oficial. Sem "@/" de propósito.
import type { DataDaAgenda } from "../../../components/rede/estudo/agenda/regras";

export interface Programa {
  chave: "enem" | "sisu" | "prouni" | "fies" | "encceja";
  nome: string;
  /** A página oficial do programa (onde a data deve ser conferida). */
  oficial: string;
  /** Como o programa aparece no nome do exame da agenda. */
  padrao: RegExp;
}

export const PROGRAMAS: readonly Programa[] = [
  { chave: "enem", nome: "ENEM", oficial: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem", padrao: /^enem\b/i },
  { chave: "sisu", nome: "SISU", oficial: "https://acessounico.mec.gov.br/sisu", padrao: /^sisu\b/i },
  { chave: "prouni", nome: "ProUni", oficial: "https://acessounico.mec.gov.br/prouni", padrao: /^prouni\b/i },
  { chave: "fies", nome: "FIES", oficial: "https://acessounico.mec.gov.br/fies", padrao: /^fies\b/i },
  { chave: "encceja", nome: "Encceja", oficial: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/encceja", padrao: /^encceja\b/i },
];

/** O programa de uma data da agenda (pelo nome do exame), ou nulo (vestibular e outros ficam na agenda de provas). */
export function programaDe(exame: string): Programa | null {
  return PROGRAMAS.find((p) => p.padrao.test(exame.trim())) ?? null;
}

/** As datas de hoje em diante, por programa, na ordem dos programas e do dia. Todo programa aparece (vazio se não há data conferida). */
export function porPrograma(datas: readonly DataDaAgenda[], hoje: string): { programa: Programa; datas: DataDaAgenda[] }[] {
  return PROGRAMAS.map((programa) => ({
    programa,
    datas: datas.filter((d) => d.dia >= hoje && programaDe(d.exame)?.chave === programa.chave).sort((a, b) => a.dia.localeCompare(b.dia) || (a.hora ?? "").localeCompare(b.hora ?? "")),
  }));
}

/** É etapa de inscrição? (para destacar: "inscrição", "inscrições", "matrícula", "adesão"). */
export const ehInscricao = (etapa: string): boolean => /inscri|matr[ií]cula|ades[aã]o/i.test(etapa);
