// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import type { EncontroParaSalvar } from "@/lib/escola/contratos";
import { chamarDoNucleo, deCampoParaIso, deIsoParaCampo, MAX_ITENS_DA_PAUTA, MAX_TAREFAS, type MotivoDoErro, type NucleoCompleto, pautaEmRoda } from "@/lib/escola/nucleo";
import { preencher } from "@/lib/escola/textos";

type T = TextosDaTelaDoNucleo;

/** Uma lista de campos de texto (itens da pauta ou tarefas), com tirar e acrescentar. */
function ListaDeCampos({ valores, mudar, rotulo, acrescentar, tirar, maximo, limite }: { valores: string[]; mudar: (v: string[]) => void; rotulo: string; acrescentar: string; tirar: string; maximo: number; limite: number }) {
  return (
    <>
      <ol className="en-campos">
        {valores.map((v, i) => (
          <li key={i}>
            <label className="sr-only" htmlFor={`${rotulo}-${i}`}>
              {preencher(rotulo, { n: i + 1 })}
            </label>
            <input id={`${rotulo}-${i}`} className="en-campo" value={v} maxLength={limite} onChange={(e) => mudar(valores.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="en-botao-pequeno" onClick={() => mudar(valores.filter((_, j) => j !== i))} aria-label={`${tirar}: ${preencher(rotulo, { n: i + 1 })}`}>
              {tirar}
            </button>
          </li>
        ))}
      </ol>
      {valores.length < maximo && (
        <button type="button" className="en-botao-linha" onClick={() => mudar([...valores, ""])}>
          {acrescentar}
        </button>
      )}
    </>
  );
}

/**
 * O que só a mediação do núcleo e a coordenação veem (prancha Cel-Núcleo, sem desenho próprio: segue os tokens da
 * Escola): marcar ou mudar o encontro, a pauta (com o botão que monta a roda em ver-julgar-agir, aberta e fechada pela
 * mística), quem faz o quê e, para a roda que passou, a presença SOMADA e o balanço sem nomes.
 */
export function PreparaEncontro({ dados, t, depois }: { dados: NucleoCompleto; t: T; depois: () => void }) {
  const m = t.mediar;
  const id = useId();
  const proximo = dados.proximo;
  const [aberto, setAberto] = useState(false);
  const [quando, setQuando] = useState(proximo ? deIsoParaCampo(proximo.quando) : "");
  const [pauta, setPauta] = useState<string[]>(proximo?.pauta.map((p) => p.texto) ?? []);
  const [levados] = useState(() => new Set((proximo?.pauta ?? []).filter((p) => p.levado).map((p) => p.texto)));
  const [tarefas, setTarefas] = useState<string[]>(proximo?.tarefas.map((x) => x.item) ?? []);
  const [presenca, setPresenca] = useState(dados.anterior?.presenca?.toString() ?? "");
  const [balanco, setBalanco] = useState(dados.anterior?.balanco ?? "");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const erro = (motivo: MotivoDoErro) => setAviso(t.erros[motivo]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const iso = deCampoParaIso(quando);
    if (!iso || !dados.nucleo) return erro("invalido");
    setOcupado(true);
    const r = await chamarDoNucleo("escola_encontro_salvar", {
      p: {
        ...(proximo ? { id: proximo.id } : {}),
        nucleo: dados.nucleo.id,
        quando: iso,
        pauta: pauta.map((x) => x.trim()).filter(Boolean).map((texto) => (levados.has(texto) ? { texto, levado: true } : { texto })),
        tarefas: tarefas.map((x) => x.trim()).filter(Boolean).map((item) => ({ item })),
      },
    });
    setOcupado(false);
    if (!r.ok) return erro(r.motivo);
    setAviso(m.salvo);
    setAberto(false);
    depois();
  }

  async function fechar(e: React.FormEvent) {
    e.preventDefault();
    if (!dados.anterior || !dados.nucleo) return;
    const n = presenca.trim() === "" ? null : Number(presenca);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 500)) return erro("invalido");
    setOcupado(true);
    // Só presença e balanço: o banco mantém a data e a pauta da roda que passou.
    const r = await chamarDoNucleo("escola_encontro_salvar", { p: { id: dados.anterior.id, nucleo: dados.nucleo.id, presenca: n, balanco: balanco.trim() } as unknown as EncontroParaSalvar });
    setOcupado(false);
    if (!r.ok) return erro(r.motivo);
    setAviso(m.guardado);
    depois();
  }

  return (
    <section aria-labelledby={`${id}-t`} className="en-bloco en-mediar">
      <h2 id={`${id}-t`} className="ef-t en-h2">
        {m.titulo}
      </h2>
      <p className="en-nota">{m.so}</p>
      {!aberto ? (
        <button type="button" className="en-botao-linha" onClick={() => setAberto(true)} aria-expanded={false}>
          {proximo ? m.editar : m.novo}
        </button>
      ) : (
        <form onSubmit={salvar} className="en-form">
          <label htmlFor={`${id}-quando`} className="en-rotulo">
            {m.quando}
          </label>
          <input id={`${id}-quando`} type="datetime-local" className="en-campo" required value={quando} onChange={(e) => setQuando(e.target.value)} />
          <fieldset className="en-grupo">
            <legend className="en-rotulo">{m.pautaTitulo}</legend>
            <button type="button" className="en-botao-linha" onClick={() => setPauta(pautaEmRoda(t.kit.pautaModelo, ...pauta).map((p) => p.texto))}>
              {m.usarRoda}
            </button>
            <ListaDeCampos valores={pauta} mudar={setPauta} rotulo={m.item} acrescentar={m.acrescentarItem} tirar={m.tirar} maximo={MAX_ITENS_DA_PAUTA} limite={200} />
          </fieldset>
          <fieldset className="en-grupo">
            <legend className="en-rotulo">{m.tarefasTitulo}</legend>
            <ListaDeCampos valores={tarefas} mudar={setTarefas} rotulo={m.tarefa} acrescentar={m.acrescentarTarefa} tirar={m.tirar} maximo={MAX_TAREFAS} limite={120} />
          </fieldset>
          <div className="en-acoes">
            <button type="submit" className="ef-botao-ouro" disabled={ocupado}>
              {m.salvar}
            </button>
            <button type="button" className="ef-botao-vazado" onClick={() => setAberto(false)}>
              {m.cancelar}
            </button>
          </div>
        </form>
      )}

      {dados.anterior && (
        <form onSubmit={fechar} className="en-form en-fechar">
          <h3 className="ef-t en-h3">{m.fecharTitulo}</h3>
          <label htmlFor={`${id}-presenca`} className="en-rotulo">
            {m.presencaRotulo}
          </label>
          <input id={`${id}-presenca`} type="number" inputMode="numeric" min={0} max={500} className="en-campo en-campo-curto" value={presenca} onChange={(e) => setPresenca(e.target.value)} />
          <label htmlFor={`${id}-balanco`} className="en-rotulo">
            {m.balancoRotulo}
          </label>
          <textarea id={`${id}-balanco`} className="en-campo" rows={4} maxLength={2000} value={balanco} onChange={(e) => setBalanco(e.target.value)} />
          <div className="en-acoes">
            <button type="submit" className="ef-botao-vazado" disabled={ocupado}>
              {m.guardar}
            </button>
          </div>
        </form>
      )}
      <p role="status" className="en-aviso">
        {aviso}
      </p>
    </section>
  );
}
