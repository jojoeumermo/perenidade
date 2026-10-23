// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Modulos } from "../kit";
import { Automatos, Epidemia, Gravidade, Ondas, PredadorPresa } from "./Ciencias";
import { NavegadorRevela, Regex, Sensores } from "./Computacao";
import { Cooperacao, GraficosEnganosos, Probabilidade, Riqueza, Segregacao } from "./Sociedade";

type Id = "probabilidade" | "graficos" | "segregacao" | "cooperacao" | "riqueza" | "epidemia" | "predador" | "gravidade" | "ondas" | "automatos" | "regex" | "navegador" | "sensores";
const MODULOS: { id: Id; nome: string; icone: string; resumo: string; grupo: string }[] = [
  { id: "probabilidade", nome: "Probabilidade", icone: "probabilidade", resumo: "Moedas, Monty Hall, aniversários", grupo: "Pensamento crítico e sociedade" },
  { id: "graficos", nome: "Gráficos que enganam", icone: "barras", resumo: "Eixo cortado e outros truques", grupo: "Pensamento crítico e sociedade" },
  { id: "segregacao", nome: "Segregação", icone: "segregacao", resumo: "O modelo de Schelling", grupo: "Pensamento crítico e sociedade" },
  { id: "cooperacao", nome: "Cooperação", icone: "aperto", resumo: "O dilema do prisioneiro", grupo: "Pensamento crítico e sociedade" },
  { id: "riqueza", nome: "Riqueza", icone: "riqueza", resumo: "Como a riqueza se concentra", grupo: "Pensamento crítico e sociedade" },
  { id: "epidemia", nome: "Epidemia", icone: "epidemia", resumo: "SIR, vacina e imunidade coletiva", grupo: "Ciências" },
  { id: "predador", nome: "Predador e presa", icone: "predador", resumo: "Ciclos de Lotka-Volterra", grupo: "Ciências" },
  { id: "gravidade", nome: "Gravidade", icone: "planeta", resumo: "Órbitas e lançamentos", grupo: "Ciências" },
  { id: "ondas", nome: "Ondas e Fourier", icone: "ondas", resumo: "Somar senos e ouvir", grupo: "Ciências" },
  { id: "automatos", nome: "Autômatos", icone: "automatos", resumo: "Jogo da Vida e regra 110", grupo: "Computação" },
  { id: "regex", nome: "Expressões regulares", icone: "regex", resumo: "Achar padrões em texto", grupo: "Computação" },
  { id: "navegador", nome: "O que o navegador conta", icone: "rastro", resumo: "Rastreamento sem permissão", grupo: "Computação" },
  { id: "sensores", nome: "Laboratório no celular", icone: "sensor", resumo: "Acelerômetro e gravidade", grupo: "Computação" },
];

/** O Laboratório de modelos: 13 simulações que seguem o roteiro preveja, rode, compare, explique. */
export function LabModelos() {
  const [atual, setAtual] = useState<Id>("probabilidade");
  return (
    <div className="mt-6 font-sans">
      <p className="rounded border-l-4 border-gold bg-parchment-deep px-4 py-3 text-sm">Cada simulação começa com uma pergunta: anote a sua previsão, rode, compare e leia a explicação e os limites do modelo. Tudo o que é sorteado tem semente (a mesma semente repete o resultado, para mostrar igual em sala) e nada sai do seu aparelho.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Modulos itens={MODULOS} atual={atual} escolher={setAtual} />
        <div className="min-w-0">
          {atual === "probabilidade" && <Probabilidade />}
          {atual === "graficos" && <GraficosEnganosos />}
          {atual === "segregacao" && <Segregacao />}
          {atual === "cooperacao" && <Cooperacao />}
          {atual === "riqueza" && <Riqueza />}
          {atual === "epidemia" && <Epidemia />}
          {atual === "predador" && <PredadorPresa />}
          {atual === "gravidade" && <Gravidade />}
          {atual === "ondas" && <Ondas />}
          {atual === "automatos" && <Automatos />}
          {atual === "regex" && <Regex />}
          {atual === "navegador" && <NavegadorRevela />}
          {atual === "sensores" && <Sensores />}
        </div>
      </div>
    </div>
  );
}
