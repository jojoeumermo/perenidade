// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Dialogo, Kbd } from "../ui";

/** "g" e uma letra: vai direto à seção (se a pessoa enxerga a seção). */
export const ATALHOS_G: Record<string, string> = { d: "departamentos", m: "mesa", e: "escrever", c: "conversas", f: "fila", h: "horas", t: "tarefas", a: "atividade", v: "videoaulas", r: "rede", p: "pessoas", o: "conta" };

/** A lista dos atalhos de teclado do painel ("?" abre e fecha). */
export function AtalhosDeTeclado({ aberto, aoMudar, nome }: { aberto: boolean; aoMudar: (aberto: boolean) => void; nome: (id: string) => string | undefined }) {
  const linhas: [string, string][] = [
    ["Ctrl K", "Buscar, ir para uma seção ou rodar um comando"],
    ["/", "Ir para… (fora de campos de texto)"],
    ["?", "Abrir e fechar esta lista"],
    ["[", "Recolher e abrir o menu"],
    ...Object.entries(ATALHOS_G)
      .filter(([, id]) => nome(id))
      .map(([letra, id]) => [`g ${letra}`, nome(id) as string] as [string, string]),
    ["Esc", "Fechar janelas e caixas"],
  ];
  return (
    <Dialogo aberto={aberto} aoMudar={aoMudar} titulo="Atalhos de teclado" texto="“g” e uma letra: aperte g, solte, e aperte a letra logo depois.">
      <dl className="pn-definicoes pn-teclas">
        {linhas.map(([tecla, o]) => (
          <div key={tecla}>
            <dt>
              <Kbd>{tecla}</Kbd>
            </dt>
            <dd style={{ textAlign: "right" }}>{o}</dd>
          </div>
        ))}
      </dl>
    </Dialogo>
  );
}
