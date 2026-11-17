// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A folha de redação: pautada como a do ENEM, com a margem vermelha. Para escrever (o campo cresce com o texto e conta as linhas
// da folha de 30) e para ler (o texto entregue, parágrafo por parágrafo, sem HTML).
import { useId } from "react";
import { LIMITES_DA_REDACAO, linhasDaFolha } from "./cliente";
import { por, type TextosDaRedacao } from "./textos";

export function FolhaDeEscrever({ t, valor, aoMudar, desligada }: { t: TextosDaRedacao; valor: string; aoMudar: (v: string) => void; desligada?: boolean }) {
  const id = useId();
  const dica = useId();
  const linhas = linhasDaFolha(valor);
  const passou = linhas > LIMITES_DA_REDACAO.linhasMax;
  const pouco = linhas > 0 && linhas < LIMITES_DA_REDACAO.linhasMin;
  return (
    <div className="rd-folha-campo">
      <label htmlFor={id} className="rd-rotulo">{t.escrever.textoCampo}</label>
      <p id={dica} className="rd-dica">{t.escrever.dica}</p>
      <div className="rd-folha" data-passou={passou ? "sim" : undefined}>
        <textarea
          id={id}
          aria-describedby={dica}
          value={valor}
          disabled={desligada}
          maxLength={LIMITES_DA_REDACAO.textoMax + 200}
          spellCheck
          onChange={(e) => aoMudar(e.target.value)}
        />
      </div>
      <p className="rd-contador" aria-live="polite">
        <span data-alerta={passou || pouco ? "sim" : undefined}>{por(t.escrever.linhas, { n: linhas })}</span>
        <span>{t.escrever.minimo}</span>
        <span>{por(t.escrever.letras, { n: valor.trim().length })}</span>
      </p>
    </div>
  );
}

/** O texto entregue, numa folha pautada só de leitura. */
export function FolhaDeLer({ titulo, texto, semTitulo }: { titulo: string; texto: string; semTitulo?: string }) {
  return (
    <div className="rd-folha rd-folha-ler">
      {(titulo || semTitulo) && <p className="rd-folha-titulo" data-vazio={titulo ? undefined : "sim"}>{titulo || semTitulo}</p>}
      {texto.split(/\n+/).filter((p) => p.trim()).map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}
