// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BookA, ChevronDown, CircleQuestionMark, Eye, Keyboard, Map as Mapa, Menu, Plus, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Role } from "@/lib/backend";
import { papeis } from "../comum";
import { usePainel } from "../estado";
import { espacoDe, nomeDoEspaco } from "../estrutura";
import { Icone } from "../icones";
import type { ItemDoMenu } from "../Menu";
import { Botao, Kbd, MenuSuspenso } from "../ui";

/** As funções que a coordenação pode "vestir" na prévia, e as que pedem uma disciplina. */
export const PAPEIS_DA_PREVIA: Role["papel"][] = ["vice", "supervisao", "curadoria", "mediacao", "educacao", "educacao_secundaria", "revisao", "traducao", "jornalismo", "mentoria", "marketing", "desenvolvimento", "representante", "porta_voz", "saude"];
export const POR_DISCIPLINA: Role["papel"][] = ["educacao", "educacao_secundaria", "mentoria", "representante"];

export interface Previa {
  papel: Role["papel"];
  disciplina: string | null;
}

/**
 * A barra de cima (52 px, presa no alto): no celular, o botão do menu; a trilha (Painel / espaço / seção, o espaço abre
 * as seções dele); a busca com cara de campo (Ctrl K abre a paleta); à direita, "Ver como…" (prévia por função, só para
 * quem lidera), "Escrever" (quem produz) e a ajuda (tutorial, atalhos, glossário).
 */
export function BarraSuperior({
  atual,
  secoes,
  ir,
  ambiente,
  escrever,
  previa,
  mudarPrevia,
  primeiraDisciplina,
  ajuda,
  extra,
}: {
  atual: ItemDoMenu;
  secoes: ItemDoMenu[];
  ir: (id: string) => void;
  ambiente: string;
  /** Mostra "Escrever" (quem produz, fora do Escrever). */
  escrever: boolean;
  /** Só para quem lidera: a prévia por função. */
  previa?: { atual: Previa | null };
  mudarPrevia?: (previa: Previa | null) => void;
  primeiraDisciplina: string;
  ajuda: { tutorial: () => void; atalhos: () => void; glossario: () => void };
  /** O que a seção "tela" põe na barra (o guia da seção). */
  extra?: ReactNode;
}) {
  const abrirPaleta = usePainel((s) => s.abrirPaleta);
  const menuCelular = usePainel((s) => s.menuCelular);
  const abrirMenuCelular = usePainel((s) => s.abrirMenuCelular);
  const espaco = espacoDe(atual.id, atual.grupo);
  const doEspaco = secoes.filter((s) => espacoDe(s.id, s.grupo) === espaco);

  return (
    <header className="pn-barra-superior no-print">
      <div className="pn-barra-esq">
        <button type="button" className="pn-botao pn-botao-discreto pn-botao-icone pn-so-celular" data-tour="menu-celular" aria-expanded={menuCelular} aria-haspopup="dialog" aria-label={menuCelular ? "Fechar o menu" : "Abrir o menu"} onClick={() => abrirMenuCelular(!menuCelular)}>
          {menuCelular ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
        <nav aria-label="Onde você está" className="pn-trilha">
          <span className="pn-trilha-raiz" title={ambiente}>
            Painel
          </span>
          <span aria-hidden className="pn-trilha-sep pn-trilha-raiz">
            /
          </span>
          {doEspaco.length > 1 ? (
            <MenuSuspenso
              rotulo={nomeDoEspaco(espaco)}
              gatilho={
                <button type="button" className="pn-trilha-espaco" aria-label={`${nomeDoEspaco(espaco)}: ver as seções deste espaço`}>
                  {nomeDoEspaco(espaco)}
                  <ChevronDown aria-hidden width={12} height={12} />
                </button>
              }
            >
              <MenuSuspenso.Rotulo>{nomeDoEspaco(espaco)}</MenuSuspenso.Rotulo>
              {doEspaco.map((s) => (
                <MenuSuspenso.Item key={s.id} rotulo={s.conta ? `${s.nome} (${s.conta})` : s.nome} marcado={s.id === atual.id} fazer={() => ir(s.id)} />
              ))}
            </MenuSuspenso>
          ) : (
            <span className="pn-trilha-espaco" style={{ cursor: "default" }}>
              {nomeDoEspaco(espaco)}
            </span>
          )}
          <span aria-hidden className="pn-trilha-sep pn-trilha-sep-espaco">
            /
          </span>
          <span className="pn-trilha-atual" aria-current="page">
            <Icone id={atual.id} className="pn-trilha-icone" />
            {atual.nome}
          </span>
        </nav>
      </div>

      <div className="pn-barra-centro">
        <button type="button" className="pn-busca-gatilho" data-tour="ir-para" aria-label="Buscar ou ir para… (Ctrl K)" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" onClick={() => abrirPaleta(true)}>
          <Search aria-hidden width={15} height={15} />
          <span className="pn-busca-gatilho-texto">Buscar ou ir para…</span>
          <Kbd className="pn-busca-gatilho-tecla">Ctrl K</Kbd>
        </button>
      </div>

      <div className="pn-barra-dir">
        {extra}
        {previa && mudarPrevia && (
          <MenuSuspenso
            alinhamento="end"
            rotulo="Ver o painel como uma função veria"
            gatilho={
              <button type="button" className="pn-botao pn-botao-discreto pn-botao-pequeno pn-barra-previa" aria-label="Ver como… (prévia)" title="Ver o painel como uma função veria">
                <Eye aria-hidden />
                <span className="pn-barra-texto">Ver como…</span>
              </button>
            }
          >
            <MenuSuspenso.Rotulo>Ver como… (prévia)</MenuSuspenso.Rotulo>
            {PAPEIS_DA_PREVIA.map((p) => (
              <MenuSuspenso.Item key={p} rotulo={papeis[p]} marcado={previa.atual?.papel === p} fazer={() => mudarPrevia({ papel: p, disciplina: POR_DISCIPLINA.includes(p) ? (previa.atual?.disciplina ?? primeiraDisciplina) : null })} />
            ))}
            {previa.atual && (
              <>
                <MenuSuspenso.Separador />
                <MenuSuspenso.Item rotulo="Sair da prévia" simbolo={X} fazer={() => mudarPrevia(null)} />
              </>
            )}
          </MenuSuspenso>
        )}
        {escrever && (
          <Botao variante="principal" pequeno simbolo={Plus} data-tour="escrever" onClick={() => ir("escrever")} aria-label="Escrever">
            <span className="pn-barra-texto">Escrever</span>
          </Botao>
        )}
        <MenuSuspenso
          alinhamento="end"
          rotulo="Ajuda"
          gatilho={
            <button type="button" className="pn-botao pn-botao-discreto pn-botao-icone" data-tour="tutorial" aria-label="Ajuda: tutorial, atalhos e glossário">
              <CircleQuestionMark aria-hidden />
            </button>
          }
        >
          <MenuSuspenso.Item rotulo="Tutorial do painel" simbolo={Mapa} fazer={ajuda.tutorial} />
          <MenuSuspenso.Item rotulo="Atalhos de teclado" simbolo={Keyboard} atalho="?" fazer={ajuda.atalhos} />
          <MenuSuspenso.Item rotulo="Glossário do painel" simbolo={BookA} fazer={ajuda.glossario} />
        </MenuSuspenso>
      </div>
    </header>
  );
}
