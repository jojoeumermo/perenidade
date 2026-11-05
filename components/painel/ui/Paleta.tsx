// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Command } from "cmdk";
import { Icone } from "../icones";
import { espacoDe, nomeDoEspaco } from "../estrutura";

const simples = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export interface ItemDaPaleta {
  id: string;
  nome: string;
  sobre: string;
  /** Grupo antigo da seção (para achar o espaço de uma seção nova). */
  grupo?: string;
  conta?: number;
}

export interface ComandoDaPaleta {
  id: string;
  nome: string;
  sobre: string;
  fazer: () => void;
}

/**
 * A paleta de comandos (Ctrl K): procura nas seções, por espaço, nome e descrição (sem acento), e nos comandos (trocar tema,
 * escrever uma aula…). cmdk cuida das setas, de Enter e do leitor de tela; a busca ignora acento e caixa.
 */
export function Paleta({ aberto, aoMudar, secoes, comandos, ir }: { aberto: boolean; aoMudar: (aberto: boolean) => void; secoes: ItemDaPaleta[]; comandos: ComandoDaPaleta[]; ir: (id: string) => void }) {
  const filtro = (valor: string, busca: string) => (simples(valor).includes(simples(busca.trim())) ? 1 : 0);
  const escolher = (fazer: () => void) => {
    aoMudar(false);
    fazer();
  };
  return (
    <Command.Dialog open={aberto} onOpenChange={aoMudar} label="Ir para uma seção ou rodar um comando" filter={filtro} overlayClassName="pn-veu" contentClassName="pn-dialogo pn-paleta painel" loop>
      <Command.Input placeholder="Ir para… ou um comando (fila, escrever aula, modo leve)" />
      <Command.List>
        <Command.Empty>Nenhuma seção ou comando com esse nome.</Command.Empty>
        <Command.Group heading="Seções">
          {secoes.map((s) => (
            <Command.Item key={s.id} value={`${s.nome} ${nomeDoEspaco(espacoDe(s.id, s.grupo))} ${s.sobre} ${s.id}`} onSelect={() => escolher(() => ir(s.id))}>
              <Icone id={s.id} className="h-5 w-5 shrink-0" />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontWeight: 600 }}>{s.nome}</span>
                <span className="pn-ajuda" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nomeDoEspaco(espacoDe(s.id, s.grupo))}
                </span>
              </span>
              {Boolean(s.conta) && <span className="pn-selo">{s.conta}</span>}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Comandos">
          {comandos.map((c) => (
            <Command.Item key={c.id} value={`${c.nome} ${c.sobre}`} onSelect={() => escolher(c.fazer)}>
              <span aria-hidden>›</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontWeight: 600 }}>{c.nome}</span>
                <span className="pn-ajuda" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.sobre}
                </span>
              </span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
