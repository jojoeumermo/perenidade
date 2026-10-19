// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

// A prática das aulas de idioma (components/Pratica.tsx, com voz e reconhecimento de fala) num arquivo à parte: só as
// aulas que têm prática baixam esse código. A página continua montada no servidor do mesmo jeito; nada muda na tela.
// (Importado direto pela página da aula, ele ia junto para todas as aulas, inclusive as de matemática.)
export const PraticaSobDemanda = dynamic(() => import("../Pratica").then((m) => m.Pratica));
