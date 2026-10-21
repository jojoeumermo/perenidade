// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { Me } from "@/lib/backend";
import { type Abertura, Estudio } from "@/components/painel/design/Estudio";
import { Inicio } from "@/components/painel/design/Inicio";
import { TraduzirPainel } from "@/components/painel/Idioma";

/** O estudante não tem conta no estúdio: é sempre esta pessoa de mentira, e tudo fica no aparelho dela. */
const ESTUDANTE = { id: "laboratorio", nome: "Estudante", bio: "", suspenso: false, papeis: [], nivel: 0, segundo_fator: false, exige_segundo_fator: false, avisos: 0, chat_visto: false, chat_leitura: false } as Me;

/**
 * O Laboratório de Design: o mesmo estúdio da equipe, com os modelos, os elementos e as exportações, para estudantes
 * aprenderem fazendo. Sem conta e sem servidor: o trabalho fica no navegador deste aparelho e sai pelo Baixar.
 */
export function LaboratorioDeDesign() {
  const [abertura, setAbertura] = useState<Abertura | null>(null);
  const [volta, setVolta] = useState(0);
  return (
    <div>
      <TraduzirPainel />
      {abertura && (
        <Estudio
          me={ESTUDANTE}
          abertura={abertura}
          laboratorio
          fechar={() => {
            setAbertura(null);
            setVolta((n) => n + 1);
          }}
        />
      )}
      <Inicio key={volta} me={ESTUDANTE} abrir={setAbertura} laboratorio />
    </div>
  );
}
