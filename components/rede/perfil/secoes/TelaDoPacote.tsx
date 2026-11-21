// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Um pacote inicial (/alumia/pacote/<slug>, onda 12, 12D): o título, a descrição, quem está nele (só quem aceitou ENTRAR nele) e
// "Seguir todas". Para levar o pacote a um ato ou a uma roda: o link e o QR, feito aqui no aparelho com a biblioteca qrcode do
// projeto (nada vai a serviço de fora). Quem cuida dos pacotes (coordenação, curadoria, educação, mediação) vê também o cuidado.
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "@/components/Link";
import { pacote as lerPacote, seguirPacote } from "@/lib/rede/cliente-secoes-perfil";
import { preencher } from "@/lib/rede/preencher";
import { numeroQueAparece, slugDoPacoteOk } from "@/lib/rede/secoes-perfil";
import { enderecosDescoberta, type PacoteDePessoas } from "@/lib/rede/tipos-descoberta";
import { enderecos } from "@/lib/rede/tipos";
import { EsqueletoDaLinha } from "../../Esqueletos";
import { Avatar16 } from "../../ui/Avatar16";
import type { PropsDaTelaDoPacote } from "../../registro";
import { CuidarDosPacotes } from "./Cuidar";
import { useTextosDasSecoes } from "./textos";
import "./secoes.css";
import { entradaDaAlumia } from "@/lib/rede/alumia";

/** O QR de um endereço, gerado no aparelho (biblioteca qrcode, carregada só aqui). Nulo enquanto faz; "" se não deu. */
export function useQr(endereco: string | null): string | null {
  const [qr, setQr] = useState<{ de: string; url: string } | null>(null);
  useEffect(() => {
    if (!endereco) return;
    let vivo = true;
    import("qrcode")
      .then((q) => q.toDataURL(endereco, { errorCorrectionLevel: "M", margin: 2, width: 400, color: { dark: "#0f0e0d", light: "#f3efe6" } }))
      .then((url) => vivo && setQr({ de: endereco, url }))
      .catch(() => vivo && setQr({ de: endereco, url: "" }));
    return () => {
      vivo = false;
    };
  }, [endereco]);
  return qr && qr.de === endereco ? qr.url : null;
}

const semInscricao = () => () => {};
const enderecoDaPagina = () => `${window.location.origin}${window.location.pathname}`;

export default function TelaDoPacote({ lang, s, situacao, params }: PropsDaTelaDoPacote) {
  const t = useTextosDasSecoes(lang);
  const slug = params.slug ?? "";
  const [estado, setEstado] = useState<{ slug: string; dado: PacoteDePessoas | null; erro: string } | null>(null);
  const [seguindo, setSeguindo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [copiado, setCopiado] = useState(false);
  // O endereço desta página, como a pessoa a abriu (no endereço próprio da Alumia ou no do site), sem consulta. No servidor, nulo.
  const endereco = useSyncExternalStore(semInscricao, enderecoDaPagina, () => null);
  const qr = useQr(endereco);

  useEffect(() => {
    if (!slugDoPacoteOk(slug)) return;
    if (!situacao.logado) return;
    let vivo = true;
    lerPacote(slug)
      .then((dado) => vivo && setEstado({ slug, dado, erro: "" }))
      .catch((e) => vivo && setEstado({ slug, dado: null, erro: String((e as { code?: string; message?: string })?.code ?? (e as Error)?.message ?? "") }));
    return () => {
      vivo = false;
    };
  }, [slug, situacao.logado]);

  if (!t) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (!slugDoPacoteOk(slug)) return <NaoAchado t={t} lang={lang} />;
  const dado = estado?.slug === slug ? estado.dado : null;
  if (situacao.logado && !estado) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (situacao.logado && !dado) return <NaoAchado t={t} lang={lang} />;

  async function seguirTodas() {
    setSeguindo(true);
    setAviso("");
    try {
      const r = await seguirPacote(slug);
      setAviso(preencher(t!.pacote.seguidas, { n: r.seguidos.toLocaleString(lang) }));
      setEstado((e) => (e && e.dado ? { ...e, dado: { ...e.dado, pessoas: e.dado.pessoas.map((p) => ({ ...p, sigo: true })) } } : e));
    } catch {
      setAviso(t!.erros.generico);
    } finally {
      setSeguindo(false);
    }
  }

  async function copiar() {
    if (!endereco) return;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  const n = numeroQueAparece(dado?.pessoas.length ?? null);
  const todasSeguidas = Boolean(dado && dado.pessoas.length > 0 && dado.pessoas.every((p) => p.sigo));

  return (
    <div className="pfs-pacote" data-al-tela="pacote">
      <header className="pfs-pacote-topo">
        <p className="pfs-pacote-rotulo">
          <i aria-hidden className="pfs-ladrilho" />
          {t.pacote.rotulo}
        </p>
        <h1 className="al-cond pfs-pacote-titulo">{dado?.titulo ?? t.pacote.rotulo}</h1>
        {dado?.descricao ? <p className="pfs-pacote-descricao">{dado.descricao}</p> : null}
      </header>

      <div className="pfs-pacote-corpo">
        <section className="pfs-pacote-pessoas" aria-labelledby="pacote-pessoas">
          <h2 id="pacote-pessoas" className="al-cond pfs-titulo">
            <i aria-hidden className="pfs-ladrilho" />
            {t.pacote.pessoas}
            {n !== null ? <span className="pfs-ed-sub">· {preencher(t.pacote.nPessoas, { n: n.toLocaleString(lang) })}</span> : null}
          </h2>
          {!situacao.logado ? (
            <div className="pfs-acoes">
              <p className="pfs-ed-ajuda">{t.pacote.entrar}</p>
              <Link href={entradaDaAlumia(lang, `/alumia/pacote/${slug}`)} className="al-botao al-botao-primario al-botao-m">
                {s.entrada.entrar}
              </Link>
            </div>
          ) : dado && dado.pessoas.length === 0 ? (
            <p className="pfs-vazio">{t.pacote.vazio}</p>
          ) : dado ? (
            <>
              <ul className="pfs-pessoas">
                {dado.pessoas.map((p) => (
                  <li key={p.handle}>
                    <Link href={enderecos.perfil(lang, p.handle)} className="pfs-pessoa">
                      <Avatar16 handle={p.handle} tamanho={44} />
                      <span>
                        <b>{p.codinome}</b>
                        <small>@{p.handle}</small>
                        {p.bio ? <p>{p.bio}</p> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="pfs-acoes">
                <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={seguindo || todasSeguidas || !situacao.membro} onClick={() => void seguirTodas()}>
                  {seguindo ? t.pacote.seguindo : t.pacote.seguirTodas}
                </button>
                {aviso ? (
                  <p className="pfs-estado" role="status">
                    {aviso}
                  </p>
                ) : null}
              </div>
              <p className="pfs-nota">{t.pacote.soQuemAceitou}</p>
            </>
          ) : null}
        </section>

        <aside className="pfs-levar" aria-labelledby="pacote-levar">
          <h2 id="pacote-levar" className="al-cond pfs-titulo">
            <i aria-hidden className="pfs-ladrilho" />
            {t.pacote.compartilhar}
          </h2>
          <p className="pfs-ed-sub">{t.pacote.link}</p>
          {endereco ? <code className="pfs-endereco">{endereco}</code> : null}
          <div className="pfs-acoes">
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => void copiar()}>
              {copiado ? t.pacote.copiado : t.pacote.copiar}
            </button>
          </div>
          <p className="pfs-ed-sub">{t.pacote.qr}</p>
          {qr ? (
            <>
              <span className="pfs-qr">
                {/* eslint-disable-next-line @next/next/no-img-element -- QR feito no aparelho, em data URL. */}
                <img src={qr} alt={`${t.pacote.qr}: ${dado?.titulo ?? slug}`} width={200} height={200} />
              </span>
              <a href={qr} download={`pacote-${slug}.png`} className="al-botao al-botao-contorno al-botao-p">
                {t.pacote.baixarQr}
              </a>
            </>
          ) : qr === "" ? (
            <p className="pfs-ed-ajuda">{t.pacote.qrFalhou}</p>
          ) : null}
          <p className="pfs-ed-ajuda">{t.pacote.qrAjuda}</p>
        </aside>
      </div>

      {situacao.logado ? <CuidarDosPacotes lang={lang} t={t} atual={slug} /> : null}
    </div>
  );
}

function NaoAchado({ t, lang }: { t: NonNullable<ReturnType<typeof useTextosDasSecoes>>; lang: string }) {
  return (
    <div className="pfs-pacote">
      <div className="pf-nao-achado pfs-pacote-pessoas" role="status">
        <h1 className="al-cond pfs-pacote-titulo">{t.pacote.rotulo}</h1>
        <p>{t.pacote.naoAchado}</p>
        <Link href={enderecosDescoberta.explorar(lang)} className="al-botao al-botao-contorno al-botao-m">
          {t.pacote.explorar}
        </Link>
      </div>
    </div>
  );
}
