// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Descobrir (/alumia/descobrir), Prompt 4, Parte E, atrás de "alumia-p4-descoberta-estudo": cada item numa aba. Fala só com o banco
// (lib/rede/descoberta-estudo/cliente.ts) e com o servidor do site; o que é da pessoa fica no aparelho.
import type { PropsDaTelaDoPacote } from "../registro";
import Assuntos from "./Assuntos";
import { TelaComAbas, useTextosDE, type AbaDaTela } from "./comum";
import EscolhaEmDia from "./EscolhaEmDia";
import Feeds from "./Feeds";
import FediversoTemas from "./FediversoTemas";
import Linhas from "./Linhas";

type Aba = keyof Omit<NonNullable<ReturnType<typeof useTextosDE>>["descobrir"]["abas"], "rotulo">;

// Na ordem da tela: o que está circulando, as linhas, o Fediverso, os feeds e, por último, a escolha do fim da linha.
const ABAS: readonly AbaDaTela<Aba>[] = [
  { chave: "assuntos", Parte: Assuntos },
  { chave: "linhas", Parte: Linhas },
  { chave: "fediverso", Parte: FediversoTemas },
  { chave: "feeds", Parte: Feeds },
  { chave: "emDia", Parte: EscolhaEmDia },
];

export default function TelaDeDescobrir({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDE(lang);
  if (!t) return <p role="status" className="de-pagina de-miudo">…</p>;
  const { abas, ...cabeca } = t.descobrir;
  return <TelaComAbas lang={lang} t={t} cabeca={cabeca} abas={ABAS} rotulos={abas} rotuloDasAbas={abas.rotulo} />;
}
