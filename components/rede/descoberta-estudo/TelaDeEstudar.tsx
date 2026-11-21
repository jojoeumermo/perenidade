// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Estudar (/alumia/estudar), Prompt 4, Parte G, atrás de "alumia-p4-descoberta-estudo": cada item numa aba. O que é da pessoa (ritmo,
// baralhos, fontes, microlições) fica no aparelho; o que é da turma sai do banco só somado.
import type { PropsDaTelaDoPacote } from "../registro";
import { TelaComAbas, useTextosDE, type AbaDaTela } from "./comum";
import Glossario from "./Glossario";
import Mentoria from "./Mentoria";
import SimuladoDaTurma from "./SimuladoDaTurma";
import RedacaoReferencia from "./RedacaoReferencia";
import Editais from "./Editais";
import Inscricoes from "./Inscricoes";
import Microlicoes from "./Microlicoes";
import Fontes from "./Fontes";
import Baralhos from "./Baralhos";
import Ritmo from "./Ritmo";

type Aba = keyof Omit<NonNullable<ReturnType<typeof useTextosDE>>["estudar"]["abas"], "rotulo">;

const ABAS: readonly AbaDaTela<Aba>[] = [
  { chave: "ritmo", Parte: Ritmo },
  { chave: "baralhos", Parte: Baralhos },
  { chave: "fontes", Parte: Fontes },
  { chave: "microlicoes", Parte: Microlicoes },
  { chave: "inscricoes", Parte: Inscricoes },
  { chave: "editais", Parte: Editais },
  { chave: "redacao", Parte: RedacaoReferencia },
  { chave: "simulado", Parte: SimuladoDaTurma },
  { chave: "mentoria", Parte: Mentoria },
  { chave: "glossario", Parte: Glossario },
];

export default function TelaDeEstudar({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDE(lang);
  if (!t) return <p role="status" className="de-pagina de-miudo">…</p>;
  const { abas, ...cabeca } = t.estudar;
  return <TelaComAbas lang={lang} t={t} cabeca={cabeca} abas={ABAS} rotulos={abas} rotuloDasAbas={abas.rotulo} />;
}
