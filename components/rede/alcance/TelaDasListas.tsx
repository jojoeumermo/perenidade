// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Levar e trazer quem eu sigo (/alumia/listas, frente 13C). A lista é só da pessoa: a tela baixa um arquivo .csv no formato que as
// instâncias do Fediverso leem (lib/rede/alcance/regras.ts) e traz de volta o arquivo de outra instância (ou endereços colados),
// mostrando antes o que vai acontecer e seguindo um por um, com os limites do banco e da federação. Quem é daqui segue pelo @
// (rede_perfil_seguir); quem é de fora, pela busca e pelo seguir da Faixa 2. Embaixo, o QR e o RSS do perfil da própria pessoa.
// Nada sai do aparelho além dos pedidos de seguir.
import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/Link";
import { minhaLista, PREVIA_DO_ALCANCE, rotaResponde, seguirConta, type MinhaLista, type SituacaoDaConta } from "@/lib/rede/alcance/cliente";
import { arquivoDaLista, handleDaqui, lerLista, MAXIMO_POR_VEZ, rotasDoAlcance } from "@/lib/rede/alcance/regras";
import { textoDoErroDoAlcance, type TextosDoAlcance } from "@/lib/rede/alcance/textos";
import { preencher } from "@/lib/rede/preencher";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { baixarArquivo, copiarTexto, dominiosDaqui, enderecoDaTela, origemAqui, useQr, useTextosDoAlcance } from "./usar";
import "./alcance.css";
import { entradaDaAlumia } from "@/lib/rede/alumia";

const UM_MEGA = 1024 * 1024;
const codigo = (e: unknown) => (typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "");

export default function TelaDasListas({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDoAlcance(lang);
  const logado = situacao.logado || PREVIA_DO_ALCANCE;
  if (!t) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  return (
    <div className="alc alc-tela" data-al-tela="listas">
      <header className="alc-cabeca">
        <p className="alc-carimbo">{t.listas.rotulo}</p>
        <h1 className="alc-cond alc-titulo">{t.listas.titulo}</h1>
        <p className="alc-lead">{t.listas.intro}</p>
      </header>
      {!logado ? (
        <div className="alc-bloco">
          <p className="alc-lead">{t.listas.entrar}</p>
          <div className="alc-acoes">
            <Link href={entradaDaAlumia(lang, "/alumia/listas")} className="al-botao al-botao-primario al-botao-m">
              {s.entrada.entrar}
            </Link>
          </div>
        </div>
      ) : (
        <div className="alc-grade">
          <Exportar t={t} />
          <Importar t={t} lang={lang} />
          <SeuPerfil t={t} lang={lang} handle={situacao.handle ?? (PREVIA_DO_ALCANCE ? "faisca" : null)} />
        </div>
      )}
    </div>
  );
}

function Exportar({ t }: { t: TextosDoAlcance }) {
  const id = useId();
  const [lista, setLista] = useState<MinhaLista | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    minhaLista()
      .then((l) => vivo && setLista(l))
      .catch((e) => vivo && setErro(textoDoErroDoAlcance(t, codigo(e))));
    return () => {
      vivo = false;
    };
  }, [t]);
  const { doArquivo } = typeof window === "undefined" ? { doArquivo: "" } : dominiosDaqui();
  const total = lista ? lista.locais.length + lista.fora.length : 0;
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <section className="alc-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="alc-cond alc-bloco-titulo">
        <i aria-hidden className="alc-ladrilho" />
        {t.listas.exportar.titulo}
      </h2>
      <p className="alc-nota">{t.listas.exportar.ajuda}</p>
      {erro ? (
        <p className="alc-erro" role="alert">{erro}</p>
      ) : !lista ? (
        <p className="alc-nota" role="status">{t.listas.carregando}</p>
      ) : total === 0 ? (
        <p className="alc-vazio">{t.listas.exportar.vazia}</p>
      ) : (
        <>
          {/* Só a contagem, em texto corrido (não é botão). O singular tem frase própria. */}
          <p className="alc-contagem">
            {lista.locais.length === 1 ? t.listas.exportar.daqui1 : preencher(t.listas.exportar.daqui, { n: String(lista.locais.length) })}
            {" · "}
            {lista.fora.length === 1 ? t.listas.exportar.fora1 : preencher(t.listas.exportar.fora, { n: String(lista.fora.length) })}
          </p>
          <div className="alc-acoes">
            <button
              type="button"
              className="al-botao al-botao-primario al-botao-m"
              onClick={() => baixarArquivo(new Blob([arquivoDaLista(lista, doArquivo)], { type: "text/csv;charset=utf-8" }), `alumia-quem-eu-sigo-${hoje}.csv`)}
            >
              {t.listas.exportar.baixar}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

interface Linha {
  conta: string;
  situacao: SituacaoDaConta;
}

function Importar({ t, lang }: { t: TextosDoAlcance; lang: string }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [lido, setLido] = useState<{ contas: string[]; ignoradas: number; demais: number } | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [andando, setAndando] = useState(false);
  const [fim, setFim] = useState<"" | "pronto" | "parado">("");
  const [aviso, setAviso] = useState("");
  const parar = useRef(false);
  const dominios = typeof window === "undefined" ? [] : dominiosDaqui().lista;

  function conferir(conteudo: string) {
    const r = lerLista(conteudo);
    const contas = r.contas.slice(0, MAXIMO_POR_VEZ);
    setLido({ contas, ignoradas: r.ignoradas, demais: Math.max(0, r.contas.length - contas.length) });
    setLinhas(contas.map((conta) => ({ conta, situacao: "esperando" })));
    setFim("");
  }

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    setAviso("");
    if (!arquivo) return;
    if (arquivo.size > UM_MEGA) {
      setAviso(t.listas.importar.grande);
      return;
    }
    const conteudo = await arquivo.text();
    setTexto(conteudo.length > 20_000 ? `${conteudo.slice(0, 20_000)}…` : conteudo);
    conferir(conteudo);
  }

  async function seguirTodos() {
    if (!lido || andando) return;
    setAndando(true);
    setFim("");
    parar.current = false;
    for (let i = 0; i < linhas.length; i++) {
      if (parar.current) {
        setFim("parado");
        setAndando(false);
        return;
      }
      if (linhas[i].situacao !== "esperando") continue;
      const situacao = await seguirConta(linhas[i].conta, dominios);
      setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, situacao } : l)));
      // O limite do dia vale para os próximos também: para aqui, sem gastar pedido.
      if (situacao === "limite") {
        setFim("parado");
        setAndando(false);
        return;
      }
      // Um passo de cada vez (a busca da federação tem teto por minuto).
      await new Promise((r) => setTimeout(r, handleDaqui(linhas[i].conta, dominios) ? 150 : 900));
    }
    setFim("pronto");
    setAndando(false);
  }

  const daqui = lido ? lido.contas.filter((c) => handleDaqui(c, dominios)).length : 0;
  const fora = lido ? lido.contas.length - daqui : 0;
  const feitos = linhas.filter((l) => l.situacao !== "esperando").length;
  const precisaFediverso = linhas.some((l) => l.situacao === "fediverso");
  return (
    <section className="alc-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="alc-cond alc-bloco-titulo">
        <i aria-hidden className="alc-ladrilho" />
        {t.listas.importar.titulo}
      </h2>
      <p className="alc-nota">{t.listas.importar.ajuda}</p>
      <div className="alc-acoes">
        <label className="alc-arquivo">
          <span className="al-botao al-botao-contorno al-botao-m">{t.listas.importar.arquivo}</span>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => void escolher(e)} disabled={andando} aria-label={t.listas.importar.arquivo} />
        </label>
      </div>
      <label className="alc-campo">
        {t.listas.importar.colar}
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder={t.listas.importar.exemplo} disabled={andando} spellCheck={false} />
      </label>
      <div className="alc-acoes">
        <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={andando || !texto.trim()} onClick={() => conferir(texto)}>
          {t.listas.importar.conferir}
        </button>
      </div>
      {aviso ? <p className="alc-erro" role="alert">{aviso}</p> : null}
      {lido ? (
        lido.contas.length === 0 ? (
          <p className="alc-vazio">{t.listas.importar.vazio}</p>
        ) : (
          <>
            <p className="alc-contagem">{preencher(t.listas.importar.resumo, { daqui: String(daqui), fora: String(fora) })}</p>
            {lido.ignoradas > 0 ? <p className="alc-nota">{preencher(t.listas.importar.ignoradas, { n: String(lido.ignoradas) })}</p> : null}
            {lido.demais > 0 ? <p className="alc-nota">{preencher(t.listas.importar.demais, { n: String(MAXIMO_POR_VEZ) })}</p> : null}
            <div className="alc-acoes">
              {andando ? (
                <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => (parar.current = true)}>
                  {t.listas.importar.parar}
                </button>
              ) : (
                <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={feitos === linhas.length} onClick={() => void seguirTodos()}>
                  {t.listas.importar.seguirTodos}
                </button>
              )}
            </div>
            {andando || feitos > 0 ? (
              <>
                <div className="alc-barra" role="progressbar" aria-valuemin={0} aria-valuemax={linhas.length} aria-valuenow={feitos} aria-label={preencher(t.listas.importar.andamento, { feitos: String(feitos), total: String(linhas.length) })}>
                  <i style={{ width: `${Math.round((feitos / Math.max(1, linhas.length)) * 100)}%` }} />
                </div>
                <p className="alc-status" role="status">
                  {fim === "pronto" ? t.listas.importar.pronto : fim === "parado" ? t.listas.importar.parado : preencher(t.listas.importar.andamento, { feitos: String(feitos), total: String(linhas.length) })}
                </p>
              </>
            ) : null}
            {precisaFediverso ? (
              <p className="alc-nota">
                {t.listas.fediverso.aviso}{" "}
                <Link href={`/${lang}/alumia/fediverso`} className="alc-link">
                  {t.listas.fediverso.link}
                </Link>
              </p>
            ) : null}
            <ul className="alc-contas" aria-label={t.listas.importar.titulo}>
              {linhas.map((l) => (
                <li key={l.conta}>
                  <code>@{l.conta}</code>
                  <span className="alc-situacao" data-s={l.situacao}>{t.listas.situacoes[l.situacao]}</span>
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}
    </section>
  );
}

function SeuPerfil({ t, lang, handle }: { t: TextosDoAlcance; lang: string; handle: string | null }) {
  const id = useId();
  const endereco = handle ? enderecoDaTela(lang, `/u/${handle}`) : null;
  const qr = useQr(endereco);
  const rss = handle ? rotasDoAlcance.rss(origemAqui(), "perfil", handle, lang) : null;
  const [temRss, setTemRss] = useState<boolean | null>(null);
  const [copiado, setCopiado] = useState("");
  useEffect(() => {
    if (!rss) return;
    let vivo = true;
    rotaResponde(rss, false).then((ok) => vivo && setTemRss(ok));
    return () => {
      vivo = false;
    };
  }, [rss]);
  if (!handle || !endereco) return null;
  async function copiar(texto: string) {
    setCopiado((await copiarTexto(texto)) ? texto : "");
  }
  return (
    <section className="alc-bloco alc-bloco-largo" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="alc-cond alc-bloco-titulo">
        <i aria-hidden className="alc-ladrilho" />
        {t.listas.perfil.titulo}
      </h2>
      <div className="alc-perfil">
        <span className="alc-qr">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR feito no aparelho, em data URL.
            <img src={qr} alt={preencher(t.qr.alt, { nome: `@${handle}` })} width={168} height={168} />
          ) : (
            <span className="alc-nota" role="status">{qr === "" ? t.qr.falhou : t.qr.fazendo}</span>
          )}
        </span>
        <div className="alc-qr-lado">
          <p className="alc-sub">{t.qr.tituloPerfil}</p>
          <p className="alc-nota">{t.qr.ajuda}</p>
          <code className="alc-endereco">{endereco}</code>
          <div className="alc-acoes">
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => void copiar(endereco)}>
              {copiado === endereco ? t.folha.copiado : t.folha.copiar}
            </button>
            {qr ? (
              <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => baixarArquivo(qr, `alumia-qr-${handle}.png`)}>
                {t.qr.baixar}
              </button>
            ) : null}
          </div>
          <p className="alc-sub">{t.listas.perfil.rss}</p>
          {temRss === null ? (
            <p className="alc-nota" role="status">{t.comunidade.conferindo}</p>
          ) : temRss && rss ? (
            <>
              <p className="alc-nota">{t.listas.perfil.rssOrg}</p>
              <code className="alc-endereco">{rss}</code>
              <div className="alc-acoes">
                <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => void copiar(rss)}>
                  {copiado === rss ? t.folha.copiado : t.folha.copiar}
                </button>
              </div>
            </>
          ) : (
            <p className="alc-nota">{t.listas.perfil.rssPessoa}</p>
          )}
        </div>
      </div>
    </section>
  );
}
