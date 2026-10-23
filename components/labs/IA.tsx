// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { L } from "../I18n";
import { Playground } from "./ia/Playground";
import { KMedias, ProximaPalavra, Sobreajuste, Vies, Vizinhos } from "./ia/Modulos";
import { Bancada, Modulos } from "./kit";

type Modulo = "rede" | "vizinhos" | "kmedias" | "sobreajuste" | "palavra" | "vies" | "python";
const MODULOS: { id: Modulo; nome: string; icone: string; resumo: string }[] = [
  { id: "rede", nome: "Playground de rede neural", icone: "rede-neural", resumo: "Camadas, ativação e fronteira de decisão" },
  { id: "vizinhos", nome: "k vizinhos", icone: "vizinhos", resumo: "Classificar pelo que está perto" },
  { id: "kmedias", nome: "Agrupamento", icone: "agrupamento", resumo: "Achar grupos sem respostas" },
  { id: "sobreajuste", nome: "Ajuste demais", icone: "sobreajuste", resumo: "Aprender ou decorar?" },
  { id: "palavra", nome: "A próxima palavra", icone: "proxima-palavra", resumo: "Um modelo de linguagem em miniatura" },
  { id: "vies", nome: "Viés em algoritmos", icone: "vies", resumo: "Quando o dado carrega preconceito" },
  { id: "python", nome: "Caderno de Python", icone: "caderno-python", resumo: "Os mesmos modelos em código" },
];

const EXEMPLOS = [
  { nome: "Regressão com numpy", codigo: 'import numpy as np\nx = np.array([1,2,3,4,5,6,7,8], dtype=float)\ny = np.array([3.1,4.2,4.8,6.1,6.4,7.6,8.0,9.1])\na, b = np.polyfit(x, y, 1)\nprint(f"nota ≈ {a:.2f}·horas + {b:.2f}")\nprint("com 10 horas:", round(a*10+b, 1))\n' },
  { nome: "Classificação (k vizinhos, à mão)", codigo: 'pontos = [((1,1),"A"),((1,2),"A"),((2,1),"A"),((6,6),"B"),((7,6),"B"),((6,7),"B")]\ndef classe(p, k=3):\n    viz = sorted(pontos, key=lambda q: (q[0][0]-p[0])**2+(q[0][1]-p[1])**2)[:k]\n    return max(set(c for _, c in viz), key=[c for _, c in viz].count)\nfor p in [(2,2),(5,6),(4,4)]:\n    print(p, "→", classe(p))\n' },
  { nome: "Agrupamento (k-médias simples)", codigo: 'import random\nrandom.seed(1)\ndados = [random.gauss(2,0.5) for _ in range(20)] + [random.gauss(8,0.5) for _ in range(20)]\nc = [dados[0], dados[-1]]\nfor _ in range(10):\n    grupos = [[x for x in dados if abs(x-c[0]) <= abs(x-c[1])], [x for x in dados if abs(x-c[0]) > abs(x-c[1])]]\n    c = [sum(g)/len(g) for g in grupos]\nprint("centros:", [round(v,2) for v in c])\n' },
  { nome: "Um neurônio aprendendo o E lógico", codigo: 'import math, random\nrandom.seed(3)\ndados = [((0,0),0),((0,1),0),((1,0),0),((1,1),1)]\nw = [random.uniform(-1,1) for _ in range(3)]\nsig = lambda z: 1/(1+math.exp(-z))\nfor _ in range(5000):\n    for (a,b), alvo in dados:\n        y = sig(w[0]*a + w[1]*b + w[2])\n        d = (y-alvo)*y*(1-y)\n        w = [w[0]-0.5*d*a, w[1]-0.5*d*b, w[2]-0.5*d]\nfor (a,b), alvo in dados:\n    print(a, b, "→", round(sig(w[0]*a+w[1]*b+w[2]), 3), "(alvo", alvo, ")")\n' },
  { nome: "Próxima palavra (bigramas)", codigo: 'from collections import Counter, defaultdict\ntexto = "o gato comeu o peixe e o gato dormiu no sofá e o cachorro latiu"\np = texto.split()\npares = defaultdict(Counter)\nfor a, b in zip(p, p[1:]):\n    pares[a][b] += 1\nfor palavra in ["o", "gato", "e"]:\n    total = sum(pares[palavra].values())\n    print(palavra, "→", {k: f"{v/total:.0%}" for k, v in pares[palavra].items()})\n' },
];

/** O laboratório de IA: seis módulos interativos que treinam modelos de verdade no navegador, e o caderno de Python. */
export function LabIA() {
  const [modulo, setModulo] = useState<Modulo>("rede");
  return (
    <div className="mt-6 font-sans">
      <p className="rounded border-l-4 border-gold bg-parchment-deep px-4 py-3 text-sm">Tudo aqui treina de verdade, no seu aparelho: nada vai para servidor nenhum. São modelos pequenos, para ver com os olhos o que “aprender” quer dizer; os grandes usam as mesmas ideias, em escala gigantesca.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Modulos itens={MODULOS} atual={modulo} escolher={setModulo} />
        <div className="min-w-0">
          {modulo === "rede" && <Playground />}
          {modulo === "vizinhos" && <Vizinhos />}
          {modulo === "kmedias" && <KMedias />}
          {modulo === "sobreajuste" && <Sobreajuste />}
          {modulo === "palavra" && <ProximaPalavra />}
          {modulo === "vies" && <Vies />}
          {modulo === "python" && (
            <Bancada titulo="Caderno de Python" subtitulo="Abra na IDE do site (perfil Python; numpy carrega sob demanda)">
              <ul className="space-y-2">
                {EXEMPLOS.map((e) => (
                  <li key={e.nome} className="flex flex-wrap items-center justify-between gap-2 rounded border-2 border-ink/20 bg-parchment-deep p-3">
                    <span className="font-semibold">{e.nome}</span>
                    <L href={`/ferramentas/python?codigo=${encodeURIComponent(e.codigo)}`} className="cursor-pointer rounded bg-ink px-3 py-1.5 text-sm font-semibold text-parchment hover:bg-oxblood">Abrir na IDE →</L>
                  </li>
                ))}
              </ul>
            </Bancada>
          )}
        </div>
      </div>
    </div>
  );
}
