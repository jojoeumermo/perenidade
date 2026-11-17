// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os convites de quem já está dentro (supabase/migracoes/20261114-alumia-o8-porta.sql): quantos restam no mês (ladrilhos), gerar um
// convite (o link aparece UMA vez: o banco guarda só o resumo do código), e os convites do mês com a situação de cada um (aberto,
// vencido, cancelado). O convite usado sai do banco na hora: aparece só no número de usados do mês. Nunca quem usou: o banco não
// sabe. Na página própria o título é o h1; embutido em Segurança, o título é o da seção (um só) e o botão é o dos outros blocos.
// Os tokens são os da Alumia (claro e escuro).
import "./convites.css";
import { useCallback, useEffect, useId, useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { dataCurta, preencher, type TextosDosConvites, useTextosDosConvites } from "./textos";

type Situacao = "aberto" | "usado" | "vencido" | "cancelado";
interface Convite {
  id: string;
  criado_em: string;
  vence_em: string;
  situacao: Situacao;
}
interface Meus {
  teto: number;
  no_mes: number;
  restam: number;
  usados?: number;
  pode: boolean;
  convites: Convite[];
}

const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
/** Na prévia sem banco: um mês com um convite aberto, um usado (só no número) e um vencido. */
const PREVIA: Meus = {
  teto: 3, no_mes: 2, restam: 1, usados: 1, pode: true,
  convites: [
    { id: "p1", criado_em: dias(-1), vence_em: dias(6), situacao: "aberto" },
    { id: "p3", criado_em: dias(-12), vence_em: dias(-5), situacao: "vencido" },
  ],
};

/** O endereço do convite, no endereço em que a pessoa está (o caminho completo vale no site e no host da Alumia). */
function linkDoConvite(lang: string, codigo: string): string {
  return `${window.location.origin}/${lang}/alumia/convite/${codigo}`;
}

export function MeusConvites({ lang, embutido = false }: { lang: string; embutido?: boolean }) {
  const t = useTextosDosConvites(lang);
  return t ? <Convites lang={lang} t={t} embutido={embutido} /> : null;
}

function Convites({ lang, t, embutido }: { lang: string; t: TextosDosConvites; embutido: boolean }) {
  const m = t.meus;
  const [meus, setMeus] = useState<Meus | null>(() => (!hasBackend && previaDaAlumiaLigada() ? PREVIA : null));
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState<{ link: string; venceEm: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const idLink = useId();

  // Reler (depois de gerar): muda a volta e o efeito lê de novo.
  const [volta, setVolta] = useState(0);
  const ler = useCallback(() => setVolta((v) => v + 1), []);

  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<Meus>("alumia_convites_meus")
      .then((r) => {
        if (!vivo) return;
        setMeus(r);
        setErro("");
      })
      .catch(() => vivo && setErro(m.erro));
    return () => {
      vivo = false;
    };
  }, [m.erro, volta]);

  async function gerar() {
    setOcupado(true);
    setErro("");
    setCopiado(false);
    try {
      if (!hasBackend && previaDaAlumiaLigada()) {
        setNovo({ link: linkDoConvite(lang, "0123456789abcdef0123456789abcdef"), venceEm: dias(7) });
        setMeus((x) => (x ? { ...x, restam: 0, no_mes: x.teto, convites: [{ id: "p0", criado_em: dias(0), vence_em: dias(7), situacao: "aberto" }, ...x.convites] } : x));
        return;
      }
      const r = await rpc<{ codigo: string; vence_em: string }>("alumia_convite_criar");
      setNovo({ link: linkDoConvite(lang, r.codigo), venceEm: r.vence_em });
      ler();
    } catch (e) {
      const codigo = e instanceof BackendError ? e.code : "";
      setErro(codigo === "teto_de_convites" ? m.acabaram : codigo === "sem_permissao" || codigo === "alumia_entrada" ? m.soDentro : m.erro);
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    if (!novo) return;
    try {
      await navigator.clipboard.writeText(novo.link);
      setCopiado(true);
    } catch {
      (document.getElementById(idLink) as HTMLInputElement | null)?.select();
    }
  }

  async function cancelar(id: string) {
    try {
      if (hasBackend) await rpc("alumia_convite_cancelar", { p_id: id });
      setMeus((x) => (x ? { ...x, convites: x.convites.map((c) => (c.id === id ? { ...c, situacao: "cancelado" } : c)) } : x));
    } catch {
      setErro(m.erro);
    }
  }

  const desligados = meus?.teto === 0;
  // Na página, o título é h1 e os de dentro h2; embutido (a seção de Segurança já tem o h2), os de dentro são h3.
  const Sub = embutido ? "h3" : "h2";
  return (
    <section className="alc" aria-labelledby={embutido ? undefined : "alc-titulo"} aria-label={embutido ? m.titulo : undefined}>
      <header className="alc-cabeca">
        {embutido ? null : <h1 id="alc-titulo" className="alc-titulo">{m.titulo}</h1>}
        <p className="alc-texto">{m.texto}</p>
      </header>

      {meus && !meus.pode ? (
        <p className="alc-aviso">{m.soDentro}</p>
      ) : meus && desligados ? (
        <p className="alc-aviso">{m.desligados}</p>
      ) : meus ? (
        <div className="alc-placar">
          <span className="alc-ladrilhos" aria-hidden>
            {Array.from({ length: Math.min(meus.teto, 20) }, (_, i) => (
              <span key={i} className="alc-ladrilho" data-livre={i < meus.restam || undefined} />
            ))}
          </span>
          <span className="alc-restam">{preencher(meus.restam === 1 ? m.restamUm : m.restam, { n: meus.restam, teto: meus.teto })}</span>
          <Botao variante="primario" tamanho="m" pilula={!embutido} onClick={() => void gerar()} disabled={ocupado || meus.restam <= 0} aria-describedby={meus.restam <= 0 ? "alc-acabaram" : undefined}>
            {ocupado ? m.gerando : m.gerar}
          </Botao>
          {meus.restam <= 0 ? <span id="alc-acabaram" className="alc-miudo">{m.acabaram}</span> : null}
        </div>
      ) : null}

      {novo ? (
        <div className="alc-novo" role="status">
          <Sub className="alc-novo-titulo">{m.novoTitulo}</Sub>
          <p className="alc-texto">{preencher(m.novo, { data: dataCurta(novo.venceEm, lang) })}</p>
          <div className="alc-link">
            <label className="sr-only" htmlFor={idLink}>{m.rotuloLink}</label>
            <input id={idLink} readOnly value={novo.link} onFocus={(e) => e.currentTarget.select()} />
            <Botao variante="claro" tamanho="m" pilula={!embutido} onClick={() => void copiar()}>
              {copiado ? m.copiado : m.copiar}
            </Botao>
          </div>
        </div>
      ) : null}

      {erro ? <p className="alc-aviso" data-tom="erro" role="alert">{erro}</p> : null}

      {meus && meus.pode ? (
        <div className="alc-cabeca">
          <Sub className="alc-novo-titulo">{m.lista}</Sub>
          {meus.usados ? <p className="alc-miudo">{preencher(m.usados, { n: meus.usados })}</p> : null}
          {meus.convites.length === 0 ? (
            <p className="alc-miudo">{m.vazio}</p>
          ) : (
            <ul className="alc-lista">
              {meus.convites.map((c) => (
                <li key={c.id} className="alc-item">
                  <span className="alc-item-texto">
                    <span className="alc-situacao" data-s={c.situacao}>
                      {preencher(m.situacoes[c.situacao], { data: dataCurta(c.vence_em, lang) })}
                    </span>
                    <span className="alc-miudo">{preencher(m.criado, { data: dataCurta(c.criado_em, lang) })}</span>
                  </span>
                  {c.situacao === "aberto" ? (
                    <Botao variante="contorno" tamanho="p" pilula={!embutido} onClick={() => void cancelar(c.id)} aria-label={preencher(m.cancelarRotulo, { data: dataCurta(c.criado_em, lang) })}>
                      {m.cancelar}
                    </Botao>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="alc-nota">{m.nota}</p>
        </div>
      ) : null}
    </section>
  );
}
