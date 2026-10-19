// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

// As peças dos recursos novos que entram na página da aula, cada uma num arquivo à parte: o código só é baixado quando
// a peça aparece (com o recurso ligado). Importadas direto pela página, iriam para todas as aulas mesmo desligadas.
export const ExerciciosComExplicacaoSobDemanda = dynamic(() => import("./ExerciciosComExplicacao").then((m) => m.ExerciciosComExplicacao));
export const IssoAjudouSobDemanda = dynamic(() => import("./IssoAjudou").then((m) => m.IssoAjudou));
export const RegistroDeConclusaoSobDemanda = dynamic(() => import("./RegistroDeConclusao").then((m) => m.RegistroDeConclusao), { ssr: false });
