// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Na sua realidade" no alto da aula da Escola (prancha Aula): a codificação do círculo de cultura de Paulo Freire (a
// pergunta que parte da vida de quem estuda, antes da explicação; PLANO-ESCOLA.md, seção 3). A pergunta é a do próprio
// texto da aula, o bloco ```suarealidade do modelo de 9 partes (./realidade.ts). Na Escola ela sobe para a caixa escura
// do alto e sai do meio do texto, para não aparecer duas vezes. Aula sem o bloco não ganha pergunta inventada.

export function NaSuaRealidade({ pergunta, rotulo }: { pergunta: string; rotulo: string }) {
  return (
    <aside aria-label={rotulo} className="efa-realidade">
      <span className="ef-t efa-realidade-rotulo">{rotulo}</span>
      {pergunta.split(/\n\s*\n/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </aside>
  );
}
