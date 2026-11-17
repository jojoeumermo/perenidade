// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A identidade pública opcional (decisão da coordenação, 12/11/2026): a pessoa escolhe entre o codinome com rosto em mosaico (como
// toda conta nasce) e o nome com foto que ela mesma escreve e envia. A troca passa por uma tela curta que diz o que muda, quem
// passa a ver e como voltar; só vale com a caixa "li" marcada. Voltar ao codinome é um botão, a qualquer hora: o nome sai de todo
// lugar e a foto é apagada do servidor. Nada aqui é oferecido sem a pessoa abrir: o padrão continua sendo o codinome.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { redeIdentidade } from "@/lib/rede/cliente-identidade";
import { avisarCodinome } from "@/lib/rede/codinome-da-conta";
import { definirIdentidadeLocal } from "@/lib/rede/fotos-publicas";
import { arrumarNomePublico, fotoAceitavel, NOME_PUBLICO_MAXIMO, problemaDoNomePublico, RECORTE_INICIAL, type MinhaIdentidade, type Recorte } from "@/lib/rede/identidade";
import { dataCurta } from "@/lib/rede/org/contagem";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { codigoDoErro, textoDoErro } from "../erros";
import { Avatar16 } from "../ui/Avatar16";
import { abrirFoto, gravarFoto, type ErroDaFoto } from "./foto";
import { RecorteDaFoto } from "./Recorte";
import { useTextosDaIdentidade, type TextosDaIdentidade } from "./textos";
import "./identidade.css";

type Erros = Pick<TextosDaRede, "erros">;

function textoDoErroDaIdentidade(t: TextosDaIdentidade, s: Erros, e: unknown): string {
  const codigo = codigoDoErro(e).replace(":", "_");
  return (t.erros as Record<string, string>)[codigo] ?? textoDoErro(s, e);
}

/** O nome com que a pessoa aparece agora. */
const nomeMostrado = (eu: MinhaIdentidade): string => (eu.modo === "publica" ? eu.nome : eu.codinome) ?? "";

// ───────────────────────────── O rosto (foto ou mosaico) ─────────────────────────────

function Rosto({ foto, handle, tamanho, alt }: { foto: string | null; handle: string; tamanho: number; alt: string }) {
  if (foto && fotoAceitavel(foto)) {
    // eslint-disable-next-line @next/next/no-img-element -- data URL WebP recortada e reencodada no aparelho (sem EXIF): não passa pelo otimizador.
    return <img src={foto} alt={alt} width={tamanho} height={tamanho} decoding="async" className="ali-foto" style={{ width: tamanho, height: tamanho }} />;
  }
  return <Avatar16 handle={handle} tamanho={tamanho} className="ali-mosaico" soMosaico />;
}

// ───────────────────────────── Escolher e recortar a foto ─────────────────────────────

/**
 * O campo da foto: escolhe o arquivo, recorta e regrava aqui no aparelho. Só devolve (`aoPronta`) a data URL WebP já sem os dados
 * da câmera; quem decide o envio é quem usa o campo.
 */
function CampoDaFoto({ t, handle, foto, estado, ocupado, aoPronta, aoRemover, aoRecortar }: {
  t: TextosDaIdentidade;
  /** Avisa quando o recorte abre e fecha (a janela esconde os botões dela enquanto o recorte tem os próprios). */
  aoRecortar?: (aberto: boolean) => void;
  handle: string;
  foto: string | null;
  /** A linha de situação embaixo da foto ("esperando a mediação", "no ar"…). */
  estado: string;
  ocupado: boolean;
  aoPronta: (dados: string) => void;
  aoRemover: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [aberta, setAberta] = useState<{ bitmap: ImageBitmap; recorte: Recorte } | null>(null);
  const [erro, setErro] = useState<ErroDaFoto | null>(null);
  const idErro = useId();

  // Ao sair da tela, os pixels abertos são soltos.
  const guardada = useRef<ImageBitmap | null>(null);
  useEffect(() => {
    guardada.current = aberta?.bitmap ?? null;
  }, [aberta]);
  const recortando = Boolean(aberta);
  useEffect(() => aoRecortar?.(recortando), [recortando, aoRecortar]);
  useEffect(() => () => guardada.current?.close(), []);

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    const r = await abrirFoto(arquivo);
    if ("erro" in r) setErro(r.erro);
    else setAberta({ bitmap: r.bitmap, recorte: RECORTE_INICIAL });
  }
  function fechar() {
    aberta?.bitmap.close();
    setAberta(null);
    if (entrada.current) entrada.current.value = "";
  }
  function usar() {
    if (!aberta) return;
    const dados = gravarFoto(aberta.bitmap, aberta.recorte);
    fechar();
    if (dados) aoPronta(dados);
    else setErro("gravar");
  }

  return (
    <div className="ali-campo-foto">
      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="ali-arquivo" tabIndex={-1} aria-hidden onChange={(e) => void aoEscolher(e.target.files?.[0])} />
      {aberta ? (
        <div className="ali-recorte-caixa">
          <h4 className="al-cond ali-sub">{t.foto.recorte.titulo}</h4>
          <RecorteDaFoto bitmap={aberta.bitmap} recorte={aberta.recorte} aoMudar={(recorte) => setAberta((a) => (a ? { ...a, recorte } : a))} t={t} />
          <div className="ali-botoes">
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={fechar}>
              {t.foto.recorte.cancelar}
            </button>
            <button type="button" className="al-botao al-botao-claro al-botao-m" onClick={usar}>
              {t.foto.recorte.usar}
            </button>
          </div>
        </div>
      ) : (
        <div className="ali-foto-linha">
          <Rosto foto={foto} handle={handle} tamanho={88} alt={t.foto.alt} />
          <div className="ali-foto-lado">
            <p className="ali-miudo" role="status">
              {estado}
            </p>
            <div className="ali-botoes ali-botoes-esq">
              <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado} aria-describedby={erro ? idErro : undefined} onClick={() => entrada.current?.click()}>
                {foto ? t.foto.trocar : t.foto.escolher}
              </button>
              {foto ? (
                <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} onClick={aoRemover}>
                  {t.foto.remover}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {erro ? (
        <p id={idErro} className="ali-erro" role="alert">
          {t.foto.erros[erro]}
        </p>
      ) : null}
    </div>
  );
}

// ───────────────────────────── A tela da escolha consciente ─────────────────────────────

const PASSOS = 3;

function Ladrilhos({ passo, rotulo }: { passo: number; rotulo: string }) {
  return (
    <p className="ali-passos">
      <span aria-hidden className="ali-ladrilhos">
        {Array.from({ length: PASSOS }, (_, i) => (
          <i key={i} data-aceso={i < passo ? "" : undefined} />
        ))}
      </span>
      <span>{rotulo}</span>
    </p>
  );
}

function Ciencia({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="ali-ciencia">
      <h3 className="al-cond ali-sub">{titulo}</h3>
      {children}
    </section>
  );
}

function DialogoDaEscolha({ t, s, handle, eu, aoFechar, aoConcluir }: {
  t: TextosDaIdentidade;
  s: Erros;
  handle: string;
  eu: MinhaIdentidade;
  aoFechar: () => void;
  /** `fotoFalhou`: o nome trocou, mas a foto não foi enviada. */
  aoConcluir: (nova: MinhaIdentidade, fotoFalhou: boolean) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const [passo, setPasso] = useState(1);
  const [nome, setNome] = useState("");
  const [tocou, setTocou] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  // Enquanto o recorte da foto está aberto, os botões dele (Cancelar e Usar este recorte) são os únicos da tela.
  const [recortando, setRecortando] = useState(false);
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const idNome = useId();
  const idTitulo = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);
  // A cada passo, o foco vai para o título (o leitor de tela anuncia onde a pessoa está) e a rolagem volta ao alto.
  useEffect(() => {
    titulo.current?.focus();
    dialogo.current?.scrollTo({ top: 0 });
  }, [passo]);

  const problema = problemaDoNomePublico(nome);
  const limpo = arrumarNomePublico(nome);

  async function enviar() {
    if (enviando || problema || !ciente) return;
    setEnviando(true);
    setErro("");
    try {
      let nova = await redeIdentidade.publicar(limpo);
      let fotoFalhou = false;
      if (foto) {
        try {
          nova = await redeIdentidade.enviarFoto(foto);
        } catch {
          fotoFalhou = true;
        }
      }
      aoConcluir(nova, fotoFalhou);
    } catch (e) {
      setErro(textoDoErroDaIdentidade(t, s, e));
      setEnviando(false);
    }
  }

  const titulos = [t.ciencia.titulo, t.modos.publica.nome, t.confirmar.titulo];

  return (
    <dialog ref={dialogo} className="ali-dialogo" aria-labelledby={idTitulo} onClose={aoFechar}>
      <div aria-hidden className="ali-faixa" />
      <div className="ali-dialogo-corpo">
        <Ladrilhos passo={passo} rotulo={preencher(t.ciencia.passo, { n: passo, total: PASSOS })} />
        <h2 ref={titulo} id={idTitulo} tabIndex={-1} className="al-cond ali-titulo">
          {titulos[passo - 1]}
        </h2>

        {passo === 1 ? (
          <>
            <div className="ali-ciencias">
              <Ciencia titulo={t.ciencia.muda.titulo}>
                <ul>
                  {t.ciencia.muda.itens.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </Ciencia>
              <Ciencia titulo={t.ciencia.quem.titulo}>
                <ul>
                  {t.ciencia.quem.itens.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                  {eu.federa ? <li className="ali-destaque">{t.ciencia.quem.federa}</li> : null}
                </ul>
              </Ciencia>
              <Ciencia titulo={t.ciencia.nao.titulo}>
                <ul>
                  {t.ciencia.nao.itens.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </Ciencia>
              <Ciencia titulo={t.ciencia.volta.titulo}>
                <p>{t.ciencia.volta.texto}</p>
              </Ciencia>
            </div>
            <p className="ali-pense">{t.ciencia.pense}</p>
          </>
        ) : null}

        {passo === 2 ? (
          <>
            <label className="ali-campo" htmlFor={idNome}>
              <span>{t.nome.rotulo}</span>
              <input
                id={idNome}
                type="text"
                value={nome}
                maxLength={NOME_PUBLICO_MAXIMO}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={tocou && problema ? true : undefined}
                aria-describedby={`${idNome}-ajuda`}
                onChange={(e) => setNome(e.target.value)}
                onBlur={() => setTocou(true)}
              />
              <small id={`${idNome}-ajuda`} className={tocou && problema ? "ali-erro" : undefined}>
                {tocou && problema ? t.nome.erros[problema] : t.nome.ajuda}
              </small>
            </label>
            <div className="ali-campo">
              <span>
                {t.foto.titulo} <em className="ali-opcional">{t.foto.opcional}</em>
              </span>
              <small>{t.foto.ajuda}</small>
              <CampoDaFoto t={t} handle={handle} foto={foto} estado={foto ? t.foto.pronta : t.foto.sem} ocupado={false} aoPronta={setFoto} aoRemover={() => setFoto(null)} aoRecortar={setRecortando} />
            </div>
          </>
        ) : null}

        {passo === 3 ? (
          <>
            <p className="ali-miudo">{t.confirmar.aparece}</p>
            <div className="ali-amostra">
              <Rosto foto={foto} handle={handle} tamanho={56} alt={t.foto.alt} />
              <div className="ali-amostra-nomes">
                <strong>{limpo}</strong>
                <span>@{handle}</span>
              </div>
            </div>
            <p className="ali-miudo">{foto ? t.foto.pendente : t.foto.sem}</p>
            <label className="ali-marcar">
              <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
              <span>{t.confirmar.ciente}</span>
            </label>
            {erro ? (
              <p className="ali-erro" role="alert">
                {erro}
              </p>
            ) : null}
          </>
        ) : null}

        <div className="ali-botoes ali-botoes-rodape" hidden={passo === 2 && recortando}>
          {passo === 1 ? (
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => dialogo.current?.close()}>
              {t.ciencia.cancelar}
            </button>
          ) : (
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" disabled={enviando} onClick={() => setPasso((p) => p - 1)}>
              {t.ciencia.voltar}
            </button>
          )}
          {passo < PASSOS ? (
            <button
              type="button"
              className="al-botao al-botao-claro al-botao-m"
              onClick={() => {
                if (passo === 2 && problema) {
                  setTocou(true);
                  document.getElementById(idNome)?.focus();
                  return;
                }
                setPasso((p) => p + 1);
              }}
            >
              {t.ciencia.continuar}
            </button>
          ) : (
            <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={!ciente || enviando} onClick={() => void enviar()}>
              {enviando ? t.confirmar.enviando : t.confirmar.enviar}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

/** Um @ novo, sorteado no aparelho, para quem troca o @ junto com a volta (a pessoa pode escrever outro). */
function arrobaSorteado(): string {
  const letras = "abcdefghijkmnpqrstuvwxyz23456789";
  const n = new Uint8Array(7);
  crypto.getRandomValues(n);
  return `c_${Array.from(n, (x) => letras[x % letras.length]).join("")}`;
}

function DialogoDaVolta({ t, codinome, handle, federa, voltando, erro, aoFechar, aoVoltar }: {
  t: TextosDaIdentidade; codinome: string; handle: string; federa: boolean; voltando: boolean; erro: string; aoFechar: () => void; aoVoltar: (novoHandle: string | null) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idTexto = useId();
  const idArroba = useId();
  // Trocar o @ vem marcado (é o que desfaz a ligação entre o nome e o @), menos para quem federa: lá o @ é o endereço.
  const [trocar, setTrocar] = useState(!federa);
  const [novo, setNovo] = useState(() => arrobaSorteado());
  const arrobaOk = /^[a-z0-9_]{3,20}$/.test(novo);
  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={dialogo} className="ali-dialogo ali-dialogo-curto" aria-labelledby={idTitulo} aria-describedby={idTexto} onClose={aoFechar}>
      <div aria-hidden className="ali-faixa" />
      <div className="ali-dialogo-corpo">
        <h2 id={idTitulo} className="al-cond ali-titulo">
          {t.publica.confirmarVolta.titulo}
        </h2>
        <p id={idTexto}>{preencher(t.publica.confirmarVolta.texto, { codinome })}</p>
        {federa ? (
          <p className="ali-miudo">{preencher(t.publica.confirmarVolta.arrobaFederado, { handle })}</p>
        ) : (
          <div className="ali-arroba">
            <label className="ali-marca">
              <input type="checkbox" checked={trocar} onChange={(e) => setTrocar(e.target.checked)} />
              <span>
                <strong>{t.publica.confirmarVolta.arroba}</strong>
                <small>{preencher(t.publica.confirmarVolta.arrobaAjuda, { handle })}</small>
              </span>
            </label>
            {trocar ? (
              <label className="ali-arroba-campo" htmlFor={idArroba}>
                <span>{t.publica.confirmarVolta.arrobaRotulo}</span>
                <span className="ali-arroba-entrada">
                  <span aria-hidden>@</span>
                  <input id={idArroba} value={novo} maxLength={20} spellCheck={false} autoCapitalize="off" autoComplete="off" aria-invalid={!arrobaOk || undefined} onChange={(e) => setNovo(e.target.value.toLowerCase().replace(/^@+/, "").replace(/\s/g, ""))} />
                </span>
              </label>
            ) : null}
          </div>
        )}
        {erro ? (
          <p className="ali-erro" role="alert">
            {erro}
          </p>
        ) : null}
        <div className="ali-botoes ali-botoes-rodape">
          <button type="button" className="al-botao al-botao-fantasma al-botao-m" autoFocus disabled={voltando} onClick={() => dialogo.current?.close()}>
            {t.publica.confirmarVolta.nao}
          </button>
          <button type="button" className="al-botao al-botao-claro al-botao-m" disabled={voltando || (!federa && trocar && !arrobaOk)} onClick={() => aoVoltar(!federa && trocar ? novo : null)}>
            {voltando ? t.publica.confirmarVolta.voltando : t.publica.confirmarVolta.sim}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ───────────────────────────── O painel ─────────────────────────────

export interface PropsDoPainelDeIdentidade {
  lang: string;
  handle: string;
  s: Erros;
  /** A identidade mudou (ou acabou de ser lida): quem hospeda o painel acerta o nome mostrado. */
  aoMudar?: (eu: MinhaIdentidade, mudou: boolean) => void;
  /** Abre a tela da escolha assim que carregar (a pessoa pediu isso no cadastro e confirmou no lembrete). */
  abrirJa?: boolean;
}

export function PainelDeIdentidade({ lang, handle, s, aoMudar, abrirJa = false }: PropsDoPainelDeIdentidade) {
  const t = useTextosDaIdentidade(lang);
  const [eu, setEu] = useState<MinhaIdentidade | null>(null);
  const [falha, setFalha] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [confirmandoVolta, setConfirmandoVolta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erroDaVolta, setErroDaVolta] = useState("");
  const [nomeNovo, setNomeNovo] = useState<string | null>(null);
  const abriu = useRef(false);
  const idNome = useId();
  const avisarQuemHospeda = useRef(aoMudar);
  useEffect(() => {
    avisarQuemHospeda.current = aoMudar;
  }, [aoMudar]);

  const aplicar = useCallback(
    (nova: MinhaIdentidade, mudou: boolean) => {
      setEu(nova);
      // As telas abertas (cartão da conta, prévia do perfil, posts) trocam o rosto e o nome na hora.
      definirIdentidadeLocal(handle, nova.modo === "publica", nova.foto?.dados ?? null);
      if (mudou && nomeMostrado(nova)) avisarCodinome(nomeMostrado(nova));
      avisarQuemHospeda.current?.(nova, mudou);
    },
    [handle],
  );

  useEffect(() => {
    let vivo = true;
    redeIdentidade
      .minha()
      .then((lida) => {
        if (!vivo) return;
        aplicar(lida, false);
        if (abrirJa && !abriu.current && lida.disponivel && lida.modo === "codinome") {
          abriu.current = true;
          setEscolhendo(true);
        }
      })
      .catch(() => vivo && setFalha(true));
    return () => {
      vivo = false;
    };
  }, [aplicar, abrirJa]);

  if (!t) return null;
  if (falha) return null;
  if (!eu) {
    return (
      <div className="pfe-bloco ali" aria-busy>
        <p className="ali-miudo">{t.carregando}</p>
      </div>
    );
  }

  const publica = eu.modo === "publica";
  const codinome = eu.codinome ?? "";

  async function com(tarefa: () => Promise<MinhaIdentidade>, certo: (nova: MinhaIdentidade) => string, mudouNome: boolean) {
    if (ocupado) return;
    setOcupado(true);
    setAviso(null);
    try {
      const nova = await tarefa();
      aplicar(nova, mudouNome);
      setAviso({ texto: certo(nova), erro: false });
    } catch (e) {
      setAviso({ texto: textoDoErroDaIdentidade(t!, s, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function voltar(novoHandle: string | null) {
    if (ocupado) return;
    setOcupado(true);
    setErroDaVolta("");
    try {
      const nova = await redeIdentidade.voltar(novoHandle);
      aplicar(nova, true);
      setConfirmandoVolta(false);
      setNomeNovo(null);
      const texto = novoHandle && nova.handle ? t!.avisos.trocouArroba : nova.codinome_trocado ? t!.avisos.voltouTrocado : t!.avisos.voltou;
      setAviso({ texto: preencher(texto, { codinome: nova.codinome ?? "", handle: nova.handle ?? "" }), erro: false });
      // O @ mudou: a página inteira (o perfil, os links com o @) é refeita com o @ novo, depois de a pessoa ler o aviso.
      if (novoHandle && nova.handle && nova.handle !== handle) window.setTimeout(() => window.location.reload(), 2500);
    } catch (e) {
      setErroDaVolta(textoDoErroDaIdentidade(t!, s, e));
    } finally {
      setOcupado(false);
    }
  }

  const problemaDoNovo = nomeNovo === null ? null : problemaDoNomePublico(nomeNovo);

  return (
    <div className="pfe-bloco ali" id="identidade">
      <h3 className="pfe-titulo">{t.titulo}</h3>
      <p className="pfe-ajuda">{t.ajuda}</p>

      <ul className="ali-modos">
        <li className="ali-modo" data-atual={!publica ? "" : undefined}>
          <Avatar16 handle={handle} tamanho={44} className="ali-mosaico" soMosaico />
          <div>
            <p className="ali-modo-nome">
              <strong className="al-cond">{t.modos.codinome.nome}</strong>
              <span className="ali-etiqueta">{t.padrao}</span>
            </p>
            <p className="ali-miudo">{t.modos.codinome.descricao}</p>
          </div>
          {!publica ? <span className="al-carimbo al-cond al-carimbo-p ali-carimbo">{t.atual}</span> : null}
        </li>
        <li className="ali-modo" data-atual={publica ? "" : undefined}>
          {publica ? (
            <Rosto foto={eu.foto?.dados ?? null} handle={handle} tamanho={44} alt={t.foto.alt} />
          ) : (
            <span aria-hidden className="ali-silhueta">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                <circle cx="12" cy="8.5" r="4" />
                <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
              </svg>
            </span>
          )}
          <div>
            <p className="ali-modo-nome">
              <strong className="al-cond">{t.modos.publica.nome}</strong>
            </p>
            <p className="ali-miudo">{t.modos.publica.descricao}</p>
          </div>
          {publica ? <span className="al-carimbo al-cond al-carimbo-p ali-carimbo">{t.atual}</span> : null}
        </li>
      </ul>

      {!publica ? (
        eu.disponivel ? (
          <div className="ali-botoes ali-botoes-esq">
            <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => setEscolhendo(true)}>
              {t.escolher}
            </button>
          </div>
        ) : (
          <p className="ali-miudo ali-nota">{t.indisponivel}</p>
        )
      ) : (
        <div className="ali-publica">
          <div className="ali-publica-nome">
            {nomeNovo === null ? (
              <>
                <p className="ali-nome-atual">
                  <strong>{eu.nome}</strong>
                  <span>@{handle}</span>
                </p>
                <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} onClick={() => setNomeNovo(eu.nome ?? "")}>
                  {t.publica.trocarNome}
                </button>
              </>
            ) : (
              <form
                className="ali-form-nome"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (problemaDoNovo) return;
                  const limpo = arrumarNomePublico(nomeNovo);
                  if (limpo === eu.nome) return setNomeNovo(null);
                  void com(() => redeIdentidade.publicar(limpo), () => t.avisos.nomeSalvo, true).then(() => setNomeNovo(null));
                }}
              >
                <label className="ali-campo" htmlFor={idNome}>
                  <span>{t.nome.rotulo}</span>
                  <input id={idNome} type="text" value={nomeNovo} maxLength={NOME_PUBLICO_MAXIMO} autoComplete="off" spellCheck={false} autoFocus aria-invalid={problemaDoNovo ? true : undefined} aria-describedby={`${idNome}-ajuda`} onChange={(e) => setNomeNovo(e.target.value)} />
                  <small id={`${idNome}-ajuda`} className={problemaDoNovo ? "ali-erro" : undefined}>
                    {problemaDoNovo ? t.nome.erros[problemaDoNovo] : t.nome.ajuda}
                  </small>
                </label>
                <div className="ali-botoes ali-botoes-esq">
                  <button type="submit" className="al-botao al-botao-claro al-botao-p" disabled={ocupado || Boolean(problemaDoNovo)}>
                    {t.publica.salvarNome}
                  </button>
                  <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} onClick={() => setNomeNovo(null)}>
                    {t.publica.cancelar}
                  </button>
                </div>
              </form>
            )}
          </div>
          {eu.desde ? <p className="ali-miudo">{preencher(t.publica.desde, { data: dataCurta(eu.desde, lang) })}</p> : null}

          <div className="ali-campo">
            <span>
              {t.foto.titulo} <em className="ali-opcional">{t.foto.opcional}</em>
            </span>
            <small>{t.foto.ajuda}</small>
            <CampoDaFoto
              t={t}
              handle={handle}
              foto={eu.foto?.dados ?? null}
              estado={eu.foto ? (eu.foto.pendente ? t.foto.pendente : t.foto.aceita) : t.foto.sem}
              ocupado={ocupado || !eu.disponivel}
              aoPronta={(dados) => void com(() => redeIdentidade.enviarFoto(dados), (nova) => (nova.foto?.pendente === false ? t.avisos.fotoNoAr : t.avisos.fotoEnviada), false)}
              aoRemover={() => void com(() => redeIdentidade.removerFoto(), () => t.avisos.fotoApagada, false)}
            />
          </div>

          <div className="ali-volta">
            <p className="ali-miudo">{preencher(t.publica.voltarAjuda, { codinome })}</p>
            <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={ocupado} onClick={() => setConfirmandoVolta(true)}>
              {t.publica.voltar}
            </button>
          </div>
        </div>
      )}

      <p className={aviso?.erro ? "ali-erro" : "ali-ok"} role="status" aria-live="polite">
        {aviso?.texto ?? ""}
      </p>

      {escolhendo ? (
        <DialogoDaEscolha
          t={t}
          s={s}
          handle={handle}
          eu={eu}
          aoFechar={() => setEscolhendo(false)}
          aoConcluir={(nova, fotoFalhou) => {
            setEscolhendo(false);
            aplicar(nova, true);
            setAviso({ texto: fotoFalhou ? t.avisos.fotoFalhou : preencher(t.avisos.virouPublica, { nome: nova.nome ?? "" }), erro: fotoFalhou });
          }}
        />
      ) : null}
      {confirmandoVolta ? (
        <DialogoDaVolta t={t} codinome={codinome} handle={handle} federa={Boolean(eu?.federa)} voltando={ocupado} erro={erroDaVolta} aoFechar={() => setConfirmandoVolta(false)} aoVoltar={(h) => void voltar(h)} />
      ) : null}
    </div>
  );
}
