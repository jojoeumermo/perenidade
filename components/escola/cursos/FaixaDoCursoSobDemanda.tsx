// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

// A faixa do curso (E4-07) num arquivo à parte, baixado só nas aulas que fazem parte de algum curso e com o recurso
// "escola" ligado: a página da aula não leva o código para quem não é estudante. Não roda no servidor (lê o aparelho).
export const FaixaDoCursoSobDemanda = dynamic(() => import("./FaixaDoCurso").then((m) => m.FaixaDoCurso), { ssr: false });
