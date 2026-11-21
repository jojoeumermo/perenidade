// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador da criação coletiva (Prompt 4, itens 33, 34, 36 e 37): o cliente de lib/rede/criacao/cliente.ts ligado ao
// banco (lib/rede/cliente.ts). Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, o dublê na memória faz a tela andar sem banco (nada vai a lugar
// nenhum).
import { chamar } from "../../../lib/rede/cliente";
import { criarClienteDaCriacao, dubleDaCriacao } from "../../../lib/rede/criacao/cliente";

export const PREVIA_DA_CRIACAO = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export const criacao = PREVIA_DA_CRIACAO ? dubleDaCriacao() : criarClienteDaCriacao(chamar);
