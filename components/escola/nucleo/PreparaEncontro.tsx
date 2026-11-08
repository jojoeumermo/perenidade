// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import type { EncontroParaSalvar, RecadoDaFormacao } from "@/lib/escola/contratos";
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


/** "16 de novembro" (a data AAAA-MM-DD do recado, sem fuso). */
function diaDoRecado(lang: string, ate: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${ate}T12:00:00Z`));
  } catch {
    return ate;
  }
}

/**
 * Os recados do PRÓPRIO núcleo (plano 4.4: escola_recado_salvar é "coord ou mediação do núcleo"): a mediação publica,
 * com data de validade, e apaga. Os recados para toda a Escola continuam só no painel da coordenação.
 */
function RecadosDoNucleo({ lang, nucleo, t }: { lang: string; nucleo: string; t: T }) {
  const m = t.mediar;
  const id = useId();
  const [lista, setLista] = useState<RecadoDaFormacao[] | null>(null);
  const [texto, setTexto] = useState("");
  const [ate, setAte] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const ler = useCallback(async () => {
    const r = await chamarDoNucleo("escola_recados");
    if (!r.ok) return setAviso(t.erros[r.motivo]);
    setLista(r.dados.filter((x) => x.nucleo === nucleo));
  }, [nucleo, t]);

  useEffect(() => {
    // Primeira leitura ao abrir: o estado muda só quando o banco responde.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ler();
  }, [ler]);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    if (texto.trim().length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return setAviso(t.erros.invalido);
    setOcupado(true);
    const r = await chamarDoNucleo("escola_recado_salvar", { p: { texto: texto.trim(), ate, nucleo } });
    setOcupado(false);
    if (!r.ok) return setAviso(t.erros[r.motivo]);
    setTexto("");
    setAte("");
    setAviso(m.recadoPublicado);
    void ler();
  }

  async function apagar(r: RecadoDaFormacao) {
    setOcupado(true);
    const x = await chamarDoNucleo("escola_recado_salvar", { p: { id: r.id, texto: r.texto, ate: r.ate, nucleo, apagar: true } });
    setOcupado(false);
    if (!x.ok) return setAviso(t.erros[x.motivo]);
    setAviso(m.recadoApagado);
    void ler();
  }

  return (
    <div className="en-form en-fechar">
      <h3 id={`${id}-t`} className="ef-t en-h3">
        {m.recadosTitulo}
      </h3>
      <p className="en-nota">{m.recadosNota}</p>
      {lista === null ? null : lista.length === 0 ? (
        <p className="en-vazio">{m.recadosVazio}</p>
      ) : (
        <ul className="en-tarefas" aria-labelledby={`${id}-t`}>
          {lista.map((r) => (
            <li key={r.id} className="en-tarefa">
              <span className="en-tarefa-item">
                {r.texto}
                <span className="en-recado-ate">{preencher(m.recadoAteDia, { dia: diaDoRecado(lang, r.ate) })}</span>
              </span>
              <button type="button" className="en-botao-pequeno" disabled={ocupado} onClick={() => apagar(r)} aria-label={`${m.apagarRecado}: ${r.texto}`}>
                {m.apagarRecado}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={publicar} className="en-form">
        <label htmlFor={`${id}-texto`} className="en-rotulo">
          {m.recadoTexto}
        </label>
        <textarea id={`${id}-texto`} className="en-campo" rows={2} minLength={3} maxLength={400} required value={texto} onChange={(e) => setTexto(e.target.value)} />
        <label htmlFor={`${id}-ate`} className="en-rotulo">
          {m.recadoAte}
        </label>
        <input id={`${id}-ate`} type="date" className="en-campo en-campo-curto" required value={ate} onChange={(e) => setAte(e.target.value)} />
        <div className="en-acoes">
          <button type="submit" className="ef-botao-vazado" disabled={ocupado}>
            {m.publicarRecado}
          </button>
        </div>
      </form>
      <p role="status" className="en-aviso">
        {aviso}
      </p>
    </div>
  );
}

/**
 * O que só a mediação do núcleo e a coordenação veem (prancha Cel-Núcleo, sem desenho próprio: segue os tokens da
 * Escola): marcar ou mudar o encontro, a pauta (com o botão que monta a roda em ver-julgar-agir, aberta e fechada pela
 * mística), quem faz o quê, para a roda que passou, a presença SOMADA e o balanço sem nomes, e os recados do núcleo.
 */
export function PreparaEncontro({ lang, dados, t, depois }: { lang: string; dados: NucleoCompleto; t: T; depois: () => void }) {
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
      {dados.nucleo && <RecadosDoNucleo lang={lang} nucleo={dados.nucleo.id} t={t} />}
    </section>
  );
}
