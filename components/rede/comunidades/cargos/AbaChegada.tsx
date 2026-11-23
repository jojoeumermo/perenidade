// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A aba Chegada da comunidade (encaixe `abasDaComunidade`, frente 10B): as boas-vindas com os interesses (a escolha fica só no
// aparelho), as regras para aceitar antes de postar, a etiqueta da pessoa ali (da lista fechada da moderação), os cargos dela e
// os cargos da comunidade (o que cada um pode e quantas pessoas, só a partir de 3; nunca quem). Quem cuida de alguma coisa vê,
// embaixo, só as ferramentas que a função dela permite (Gestao.tsx, que só chega ao navegador de quem cuida).
import "./cargos.css";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { EsqueletoDaLinha } from "../../Esqueletos";
import type { ContextoDoEncaixe } from "../../encaixes";
import { Confirmar, Torradas, useTorrada } from "../../conversa/base3";
import { cargos } from "./cliente";
import { chaveDosInteresses, cuidaDeAlgo, escolhidosQueExistem, PERMISSOES, type PainelDosCargos, type Permissao } from "./regras";
import { dataCurta, por, textoDoErro, type TextosDosCargos } from "./textos";
import { useTextosDosCargos } from "./usarTextos";
import { PorQueSemNumero } from "../../uso/PorQueSemNumero";

const Gestao = dynamic(() => import("./Gestao"), { ssr: false });

export function AbaChegada({ lang, s, situacao, slug }: ContextoDoEncaixe & { slug: string }) {
  const t = useTextosDosCargos(lang);
  const [estado, setEstado] = useState<{ slug: string; dado: PainelDosCargos | null; erro: string } | null>(null);
  const [rodada, setRodada] = useState(0);
  const torradas = useTorrada();
  const avisar = torradas.mostrar;
  const recarregar = useCallback(() => setRodada((n) => n + 1), []);

  useEffect(() => {
    if (!t) return;
    let vivo = true;
    cargos
      .painel(slug)
      .then((dado) => vivo && setEstado({ slug, dado, erro: "" }))
      .catch((e) => vivo && setEstado({ slug, dado: null, erro: textoDoErro(t.erros, e) }));
    return () => {
      vivo = false;
    };
  }, [slug, rodada, t]);

  const aoErro = useCallback((e: unknown) => t && avisar({ texto: textoDoErro(t.erros, e), erro: true }), [t, avisar]);
  const aoOk = useCallback((texto: string) => avisar({ texto }), [avisar]);

  if (!t || !estado || estado.slug !== slug) return <EsqueletoDaLinha rotulo={t?.carregando ?? ""} quantos={3} />;
  if (!estado.dado) {
    return (
      <div className="cg cg-vazio-tela" role="alert">
        <p>{estado.erro}</p>
        <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={recarregar}>{t.tentar}</button>
      </div>
    );
  }
  const d = estado.dado;
  const logado = situacao.logado && situacao.membro;
  const membroAqui = logado && d.situacao === "membro";

  return (
    <div className="cg">
      <BoasVindas t={t} d={d} slug={slug} />
      {d.chegada.regras_antes && <RegrasAntes t={t} d={d} slug={slug} lang={lang} logado={logado} aoErro={aoErro} aoOk={aoOk} aoMudar={recarregar} />}
      {d.meus_cargos.length > 0 && <MeusCargos t={t} d={d} aoErro={aoErro} aoOk={aoOk} aoMudar={recarregar} />}
      {logado && <MinhaEtiqueta t={t} d={d} slug={slug} membroAqui={membroAqui} aoErro={aoErro} aoOk={aoOk} aoMudar={recarregar} />}
      <CargosDaComunidade t={t} d={d} />
      {cuidaDeAlgo(d) && <Gestao t={t} d={d} slug={slug} lang={lang} s={s} aoErro={aoErro} aoOk={aoOk} aoMudar={recarregar} />}
      <Torradas estado={torradas} />
    </div>
  );
}

export default AbaChegada;

interface PropsDaSecao {
  t: TextosDosCargos;
  d: PainelDosCargos;
}
interface PropsDeAcao {
  aoErro: (e: unknown) => void;
  aoOk: (texto: string) => void;
  aoMudar: () => void;
}

/** As fichas das permissões de um cargo (nome escrito; a explicação no title e no leitor de tela). */
export function FichasDePermissao({ t, permissoes }: { t: TextosDosCargos; permissoes: readonly Permissao[] }) {
  if (permissoes.length === 0) return <p className="cg-sem-permissao">{t.cargos.semPermissao}</p>;
  return (
    <ul className="cg-fichas" aria-label={t.gestao.permissoesTitulo}>
      {PERMISSOES.filter((p) => permissoes.includes(p)).map((p) => (
        <li key={p} className="cg-ficha" data-perm={p} title={t.permissoes[p].texto}>
          {t.permissoes[p].nome}
          <span className="cg-so-leitor">: {t.permissoes[p].texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** As boas-vindas e os interesses. A escolha fica no aparelho (lucia:rede:interesses:<slug>, que o Sair rápido apaga). */
function BoasVindas({ t, d, slug }: PropsDaSecao & { slug: string }) {
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const cru = JSON.parse(localStorage.getItem(chaveDosInteresses(slug)) ?? "[]") as unknown;
        setEscolhidos(Array.isArray(cru) ? cru.filter((x): x is string => typeof x === "string") : []);
      } catch {
        setEscolhidos([]);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [slug]);
  const validos = escolhidosQueExistem(escolhidos, d.chegada.interesses);
  function alternar(chave: string) {
    const nova = validos.includes(chave) ? validos.filter((c) => c !== chave) : [...validos, chave];
    setEscolhidos(nova);
    try {
      if (nova.length) localStorage.setItem(chaveDosInteresses(slug), JSON.stringify(nova));
      else localStorage.removeItem(chaveDosInteresses(slug));
    } catch {
      // armazenamento bloqueado: a escolha vale só enquanto a aba estiver aberta
    }
  }
  const vazio = !d.chegada.boas_vindas.trim() && d.chegada.interesses.length === 0;
  const escolhidosEmOrdem = d.chegada.interesses.filter((i) => validos.includes(i.chave));
  return (
    <section className="cg-secao cg-boas" aria-labelledby="cg-boas-titulo">
      <p className="cg-carimbo al-cond">{t.boasVindas.carimbo}</p>
      <h2 id="cg-boas-titulo" className="cg-titulo al-cond">{t.boasVindas.titulo}</h2>
      {vazio ? (
        <p className="cg-vazio">{t.boasVindas.vazio}</p>
      ) : (
        <>
          {d.chegada.boas_vindas.trim() && <p className="cg-boas-texto">{d.chegada.boas_vindas}</p>}
          {d.chegada.interesses.length > 0 && (
            <div className="cg-interesses">
              <h3 className="cg-subtitulo al-cond">{t.boasVindas.interessesTitulo}</h3>
              <p className="cg-nota">{t.boasVindas.interessesDica}</p>
              <ul className="cg-ladrilhos">
                {d.chegada.interesses.map((i, n) => (
                  <li key={i.chave}>
                    <button type="button" className="cg-ladrilho" data-n={n % 6} aria-pressed={validos.includes(i.chave)} onClick={() => alternar(i.chave)}>
                      <span className="cg-ladrilho-marca" aria-hidden />
                      {i.nome}
                    </button>
                  </li>
                ))}
              </ul>
              {escolhidosEmOrdem.length > 0 && (
                <div className="cg-comeco" aria-live="polite">
                  <h3 className="cg-subtitulo al-cond">{t.boasVindas.comecoTitulo}</h3>
                  <ol>
                    {escolhidosEmOrdem.map((i) => (
                      <li key={i.chave}>
                        <strong>{i.nome}</strong>
                        <span>{i.texto || t.boasVindas.semTexto}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="cg-nota cg-cadeado">{t.boasVindas.soNoAparelho}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** As regras para aceitar antes de postar (só quando a comunidade pede). */
function RegrasAntes({ t, d, slug, lang, logado, aoErro, aoOk, aoMudar }: PropsDaSecao & PropsDeAcao & { slug: string; lang: string; logado: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  const mudaram = Boolean(d.regras_lidas_em && d.precisa_ler);
  async function aceitar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await cargos.aceitarRegras(slug);
      aoOk(t.regras.aceitouAviso);
      aoMudar();
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="cg-secao cg-regras" aria-labelledby="cg-regras-titulo" data-precisa={d.precisa_ler ? "sim" : undefined}>
      <h2 id="cg-regras-titulo" className="cg-titulo al-cond">{t.regras.titulo}</h2>
      <p className="cg-lead">{mudaram ? t.regras.mudaram : t.regras.pede}</p>
      <ol className="cg-regras-lista">
        {d.regras.map((r) => (
          <li key={r.numero}>
            <span className="cg-regra-n al-cond" aria-hidden>{r.numero}</span>
            <span>
              <strong>{r.titulo}</strong>
              {r.texto && <span className="cg-regra-texto"> {r.texto}</span>}
            </span>
          </li>
        ))}
      </ol>
      <div className="cg-acoes">
        {!logado ? (
          <p className="cg-nota">{t.regras.entreParaAceitar}</p>
        ) : d.precisa_ler ? (
          <button type="button" className="al-botao al-botao-primario al-botao-m" aria-disabled={ocupado ? "true" : undefined} onClick={() => void aceitar()}>
            {ocupado ? t.regras.aceitando : t.regras.aceitar}
          </button>
        ) : (
          d.regras_lidas_em && <span className="cg-selo al-cond">{por(t.regras.aceitas, { data: dataCurta(lang, d.regras_lidas_em) })}</span>
        )}
      </div>
    </section>
  );
}

/** Os cargos da pessoa ali: convites para aceitar ou recusar, e os aceitos, para deixar. */
function MeusCargos({ t, d, aoErro, aoOk, aoMudar }: PropsDaSecao & PropsDeAcao) {
  const [ocupado, setOcupado] = useState(false);
  const [deixando, setDeixando] = useState<{ id: string; nome: string } | null>(null);
  const voltar = useRef<HTMLButtonElement>(null);
  async function rodar(tarefa: () => Promise<unknown>, ok: string) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await tarefa();
      aoOk(ok);
      aoMudar();
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="cg-secao" aria-labelledby="cg-meus-titulo">
      <h2 id="cg-meus-titulo" className="cg-titulo al-cond">{t.meus.titulo}</h2>
      <ul className="cg-cartoes">
        {d.meus_cargos.map((k) => (
          <li key={k.id} className="cg-cartao" data-situacao={k.situacao}>
            <p className="cg-cartao-sobre al-cond">{k.situacao === "convidado" ? t.meus.convite : t.meus.ativo}</p>
            <h3 className="cg-cartao-nome al-cond">{k.nome}</h3>
            <FichasDePermissao t={t} permissoes={k.permissoes} />
            <div className="cg-acoes">
              {k.situacao === "convidado" ? (
                <>
                  <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={() => void rodar(() => cargos.responder(k.id, true), t.meus.aceito)}>{t.meus.aceitar}</button>
                  <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => void rodar(() => cargos.responder(k.id, false), t.meus.recusado)}>{t.meus.recusar}</button>
                </>
              ) : (
                <button ref={voltar} type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => setDeixando({ id: k.id, nome: k.nome })}>{t.meus.deixar}</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Confirmar
        aberto={Boolean(deixando)}
        titulo={t.meus.deixar}
        texto={por(t.meus.deixarPergunta, { nome: deixando?.nome ?? "" })}
        sim={t.meus.deixar}
        nao={t.gestao.cancelar}
        aoSim={() => deixando && void rodar(() => cargos.deixar(deixando.id), t.meus.deixado)}
        aoFechar={() => setDeixando(null)}
        voltarPara={voltar}
      />
    </section>
  );
}

/** A etiqueta da pessoa ali: as que ela mesma escolhe, as oferecidas a ela e "Sem etiqueta". */
function MinhaEtiqueta({ t, d, slug, membroAqui, aoErro, aoOk, aoMudar }: PropsDaSecao & PropsDeAcao & { slug: string; membroAqui: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  const minhas = d.etiquetas.filter((e) => e.quem_da === "pessoa");
  async function rodar(tarefa: () => Promise<unknown>, ok: string) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await tarefa();
      aoOk(ok);
      aoMudar();
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="cg-secao" aria-labelledby="cg-etiqueta-titulo">
      <h2 id="cg-etiqueta-titulo" className="cg-titulo al-cond">{t.etiqueta.titulo}</h2>
      <p className="cg-lead">{t.etiqueta.dica}</p>
      {d.ofertas.map((o) => (
        <div key={o.id} className="cg-oferta" role="note">
          <p>{por(t.etiqueta.oferta, { nome: o.nome })}</p>
          <div className="cg-acoes">
            <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={() => void rodar(() => cargos.escolherEtiqueta(slug, o.id), t.etiqueta.escolhida)}>{t.etiqueta.aceitar}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => void rodar(() => cargos.recusarEtiqueta(slug, o.id), t.etiqueta.recusada)}>{t.etiqueta.recusar}</button>
          </div>
        </div>
      ))}
      {!membroAqui ? (
        <p className="cg-vazio">{t.etiqueta.soMembro}</p>
      ) : d.etiquetas.length === 0 ? (
        <p className="cg-vazio">{t.etiqueta.semLista}</p>
      ) : (
        <fieldset className="cg-escolha" disabled={ocupado}>
          <legend className="cg-so-leitor">{t.etiqueta.titulo}</legend>
          {d.minha_etiqueta && !minhas.some((e) => e.id === d.minha_etiqueta?.id) && (
            <label className="cg-opcao">
              <input type="radio" name="cg-etiqueta" checked readOnly />
              <span>{d.minha_etiqueta.nome}</span>
            </label>
          )}
          {minhas.map((e) => (
            <label key={e.id} className="cg-opcao">
              <input type="radio" name="cg-etiqueta" checked={d.minha_etiqueta?.id === e.id} onChange={() => void rodar(() => cargos.escolherEtiqueta(slug, e.id), t.etiqueta.escolhida)} />
              <span>{e.nome}</span>
            </label>
          ))}
          <label className="cg-opcao cg-opcao-nenhuma">
            <input type="radio" name="cg-etiqueta" checked={!d.minha_etiqueta} onChange={() => void rodar(() => cargos.escolherEtiqueta(slug, null), t.etiqueta.tirada)} />
            <span>{t.etiqueta.nenhuma}</span>
          </label>
        </fieldset>
      )}
    </section>
  );
}

/** Os cargos da comunidade: nome, o que fazem, o que podem e quantas pessoas (a partir de 3). Nunca quem. */
function CargosDaComunidade({ t, d }: PropsDaSecao) {
  return (
    <section className="cg-secao" aria-labelledby="cg-cargos-titulo">
      <h2 id="cg-cargos-titulo" className="cg-titulo al-cond">{t.cargos.titulo}</h2>
      <p className="cg-lead">{t.cargos.dica}</p>
      {d.cargos.length === 0 ? (
        <p className="cg-vazio">{t.cargos.vazio}</p>
      ) : (
        <ul className="cg-cartoes cg-cartoes-grade">
          {d.cargos.map((k, n) => (
            <li key={k.id} className="cg-cartao" data-n={n % 6}>
              <h3 className="cg-cartao-nome al-cond">{k.nome}</h3>
              {k.descricao && <p className="cg-cartao-texto">{k.descricao}</p>}
              <FichasDePermissao t={t} permissoes={k.permissoes} />
              <p className="cg-cartao-n">
                {k.pessoas === null ? t.cargos.poucas : por(t.cargos.pessoas, { n: k.pessoas })}
                {k.pessoas === null ? <PorQueSemNumero motivo="piso" /> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
