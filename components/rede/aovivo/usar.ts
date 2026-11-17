// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { criarUsoDeTextos } from "../mapa/comum";
import { carregarTextosDoAoVivo } from "./textos";

/** Os textos do ao vivo no idioma da tela (nulo enquanto o arquivo do idioma chega). */
export const useTextosDoAoVivo = criarUsoDeTextos(carregarTextosDoAoVivo);
