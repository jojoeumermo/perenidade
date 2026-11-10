// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { AnexoChamado } from "./AnexoChamado";
import { AtosPerto } from "./AtosPerto";
import { FormularioDoAto } from "./FormularioDoAto";
import { TopoDoInicio } from "./TopoDoInicio";
import { guardarCidade } from "@/lib/rede/atos/aparelho";
import { textosDaRede } from "@/lib/rede/textos";
import type { Post, Situacao } from "@/lib/rede/tipos";
import "./atos.css";

const SITUACAO: Situacao = { logado: true, membro: true, regras_versao: 1 };

/** Um post de exemplo com um chamado embutido (prancha computador-inicio, post da Rosa Vermelha). */
function postDeExemplo(): Post {
  const quando = new Date(Date.now() + 86_400_000);
  quando.setHours(11, 0, 0, 0);
  return {
    id: "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d04", tipo: "chamado", titulo: "Panfletagem no RU", texto: "O núcleo vai panfletar no RU.",
    corpo: null, longo: false, comunidade: "estudantes-ufpe", flair: null, publico: "publico" as Post["publico"], criado_em: new Date().toISOString(),
    editado_em: null, fixado: false, travado: false, aceita: null, verificada: false, resposta_a: null, raiz: "0e1b6c1a-5d1f-4c3e-9a51-6f3a2b1c0d04",
    nivel: 0, aviso: "", cita: null, chamado: { tipo: "ato", quando: quando.toISOString(), onde: "Restaurante Universitário, Recife", situacao: "confirmado", palavra: "RU", acesos: 0.7 },
    meu: false, retido: false, motivo: "", modero: false, autor: { id: null, codinome: "Rosa Vermelha", handle: "rosavermelha", perfil: true, equipe: false },
    respostas: 14, na_conversa: 14, util: 0, util_eu: false, apoios: null, apoiei: false, salvei: false, vou: null, vou_eu: false, midia: [], citado: null,
  };
}

/** A banca de conferência (só na prévia): as peças da F2 que vivem dentro das telas da F1, com dados de exemplo. */
export function BancaDosAtos({ lang }: { lang: string }) {
  const [pronto, setPronto] = useState(false);
  const [post] = useState(postDeExemplo);
  useEffect(() => {
    guardarCidade("São Paulo");
    queueMicrotask(() => setPronto(true));
  }, []);
  if (!pronto) return null;
  const ctx = { lang, s: textosDaRede(lang), situacao: SITUACAO };
  return (
    <div className="al-banca">
      <section aria-label="Início" className="al-banca-coluna">
        <TopoDoInicio {...ctx} />
        <div style={{ padding: "0 16px 1rem" }}>
          <AnexoChamado {...ctx} post={post} />
        </div>
      </section>
      <aside className="al-banca-lado">
        <AtosPerto {...ctx} />
      </aside>
      <section aria-label="Escrever: Ato" className="al-banca-coluna" style={{ padding: "1rem 16px 2rem" }}>
        <FormularioDoAto {...ctx} aoMudar={() => undefined} />
      </section>
    </div>
  );
}
