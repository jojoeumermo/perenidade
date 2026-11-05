// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import * as Radix from "@radix-ui/react-dropdown-menu";
import { Check, type LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Dica } from "./Dica";
import { Kbd } from "./Kbd";

export interface ItemDoMenuSuspenso {
  rotulo: string;
  simbolo?: LucideIcon;
  atalho?: string;
  perigo?: boolean;
  desligado?: boolean;
  /** Marca a escolha de agora (tema, densidade…): ganha o visto e aria-checked. */
  marcado?: boolean;
  fazer: () => void;
}

function Item({ rotulo, simbolo: Simbolo, atalho, perigo, desligado, marcado, fazer }: ItemDoMenuSuspenso) {
  const miolo = (
    <>
      {Simbolo && <Simbolo aria-hidden />}
      <span>{rotulo}</span>
      {atalho && <Kbd>{atalho}</Kbd>}
      {marcado !== undefined && (marcado ? <Check aria-hidden /> : <span aria-hidden style={{ width: "1rem" }} />)}
    </>
  );
  if (marcado !== undefined) {
    return (
      <Radix.CheckboxItem className="pn-menu-suspenso-item" checked={marcado} disabled={desligado} data-perigo={perigo || undefined} onSelect={fazer}>
        {miolo}
      </Radix.CheckboxItem>
    );
  }
  return (
    <Radix.Item className="pn-menu-suspenso-item" disabled={desligado} data-perigo={perigo || undefined} onSelect={fazer}>
      {miolo}
    </Radix.Item>
  );
}

function Separador() {
  return <Radix.Separator className="pn-menu-suspenso-sep" />;
}

function Rotulo({ children }: { children: ReactNode }) {
  return <Radix.Label className="pn-menu-suspenso-rotulo">{children}</Radix.Label>;
}

/**
 * O menu suspenso do painel (Radix Dropdown Menu): setas, Enter, Esc e letra inicial funcionam; o foco volta ao gatilho.
 * Itens por lista ("itens") ou por filhos (MenuSuspenso.Item, .Separador, .Rotulo). "gatilho" é um botão já com nome.
 */
export function MenuSuspenso({ gatilho, itens, children, lado = "bottom", alinhamento = "start", rotulo, aoMudar, dica }: { gatilho: ReactElement; itens?: ItemDoMenuSuspenso[]; children?: ReactNode; lado?: "top" | "right" | "bottom" | "left"; alinhamento?: "start" | "center" | "end"; rotulo?: string; aoMudar?: (aberto: boolean) => void; /** Dica no gatilho (ao lado de onde o menu abre). */ dica?: string }) {
  const disparo = <Radix.Trigger asChild>{gatilho}</Radix.Trigger>;
  return (
    <Radix.Root modal={false} onOpenChange={aoMudar}>
      {dica ? (
        <Dica texto={dica} lado={lado}>
          {disparo}
        </Dica>
      ) : (
        disparo
      )}
      <Radix.Portal>
        <Radix.Content side={lado} align={alinhamento} sideOffset={6} collisionPadding={8} className="pn-menu-suspenso pn-portal" aria-label={rotulo}>
          {itens?.map((item) => <Item key={item.rotulo} {...item} />)}
          {children}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}

MenuSuspenso.Item = Item;
MenuSuspenso.Separador = Separador;
MenuSuspenso.Rotulo = Rotulo;
