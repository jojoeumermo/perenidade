// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { enderecos, idOk, type Post } from "@/lib/rede/tipos";
import { enderecosCom, LOCAIS_DE_ENCONTRO, type LocalDoEncontro } from "@/lib/rede/tipos-comunidades";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import { CartaoDePost } from "../CartaoDePost";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { Compositor } from "./Compositor";
import { botao, botaoClaro, campo, erroCom, mesDeHoje, textosDe, useCarregar } from "./util";

const quando = (iso: string, lang: string) => {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
};

/** A turma do mês: a pessoa inscrita (turmas) entra na comunidade fechada dela; quem não se inscreveu só vê o aviso. */
function TurmaDoMes({ lang, s, sc }: { lang: string; s: TextosDaRede; sc: TextosDeComunidades }) {
  const mes = mesDeHoje();
  const { dado, erro, pronto, recarregar } = useCarregar(() => comunidades.turma(mes), `turma:${mes}`);
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState("");
  const n = sc.nucleos;
  async function entrar() {
    if (ocupado) return;
    setOcupado(true);
    setFalha("");
    try {
      await comunidades.entrarNaTurma(mes);
      recarregar();
    } catch (e) {
      setFalha(erroCom(s, sc, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section aria-labelledby="turma-do-mes" className="border-b border-rule px-[18px] py-4">
      <h2 id="turma-do-mes" className="font-serif text-xl font-semibold">{n.turma}</h2>
      <p className="mt-1 text-sm text-ink-soft">{n.turmaIntro}</p>
      {!pronto ? (
        <p className="mt-2 text-sm text-ink-soft">{s.estados.carregando}</p>
      ) : !dado ? (
        <p role="alert" className="mt-2 text-sm text-oxblood">{erro ? erroCom(s, sc, erro) : s.estados.erro}</p>
      ) : dado.entrou ? (
        <Link href={enderecos.comunidade(lang, dado.slug)} className="mt-2 inline-block font-bold underline">{n.turmaAbrir}</Link>
      ) : dado.inscrito ? (
        <button type="button" disabled={ocupado} onClick={entrar} className={`mt-2 ${botao}`}>{ocupado ? sc.acao.trabalhando : n.turmaEntrar}</button>
      ) : (
        <p className="mt-2 text-sm">{n.turmaNao}</p>
      )}
      {falha && <p role="alert" className="mt-2 text-sm text-oxblood">{falha}</p>}
    </section>
  );
}

/** A página de um núcleo: dados, mediação por codinome, próximos encontros em local público, mural e sair. */
function PaginaDoNucleo({ id, lang, s, sc, situacao, aoEscrever }: { id: string; lang: string; s: TextosDaRede; sc: TextosDeComunidades; situacao: PropsDaTelaDoPacote["situacao"]; aoEscrever: PropsDaTelaDoPacote["aoEscrever"] }) {
  const n = sc.nucleos;
  const pagina = useCarregar(() => comunidades.nucleo(id), `nucleo:${id}`);
  const [itens, setItens] = useState<Post[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [versao, setVersao] = useState(0);
  const [confirmarSair, setConfirmarSair] = useState(false);
  const [saiu, setSaiu] = useState(false);
  const [falha, setFalha] = useState("");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState<LocalDoEncontro>("praca");
  const [lugar, setLugar] = useState("");

  useEffect(() => {
    let vivo = true;
    comunidades
      .linhaDoNucleo(id, null, 20)
      .then((r) => {
        if (!vivo) return;
        setItens(r.itens);
        setProximo(r.proximo);
        setEstado("ok");
      })
      .catch(() => vivo && setEstado("erro"));
    return () => {
      vivo = false;
    };
  }, [id, versao]);

  async function tentar(tarefa: () => Promise<void>) {
    setFalha("");
    try {
      await tarefa();
    } catch (e) {
      setFalha(erroCom(s, sc, e));
    }
  }

  if (!pagina.pronto) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  const dado = pagina.dado;
  if (!dado) return <p role="alert" className="px-[18px] py-8 font-sans text-ink-soft">{pagina.erro ? erroCom(s, sc, pagina.erro) : s.estados.naoEncontrado}</p>;
  if (saiu) return <p role="status" className="px-[18px] py-8 font-sans"><Link href={enderecosCom.nucleos(lang)} className="font-bold underline">{n.voltar}</Link></p>;
  const mediacao = dado.papel === "mediacao";
  const locais = n.local as Record<string, string>;

  return (
    <div className="font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="font-serif text-2xl font-extrabold">{dado.nome}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {dado.cidade && `${n.cidade}: ${dado.cidade}`}
          {dado.trilha && ` · ${n.trilha}: ${dado.trilha.replace(/-/g, " ")}`}
        </p>
        {dado.mediacao.length > 0 && <p className="mt-1 text-sm">{n.mediacao}: {dado.mediacao.join(", ")}</p>}
        <p className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
          <Link href={enderecosCom.nucleos(lang)} className="underline">{n.voltar}</Link>
        </p>
      </header>

      <section aria-labelledby="encontros" className="border-b border-rule px-[18px] py-4">
        <h2 id="encontros" className="font-serif text-xl font-semibold">{n.encontros}</h2>
        {dado.encontros.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">{n.semEncontros}</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {dado.encontros.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-bold">{quando(e.quando, lang)}</span>
                  <span className="block text-sm text-ink-soft">{locais[e.local_tipo]}{e.local_texto ? `: ${e.local_texto}` : ""}</span>
                </span>
                {mediacao && (
                  <button type="button" onClick={() => tentar(async () => { await comunidades.removerEncontro(e.id); pagina.recarregar(); })} className="min-h-11 text-sm underline">{n.encontroTirar}</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {mediacao && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              void tentar(async () => {
                await comunidades.salvarEncontro({ nucleo: dado.id, quando: new Date(data).toISOString(), local_tipo: tipo, local_texto: lugar.trim() });
                setData("");
                setLugar("");
                pagina.recarregar();
              });
            }}
          >
            <h3 className="font-bold">{n.encontroNovo}</h3>
            <label className="block text-sm text-ink-soft">
              {n.encontroQuando}
              <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} required className={campo} />
            </label>
            <label className="block text-sm text-ink-soft">
              {n.encontroLocal}
              <select value={tipo} onChange={(e) => setTipo(e.target.value as LocalDoEncontro)} className={campo}>
                {LOCAIS_DE_ENCONTRO.map((l) => <option key={l} value={l}>{locais[l]}</option>)}
              </select>
            </label>
            <label className="block text-sm text-ink-soft">
              {n.encontroTexto}
              <input value={lugar} onChange={(e) => setLugar(e.target.value)} maxLength={140} required={tipo === "outro"} className={campo} />
            </label>
            <button type="submit" className={botao}>{n.encontroSalvar}</button>
          </form>
        )}
      </section>

      <section aria-labelledby="mural">
        <h2 id="mural" className="px-[18px] pt-4 font-serif text-xl font-semibold">{n.mural}</h2>
        <Compositor s={s} sc={sc} destino={{ nucleo: dado.id, publico: "nucleo" }} aoPublicar={() => setVersao((v) => v + 1)} />
        {estado === "carregando" ? (
          <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={2} />
        ) : estado === "erro" ? (
          <p role="alert" className="px-[18px] py-4 text-ink-soft">{s.estados.erro}</p>
        ) : (
          <div>
            {itens.map((p) => (
              <CartaoDePost key={p.id} post={p} lang={lang} s={s} logado={situacao.logado} aoResponder={(post) => aoEscrever(post)} />
            ))}
            {proximo && (
              <button
                type="button"
                className="m-4 min-h-11 cursor-pointer rounded-full border border-ink px-4 font-bold hover:bg-parchment-deep"
                onClick={() => tentar(async () => {
                  const r = await comunidades.linhaDoNucleo(id, proximo, 20);
                  setItens((l) => [...l, ...r.itens.filter((x) => !l.some((y) => y.id === x.id))]);
                  setProximo(r.proximo);
                })}
              >
                {s.estados.maisPosts}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="border-t border-rule px-[18px] py-4">
        {confirmarSair ? (
          <div role="alertdialog" aria-label={n.sair} className="space-y-2">
            <p>{n.sairConfirmar}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => tentar(async () => { await comunidades.sairDoNucleo(id); setSaiu(true); })} className={botao}>{n.sairSim}</button>
              <button type="button" onClick={() => setConfirmarSair(false)} className={botaoClaro}>{sc.aula.cancelar}</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmarSair(true)} className={botaoClaro}>{n.sair}</button>
        )}
        {falha && <p role="alert" className="mt-2 text-sm text-oxblood">{falha}</p>}
      </section>
    </div>
  );
}

/**
 * Núcleos e turma (R4, item 40): a lista dos núcleos de que a pessoa faz parte, com a turma do mês no alto; com `id` nos parâmetros,
 * a página de um núcleo. A entrada em núcleo é por convite da mediação (convites com hash, pacote consertos): aqui só se vê o que é seu.
 */
export default function Nucleos({ lang, s, situacao, params, aoEscrever }: PropsDaTelaDoPacote) {
  const sc = textosDe(s);
  const id = params.id ?? "";
  const lista = useCarregar(() => (situacao.logado && situacao.membro && !id ? comunidades.nucleos() : Promise.resolve({ itens: [] })), `nucleos:${situacao.membro}:${id}`);
  if (!sc) return <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.emBreve}</p>;
  if (!situacao.logado || !situacao.membro) return <p className="px-[18px] py-8 font-sans text-ink-soft">{sc.acao.entrePrimeiro}</p>;
  if (id) {
    if (!idOk(id)) return <p role="alert" className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.naoEncontrado}</p>;
    return <PaginaDoNucleo id={id} lang={lang} s={s} sc={sc} situacao={situacao} aoEscrever={aoEscrever} />;
  }
  const n = sc.nucleos;
  return (
    <div className="font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="font-serif text-2xl font-extrabold">{n.titulo}</h1>
        <p className="mt-1 text-sm text-ink-soft">{n.intro}</p>
      </header>
      <TurmaDoMes lang={lang} s={s} sc={sc} />
      <section aria-labelledby="meus-nucleos" className="px-[18px] py-4">
        <h2 id="meus-nucleos" className="font-serif text-xl font-semibold">{n.meus}</h2>
        {!lista.pronto ? (
          <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={2} />
        ) : !lista.dado ? (
          <p role="alert" className="mt-1 text-oxblood">{lista.erro ? erroCom(s, sc, lista.erro) : s.estados.erro}</p>
        ) : lista.dado.itens.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">{n.vazio}</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {lista.dado.itens.map((x) => (
              <li key={x.id} className="py-3">
                <Link href={enderecosCom.nucleo(lang, x.id)} className="font-bold underline">{x.nome}</Link>
                <p className="text-sm text-ink-soft">{x.cidade}{x.trilha ? ` · ${x.trilha.replace(/-/g, " ")}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
