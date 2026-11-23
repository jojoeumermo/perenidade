// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As partes da tela Organizar, na ordem em que aparecem: as da organização, as da comunidade e as abas soltas. Cada item do Prompt 4
// entra aqui com o componente dele.
import { SecaoQuadro } from "./SecaoQuadro";
import { SecaoHorario } from "./SecaoHorario";
import { SecaoReunioes } from "./SecaoReunioes";
import { SecaoInventario } from "./SecaoInventario";
import { SecaoConsenso } from "./SecaoConsenso";
import { SecaoMural, SecaoVagas } from "./SecaoMural";
import { SecaoBancoDeTempo } from "./SecaoBancoDeTempo";
import { SecaoPontos } from "./SecaoPontos";
import { AbaRota } from "./AbaRota";
import { SecaoOrcamento } from "./SecaoOrcamento";
import { SecaoMetas } from "./SecaoMetas";
import { AbaTermometro } from "./AbaTermometro";
import { AbaApoio } from "./AbaApoio";
import { AbaAta } from "./AbaAta";
import type { PropsDaAbaSolta, PropsDaSecaoDaComunidade, PropsDaSecaoDaOrg, Secao } from "./TelaDaOrganizacao";

export const SECOES_DA_ORG: Secao<PropsDaSecaoDaOrg>[] = [
  { chave: "quadro", Componente: SecaoQuadro },
  { chave: "horario", Componente: SecaoHorario },
  { chave: "reunioes", Componente: SecaoReunioes },
  { chave: "consenso", Componente: SecaoConsenso },
  { chave: "orcamento", Componente: SecaoOrcamento },
  { chave: "metas", Componente: SecaoMetas },
  { chave: "inventario", Componente: SecaoInventario },
];

export const SECOES_DA_COMUNIDADE: Secao<PropsDaSecaoDaComunidade>[] = [
  { chave: "mural", Componente: SecaoMural },
  { chave: "vagas", Componente: SecaoVagas },
  { chave: "tempo", Componente: SecaoBancoDeTempo },
  { chave: "pontos", Componente: SecaoPontos },
];

export const ABAS_SOLTAS: Secao<PropsDaAbaSolta>[] = [
  { chave: "rota", Componente: AbaRota },
  { chave: "termometro", Componente: AbaTermometro },
  { chave: "apoio", Componente: AbaApoio },
  { chave: "ata", Componente: AbaAta },
];
