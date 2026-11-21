// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A segurança pessoal (/alumia/seguranca-pessoal; Prompt 4, itens 10 a 12), atrás de "alumia-p4-seguranca-pessoal":
//   - a chave de segurança deste aparelho (para quem recebe);
//   - o plantão jurídico (11) e o registro de abuso (10): cifrados aqui só para a assessoria que a organização indicou;
//   - o interruptor de sumiço (12) e os avisos de sumiço que chegaram;
//   - a caixa da assessoria (para quem foi indicada) e a indicação (para quem gere a organização).
// Nenhuma lista de pessoas: a gestão vê só se o plantão está pronto; a caixa não diz quem mandou; nenhum número de pessoas.
import "./seguranca-pessoal.css";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { confirmar } from "@/components/perguntar";
import type { Aberto, AvisoRecebido, ItemDaCaixa, Situacao } from "@/lib/rede/seguranca-pessoal/aparelho";
import { CONTATOS, OCORRIDOS, TAMANHOS, type Ocorrido, type TipoDeContato } from "@/lib/rede/seguranca-pessoal/selo";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { seguranca } from "./cliente";
import { diaNoIdioma, por, textoDoErro, type TextosDaSegurancaPessoal } from "./textos";
import { useTextosDaSegurancaPessoal } from "./usarTextos";

type T = TextosDaSegurancaPessoal;

/** Um bloco com título, e o estado de "ocupado", erro e ok de cada ação. */
function useAcao(t: T) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const fazer = useCallback(async (acao: () => Promise<string | void>) => {
    setOcupado(true);
    setErro("");
    setFeito("");
    try {
      const msg = await acao();
      if (msg) setFeito(msg);
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    } finally {
      setOcupado(false);
    }
  }, [t]);
  const avisos = (
    <>
      {erro && <p role="alert" className="sp-erro">{erro}</p>}
      {feito && <p role="status" className="sp-ok">{feito}</p>}
    </>
  );
  return { ocupado, fazer, avisos };
}

function Bloco({ id, titulo, texto, children }: { id: string; titulo: string; texto?: string; children: ReactNode }) {
  return (
    <section className="sp-bloco" aria-labelledby={id} data-bloco={id}>
      <h2 id={id} className="al-cond">{titulo}</h2>
      {texto && <p className="sp-texto">{texto}</p>}
      {children}
    </section>
  );
}

const tamanhoLegivel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// ───── A chave ─────
function Chave({ t, sit, aoMudar }: { t: T; sit: Situacao; aoMudar: () => void }) {
  const [estado, setEstado] = useState<{ identidade: boolean; aqui: boolean; confere: boolean } | null>(null);
  const { ocupado, fazer, avisos } = useAcao(t);
  useEffect(() => {
    let vivo = true;
    seguranca.minhaChave(sit.chave).then((e) => vivo && setEstado(e), () => vivo && setEstado({ identidade: false, aqui: false, confere: false }));
    return () => {
      vivo = false;
    };
  }, [sit.chave]);
  const criar = (trocar: boolean) => fazer(async () => {
    if (trocar && !(await confirmar(t.chave.confirmarTrocar))) return;
    await seguranca.criarMinhaChave();
    aoMudar();
    return t.chave.criada;
  });
  const tirar = () => fazer(async () => {
    if (!(await confirmar(t.chave.confirmarTirar, { perigo: true }))) return;
    await seguranca.tirarMinhaChave();
    aoMudar();
  });
  const semIdentidade = !sit.identidade || (estado && !estado.identidade);
  return (
    <Bloco id="sp-chave" titulo={t.chave.titulo} texto={t.chave.texto}>
      {!estado ? <p className="sp-nota">{t.carregando}</p> : semIdentidade ? <p className="sp-nota">{t.chave.semIdentidade}</p> : (
        <>
          <p className="sp-nota" data-estado={sit.chave ? (estado.confere ? "pronta" : "outro") : "nenhuma"}>
            {!sit.chave ? t.chave.nenhuma : estado.confere ? t.chave.pronta : t.chave.outroAparelho}
          </p>
          <div className="sp-acoes">
            <Botao variante={sit.chave && estado.confere ? "contorno" : "primario"} disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void criar(!!sit.chave)}>
              {sit.chave ? t.chave.trocar : t.chave.criar}
            </Botao>
            {sit.chave && <Botao variante="fantasma" disabled={ocupado} onClick={() => void tirar()}>{t.chave.tirar}</Botao>}
          </div>
        </>
      )}
      {avisos}
    </Bloco>
  );
}

// ───── Item 11: o plantão ─────
function Plantao({ t, sit }: { t: T; sit: Situacao }) {
  const ids = useId();
  const [org, setOrg] = useState(sit.plantoes[0]?.handle ?? "");
  const [onde, setOnde] = useState("");
  const [ocorrido, setOcorrido] = useState<Ocorrido>("detencao");
  const [tipo, setTipo] = useState<TipoDeContato>("alumia");
  const [valor, setValor] = useState("");
  const { ocupado, fazer, avisos } = useAcao(t);
  const enviar = () => fazer(async () => {
    if (!(await confirmar(por(t.plantao.confirmar, { org })))) return;
    await seguranca.pedirPlantao(org, onde, ocorrido, { tipo, valor });
    setOnde("");
    setValor("");
    return t.plantao.enviado;
  });
  return (
    <Bloco id="sp-plantao" titulo={t.plantao.titulo} texto={t.plantao.texto}>
      {sit.plantoes.length === 0 ? <p className="sp-nota">{t.plantao.nenhuma}</p> : (
        <form className="sp-form" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
          <label className="sp-campo"><span>{t.plantao.org}</span>
            <select value={org} onChange={(e) => setOrg(e.target.value)}>
              {sit.plantoes.map((o) => <option key={o.handle} value={o.handle}>{o.nome} (@{o.handle})</option>)}
            </select>
          </label>
          <label className="sp-campo"><span>{t.plantao.onde}</span>
            <input value={onde} maxLength={200} required onChange={(e) => setOnde(e.target.value)} autoComplete="off" />
          </label>
          <label className="sp-campo"><span>{t.plantao.ocorrido}</span>
            <select value={ocorrido} onChange={(e) => setOcorrido(e.target.value as Ocorrido)}>
              {OCORRIDOS.map((o) => <option key={o} value={o}>{t.plantao.ocorridos[o]}</option>)}
            </select>
          </label>
          <fieldset className="sp-opcoes"><legend>{t.plantao.contato}</legend>
            {CONTATOS.map((c) => (
              <label key={c} className="sp-marcar"><input type="radio" name={`${ids}-contato`} value={c} checked={tipo === c} onChange={() => setTipo(c)} />{t.plantao.contatos[c]}</label>
            ))}
          </fieldset>
          <label className="sp-campo"><span>{t.plantao.valor}</span>
            <input value={valor} maxLength={120} required onChange={(e) => setValor(e.target.value)} autoComplete="off" />
          </label>
          <div className="sp-acoes"><Botao type="submit" disabled={ocupado || !onde.trim() || !valor.trim()} aria-busy={ocupado || undefined}>{t.plantao.enviar}</Botao></div>
        </form>
      )}
      {avisos}
    </Bloco>
  );
}

// ───── Item 10: o registro ─────
function Registro({ t, sit }: { t: T; sit: Situacao }) {
  const [org, setOrg] = useState(sit.plantoes[0]?.handle ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [comLocal, setComLocal] = useState(false);
  const [local, setLocal] = useState("");
  const [comContato, setComContato] = useState(false);
  const [contato, setContato] = useState("");
  const [resumo, setResumo] = useState("");
  const { ocupado, fazer, avisos } = useAcao(t);
  const enviar = () => fazer(async () => {
    if (!arquivo) return;
    if (arquivo.size > TAMANHOS.arquivo) throw new Error("grande_demais");
    if (!(await confirmar(por(t.registro.confirmar, { org })))) return;
    const video = arquivo.type.startsWith("video/");
    const r = await seguranca.registrar(org, new Uint8Array(await arquivo.arrayBuffer()), video ? "video" : "foto", arquivo.type,
      { local: comLocal ? local : undefined, contato: comContato ? contato : undefined });
    setResumo(r.resumo);
    setArquivo(null);
    return r.carimbado ? t.registro.carimbado : t.registro.semCarimbo;
  });
  return (
    <Bloco id="sp-registro" titulo={t.registro.titulo} texto={t.registro.texto}>
      {sit.plantoes.length === 0 ? <p className="sp-nota">{t.plantao.nenhuma}</p> : (
        <form className="sp-form" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
          <label className="sp-campo"><span>{t.plantao.org}</span>
            <select value={org} onChange={(e) => setOrg(e.target.value)}>
              {sit.plantoes.map((o) => <option key={o.handle} value={o.handle}>{o.nome} (@{o.handle})</option>)}
            </select>
          </label>
          <label className="sp-arquivo">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/webm,video/quicktime,video/3gpp" capture="environment"
              onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setResumo(""); }} />
            {t.registro.arquivo}
          </label>
          {arquivo && <p className="sp-nota">{por(t.registro.escolhido, { nome: arquivo.name, tamanho: tamanhoLegivel(arquivo.size) })}</p>}
          <label className="sp-marcar"><input type="checkbox" checked={comLocal} onChange={(e) => setComLocal(e.target.checked)} />{t.registro.local}</label>
          {comLocal && <label className="sp-campo"><span>{t.registro.localTexto}</span><input value={local} maxLength={200} onChange={(e) => setLocal(e.target.value)} autoComplete="off" /></label>}
          <label className="sp-marcar"><input type="checkbox" checked={comContato} onChange={(e) => setComContato(e.target.checked)} />{t.registro.contato}</label>
          {comContato && <label className="sp-campo"><span>{t.registro.contatoTexto}</span><input value={contato} maxLength={120} onChange={(e) => setContato(e.target.value)} autoComplete="off" /></label>}
          <div className="sp-acoes"><Botao type="submit" disabled={ocupado || !arquivo} aria-busy={ocupado || undefined}>{t.registro.enviar}</Botao></div>
        </form>
      )}
      {avisos}
      {resumo && <p className="sp-nota" translate="no">{por(t.registro.resumo, { resumo })}</p>}
    </Bloco>
  );
}

// ───── A caixa da assessoria ─────
function urlDe(bytes: Uint8Array, tipo: string): string {
  return URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: tipo }));
}

function AbertoNaTela({ t, lang, aberto }: { t: T; lang: string; aberto: Aberto }) {
  // Os endereços blob: do arquivo e do carimbo, só na memória desta aba; somem quando a peça sai da tela.
  const url = useMemo(() => {
    if (aberto.finalidade !== "registro") return null;
    const carimbo = aberto.ficha.carimbo ? urlDe(Uint8Array.from(atob(aberto.ficha.carimbo), (c) => c.charCodeAt(0)), "application/timestamp-reply") : null;
    return { arquivo: urlDe(aberto.arquivo, aberto.ficha.formato), carimbo };
  }, [aberto]);
  useEffect(() => () => {
    if (!url) return;
    URL.revokeObjectURL(url.arquivo);
    if (url.carimbo) URL.revokeObjectURL(url.carimbo);
  }, [url]);
  if (aberto.finalidade === "plantao") {
    const p = aberto.pedido;
    return (
      <dl className="sp-ficha">
        <dt>{t.caixa.onde}</dt><dd>{p.onde}</dd>
        <dt>{t.caixa.ocorrido}</dt><dd>{t.plantao.ocorridos[p.ocorrido]}</dd>
        <dt>{t.caixa.contato}</dt><dd>{t.plantao.contatos[p.contato.tipo]}: {p.contato.valor}</dd>
      </dl>
    );
  }
  const f = aberto.ficha;
  const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleString(lang === "pt" ? "pt-BR" : lang) : "");
  return (
    <>
      <dl className="sp-ficha">
        <dt>{t.caixa.resumo}</dt><dd translate="no">{f.resumo}</dd>
        <dt>{t.caixa.carimbo}</dt><dd>{f.carimbo ? por(t.caixa.carimboDe, { hora: hora(f.carimbo_em), servico: f.carimbo_servico ?? "" }) : por(t.caixa.semCarimbo, { hora: hora(f.feito_em) })}</dd>
        {f.local && (<><dt>{t.caixa.local}</dt><dd>{f.local}</dd></>)}
        {f.contato && (<><dt>{t.caixa.contato}</dt><dd>{f.contato}</dd></>)}
      </dl>
      {url && (f.tipo === "foto"
        // eslint-disable-next-line @next/next/no-img-element -- arquivo aberto só na memória (blob:), sem passar pelo otimizador
        ? <img className="sp-midia" src={url.arquivo} alt={t.caixa.registro} />
        : <video className="sp-midia" src={url.arquivo} controls preload="metadata" />)}
      {url && (
        <div className="sp-acoes">
          <a className="sp-link" href={url.arquivo} download={`registro-${f.resumo.slice(0, 12)}`}>{t.caixa.baixar}</a>
          {url.carimbo && <a className="sp-link" href={url.carimbo} download={`registro-${f.resumo.slice(0, 12)}.tsr`}>{t.caixa.baixarCarimbo}</a>}
        </div>
      )}
      {f.carimbo && <p className="sp-nota">{t.caixa.conferir}</p>}
    </>
  );
}

function Caixa({ t, lang, sit, aoMudar }: { t: T; lang: string; sit: Situacao; aoMudar: () => void }) {
  const [itens, setItens] = useState<ItemDaCaixa[] | null>(null);
  const [abertos, setAbertos] = useState<Record<string, Aberto>>({});
  const { ocupado, fazer, avisos } = useAcao(t);
  const carregar = useCallback(() => {
    seguranca.caixa().then(setItens, () => setItens([]));
  }, []);
  useEffect(carregar, [carregar]);
  const abrir = (id: string) => fazer(async () => {
    const a = await seguranca.abrirDaCaixa(id);
    setAbertos((x) => ({ ...x, [id]: a }));
  });
  const apagar = (id: string) => fazer(async () => {
    if (!(await confirmar(t.caixa.confirmarApagar, { perigo: true }))) return;
    await seguranca.apagarDaCaixa(id);
    carregar();
  });
  const sair = (org: string) => fazer(async () => {
    if (!(await confirmar(por(t.caixa.confirmarSair, { org })))) return;
    await seguranca.sairDaAssessoria(org);
    aoMudar();
  });
  return (
    <Bloco id="sp-caixa" titulo={t.caixa.titulo} texto={t.caixa.texto}>
      {!itens ? <p className="sp-nota">{t.carregando}</p> : itens.length === 0 ? <p className="sp-nota">{t.caixa.vazia}</p> : (
        <ul className="sp-lista">
          {itens.map((i) => (
            <li key={i.id} className="sp-item">
              <h3 className="al-cond">{i.finalidade === "plantao" ? t.caixa.plantao : t.caixa.registro}</h3>
              <p className="sp-nota">{por(t.caixa.de, { org: i.org, dia: diaNoIdioma(lang, i.dia) })}</p>
              {abertos[i.id] && <AbertoNaTela t={t} lang={lang} aberto={abertos[i.id]} />}
              <div className="sp-acoes">
                {!abertos[i.id] && <Botao variante="claro" disabled={ocupado} onClick={() => void abrir(i.id)}>{t.caixa.abrir}</Botao>}
                <Botao variante="fantasma" disabled={ocupado} onClick={() => void apagar(i.id)}>{t.caixa.apagar}</Botao>
              </div>
            </li>
          ))}
        </ul>
      )}
      {avisos}
      <div className="sp-acoes">
        {sit.assessora_de.map((o) => <Botao key={o.handle} variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => void sair(o.handle)}>{por(t.caixa.sair, { org: o.handle })}</Botao>)}
      </div>
    </Bloco>
  );
}

// ───── A gestão da organização ─────
function Gestao({ t, sit, aoMudar }: { t: T; sit: Situacao; aoMudar: () => void }) {
  return (
    <Bloco id="sp-gestao" titulo={t.gestao.titulo} texto={t.gestao.texto}>
      <ul className="sp-lista">
        {sit.gestora_de.map((o) => <OrgDaGestao key={o.handle} t={t} org={o} aoMudar={aoMudar} />)}
      </ul>
    </Bloco>
  );
}

function OrgDaGestao({ t, org, aoMudar }: { t: T; org: Situacao["gestora_de"][number]; aoMudar: () => void }) {
  const [handle, setHandle] = useState("");
  const { ocupado, fazer, avisos } = useAcao(t);
  const mudar = (ligar: boolean) => fazer(async () => {
    await seguranca.assessora(org.handle, handle, ligar);
    setHandle("");
    aoMudar();
    return t.gestao.feito;
  });
  return (
    <li className="sp-item">
      <h3 className="al-cond">{org.nome}</h3>
      <p className="sp-nota" data-pronta={org.pronta}>{por(org.pronta ? t.gestao.pronta : t.gestao.naoPronta, { org: org.handle })}</p>
      <label className="sp-campo"><span>{t.gestao.handle}</span>
        <input value={handle} maxLength={40} onChange={(e) => setHandle(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
      </label>
      <div className="sp-acoes">
        <Botao variante="claro" disabled={ocupado || !handle.trim()} onClick={() => void mudar(true)}>{t.gestao.indicar}</Botao>
        <Botao variante="fantasma" disabled={ocupado || !handle.trim()} onClick={() => void mudar(false)}>{t.gestao.tirar}</Botao>
      </div>
      {avisos}
    </li>
  );
}

// ───── Item 12: o sumiço ─────
const PRAZOS = [14, 30, 60, 90, 180, 365] as const;

function Sumico({ t, lang, sit, aoMudar }: { t: T; lang: string; sit: Situacao; aoMudar: () => void }) {
  const [dias, setDias] = useState<number>(sit.sumico?.dias ?? 30);
  const [avisar, setAvisar] = useState(true);
  const [destino, setDestino] = useState("");
  const [de, setDe] = useState("");
  const [texto, setTexto] = useState("");
  const [apagar, setApagar] = useState(false);
  const { ocupado, fazer, avisos } = useAcao(t);
  const salvar = () => fazer(async () => {
    if (apagar && !(await confirmar(t.sumico.confirmarApagar, { perigo: true }))) return;
    await seguranca.ligarSumico({ dias, apagar, destino: avisar ? destino : null, de, texto });
    setTexto("");
    aoMudar();
    return t.sumico.salvo;
  });
  const desligar = () => fazer(async () => {
    if (!(await confirmar(t.sumico.confirmarDesligar))) return;
    await seguranca.desligarSumico();
    aoMudar();
  });
  const s = sit.sumico;
  const acao = s ? [s.destino ? por(t.sumico.acaoAvisar, { destino: s.destino }) : "", s.apagar ? t.sumico.acaoApagar : ""].filter(Boolean).join(t.sumico.e) : "";
  return (
    <Bloco id="sp-sumico" titulo={t.sumico.titulo} texto={t.sumico.texto}>
      <p className="sp-nota" data-ligado={!!s}>{s ? por(t.sumico.ligado, { prazo: diaNoIdioma(lang, s.prazo), acao }) : t.sumico.desligado}</p>
      <form className="sp-form" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
        <label className="sp-campo"><span>{t.sumico.dias}</span>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {PRAZOS.map((n) => <option key={n} value={n}>{por(t.sumico.diasOpcao, { n })}</option>)}
          </select>
        </label>
        <label className="sp-marcar"><input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />{t.sumico.avisar}</label>
        {avisar && (
          <>
            <label className="sp-campo"><span>{t.sumico.destino}</span>
              <input value={destino} maxLength={40} required onChange={(e) => setDestino(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="sp-campo"><span>{t.sumico.de}</span>
              <input value={de} maxLength={60} required onChange={(e) => setDe(e.target.value)} autoComplete="off" />
            </label>
            <label className="sp-campo"><span>{t.sumico.mensagem}</span>
              <textarea value={texto} maxLength={1000} required onChange={(e) => setTexto(e.target.value)} />
            </label>
          </>
        )}
        <label className="sp-marcar"><input type="checkbox" checked={apagar} onChange={(e) => setApagar(e.target.checked)} />{t.sumico.apagar}</label>
        {apagar && <p className="sp-nota">{t.sumico.apagarAviso}</p>}
        <div className="sp-acoes">
          <Botao type="submit" disabled={ocupado || (!avisar && !apagar)} aria-busy={ocupado || undefined}>{t.sumico.salvar}</Botao>
          {s && <Botao variante="fantasma" disabled={ocupado} onClick={() => void desligar()}>{t.sumico.desligar}</Botao>}
        </div>
      </form>
      {avisos}
    </Bloco>
  );
}

function Recebidos({ t, lang }: { t: T; lang: string }) {
  const [lista, setLista] = useState<AvisoRecebido[] | null>(null);
  const { ocupado, fazer, avisos } = useAcao(t);
  const carregar = useCallback(() => {
    seguranca.recebidos().then(setLista, () => setLista([]));
  }, []);
  useEffect(carregar, [carregar]);
  if (!lista || lista.length === 0) return null;
  return (
    <Bloco id="sp-recebidos" titulo={t.recebidos.titulo} texto={t.recebidos.texto}>
      <ul className="sp-lista">
        {lista.map((r) => (
          <li key={r.id} className="sp-item">
            {r.aviso ? (
              <>
                <p className="sp-nota">{por(t.recebidos.de, { de: r.aviso.de, dia: diaNoIdioma(lang, r.dia) })}</p>
                <p className="sp-texto" style={{ whiteSpace: "pre-wrap" }}>{r.aviso.texto}</p>
              </>
            ) : <p className="sp-nota">{t.recebidos.naoAbre}</p>}
            <div className="sp-acoes">
              <Botao variante="fantasma" disabled={ocupado} onClick={() => void fazer(async () => { await seguranca.apagarRecebido(r.id); carregar(); })}>{t.recebidos.apagar}</Botao>
            </div>
          </li>
        ))}
      </ul>
      {avisos}
    </Bloco>
  );
}

export default function TelaDaSegurancaPessoal({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDaSegurancaPessoal(lang);
  const [sit, setSit] = useState<Situacao | null>(null);
  const [erro, setErro] = useState("");
  const carregar = useCallback(() => {
    seguranca.situacao().then((s) => { setSit(s); setErro(""); }, (e) => setErro(String((e as { code?: string })?.code ?? "generico")));
  }, []);
  useEffect(carregar, [carregar]);
  if (!t) return <div className="sp-pagina" aria-busy="true" />;
  return (
    <div className="sp-pagina">
      <header className="sp-cabeca">
        <h1 className="al-cond">{t.titulo}</h1>
        <p className="sp-chamada">{t.chamada}</p>
        <p className="sp-limite">{t.limite}</p>
      </header>
      {erro && <p role="alert" className="sp-erro">{textoDoErro(t.erros, erro)}</p>}
      {!sit ? (!erro && <p className="sp-nota">{t.carregando}</p>) : (
        <>
          <Plantao t={t} sit={sit} />
          <Registro t={t} sit={sit} />
          <Sumico t={t} lang={lang} sit={sit} aoMudar={carregar} />
          <Chave t={t} sit={sit} aoMudar={carregar} />
          <Recebidos t={t} lang={lang} />
          {sit.assessora_de.length > 0 && <Caixa t={t} lang={lang} sit={sit} aoMudar={carregar} />}
          {sit.gestora_de.length > 0 && <Gestao t={t} sit={sit} aoMudar={carregar} />}
        </>
      )}
    </div>
  );
}
