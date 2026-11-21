// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Captcha, useCaptcha } from "@/components/Captcha";
import type { Locale } from "@/i18n/config";
import { getClient, hasBackend } from "@/lib/backend";
import { apagarCofre, abrirCofre, type ConteudoDoCofre, fecharCofre, garantirCofre, guardarCofre } from "@/lib/rede/seguranca/cofre-de-panico";
import {
  abrirIsca, comecarFatorDaIsca, conferirCodigoDaIsca, criarIsca, fecharIsca, type IscaAberta, novaSenhaDaIsca, pedirEntradaDaIsca, povoarIsca,
  type ResultadoDaIsca,
} from "@/lib/rede/seguranca/isca";
import { raizDaAlumia } from "../entrada/Formularios";
import { Icone } from "../publicar/alumia2/icones";
import { Botao } from "../ui/Botao";
import { Ladrilhos, type T } from "./base";

type TI = T["isca"];
type Erro = keyof TI["erros"];

/** O texto de um motivo que veio da porta ou do serviço de contas. */
function erroDoMotivo(motivo: string): Erro {
  if (motivo === "captcha") return "captcha";
  if (motivo === "muitos_pedidos" || motivo === "porta_cheia" || motivo === "bloqueado") return "muitos";
  if (motivo === "cadastro_fechado") return "cadastroFechado";
  if (motivo === "codigo") return "codigo";
  return "falha";
}

/** A conta que está aberta neste navegador (id e e-mail), para comparar com a isca. Nula sem banco ou sem sessão. */
async function contaAberta(): Promise<{ id: string; email: string } | null> {
  if (!hasBackend) return null;
  try {
    const { data } = await (await getClient()).auth.getUser();
    return data.user ? { id: data.user.id, email: (data.user.email ?? "").toLowerCase() } : null;
  } catch {
    return null;
  }
}

/** O armazenamento aceita gravar? (antes de criar a conta: sem onde guardar o cofre, a isca não serviria para nada) */
function armazenamentoAceita(): boolean {
  try {
    localStorage.setItem("alumia-cofre-prova", "1");
    localStorage.removeItem("alumia-cofre-prova");
    return true;
  } catch {
    return false;
  }
}

function Campo({ id, rotulo, ajuda, erro, children }: { id: string; rotulo: string; ajuda?: string; erro?: boolean; children: React.ReactNode }) {
  return (
    <div className="sg-campo" data-erro={erro || undefined}>
      <label className="sg-rotulo" htmlFor={id}>{rotulo}</label>
      {children}
      {ajuda && <span id={`${id}-ajuda`} className="sg-cinza">{ajuda}</span>}
    </div>
  );
}

/** Ativar: a senha de pânico (duas vezes), a senha de entrar (só para comparar), o e-mail e o codinome da isca. */
function Ativar({ t, lang, aoAtivar, aoCancelar }: { t: TI; lang: string; aoAtivar: () => void; aoCancelar: () => void }) {
  const id = useId();
  const desafio = useCaptcha();
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [real, setReal] = useState("");
  const [email, setEmail] = useState("");
  const [codinome, setCodinome] = useState("");
  const [erro, setErro] = useState<Erro | "">("");
  const [ocupado, setOcupado] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  const campoDoErro: Partial<Record<Erro, string>> = { curta: "senha", diferentes: "senha2", igual: "real", semReal: "real", email: "email", emailIgual: "email", codinome: "codinome" };
  /** Mexeu num campo depois de um erro: o aviso antigo e a borda vermelha saem (a conferência volta no próximo envio). */
  const mudar = (definir: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    definir(e.target.value);
    if (erro) setErro("");
  };

  async function ativar() {
    const c = codinome.trim();
    const antes: Erro | null = [...senha].length < 8 ? "curta" : senha !== senha2 ? "diferentes" : !real ? "semReal" : real === senha ? "igual"
      : !/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email.trim()) ? "email"
      : c.length < 3 || c.length > 30 || /[@\n]|https?:|www\./i.test(c) ? "codinome" : null;
    setErro(antes ?? "");
    if (antes) {
      form.current?.querySelector<HTMLInputElement>(`#${CSS.escape(`${id}-${campoDoErro[antes] ?? "senha"}`)}`)?.focus();
      return;
    }
    setOcupado(true);
    try {
      const eu = await contaAberta();
      if (eu && eu.email === email.trim().toLowerCase()) return setErro("emailIgual");
      if (!armazenamentoAceita()) return setErro("semArmazenamento");
      // O cofre é fechado ANTES de a conta nascer: se a cifra falhar, nenhuma conta fica solta no serviço de contas.
      const conteudo: ConteudoDoCofre = { email: email.trim(), senha: novaSenhaDaIsca(), codinome: c, criada: new Date().toISOString() };
      const cofre = await fecharCofre(senha, conteudo);
      const r = await criarIsca({ email: conteudo.email, senha: conteudo.senha, codinome: c, volta: raizDaAlumia(lang), turnstile: desafio.token });
      desafio.spend();
      if (!r.ok) return setErro(erroDoMotivo(r.motivo));
      try {
        guardarCofre(cofre);
      } catch {
        return setErro("semArmazenamento");
      }
      setSenha("");
      setSenha2("");
      setReal("");
      aoAtivar();
    } catch {
      setErro("falha");
    } finally {
      setOcupado(false);
    }
  }

  const marcado = (campo: string) => (erro && campoDoErro[erro as Erro] === campo) || undefined;
  return (
    <form ref={form} className="sg-confirma sg-isca-form" noValidate onSubmit={(e) => { e.preventDefault(); void ativar(); }}>
      <p className="sg-cinza">{t.ativarTroca}</p>
      <Campo id={`${id}-senha`} rotulo={t.senha} ajuda={t.senhaAjuda} erro={marcado("senha")}>
        <input id={`${id}-senha`} className="sg-entrada" type="password" autoComplete="off" value={senha} onChange={mudar(setSenha)} aria-describedby={`${id}-senha-ajuda`} aria-invalid={marcado("senha")} />
      </Campo>
      <Campo id={`${id}-senha2`} rotulo={t.senhaDeNovo} erro={marcado("senha2")}>
        <input id={`${id}-senha2`} className="sg-entrada" type="password" autoComplete="off" value={senha2} onChange={mudar(setSenha2)} aria-invalid={marcado("senha2")} />
      </Campo>
      <Campo id={`${id}-real`} rotulo={t.real} ajuda={t.realAjuda} erro={marcado("real")}>
        <input id={`${id}-real`} className="sg-entrada" type="password" autoComplete="current-password" value={real} onChange={mudar(setReal)} aria-describedby={`${id}-real-ajuda`} aria-invalid={marcado("real")} />
      </Campo>
      <Campo id={`${id}-email`} rotulo={t.email} ajuda={t.emailAjuda} erro={marcado("email")}>
        <input id={`${id}-email`} className="sg-entrada" type="email" inputMode="email" autoComplete="off" value={email} onChange={mudar(setEmail)} aria-describedby={`${id}-email-ajuda`} aria-invalid={marcado("email")} />
      </Campo>
      <Campo id={`${id}-codinome`} rotulo={t.codinome} ajuda={t.codinomeAjuda} erro={marcado("codinome")}>
        <input id={`${id}-codinome`} className="sg-entrada" autoComplete="off" maxLength={30} value={codinome} onChange={mudar(setCodinome)} aria-describedby={`${id}-codinome-ajuda`} aria-invalid={marcado("codinome")} />
      </Campo>
      <Captcha action="conta" lang={lang as Locale} round={desafio.round} onToken={desafio.receive} onFalha={desafio.fail} />
      {erro && <p role="alert" className="sg-nota sg-nota-erro">{t.erros[erro]}</p>}
      <div className="sg-acoes">
        <Botao type="submit" variante="dourado" tamanho="m" disabled={ocupado} aria-busy={ocupado || undefined}>{ocupado ? t.criando : t.criar}</Botao>
        <Botao variante="fantasma" tamanho="m" disabled={ocupado} onClick={aoCancelar}>{t.cancelar}</Botao>
      </div>
    </form>
  );
}

/** O código de 6 números do aplicativo da isca. */
function CampoDoCodigo({ id, t, valor, mudar }: { id: string; t: TI; valor: string; mudar: (v: string) => void }) {
  return (
    <Campo id={id} rotulo={t.codigo}>
      <input id={id} className="sg-entrada sg-entrada-codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} placeholder="000000"
        value={valor} onChange={(e) => mudar(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))} />
    </Campo>
  );
}

/** Uma etapa da isca aberta: o que falta e o formulário daquela etapa. */
function Etapa({ t, isca, conteudo, aoMudar, aoRecomecar }: {
  t: TI;
  isca: IscaAberta;
  conteudo: ConteudoDoCofre;
  aoMudar: (isca: IscaAberta) => void;
  aoRecomecar: () => void;
}) {
  const id = useId();
  const [codinome, setCodinome] = useState(isca.codinome || conteudo.codinome);
  const [motivo, setMotivo] = useState("");
  const [maior, setMaior] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [pacote, setPacote] = useState<string>("");
  const [erro, setErro] = useState<Erro | "">("");
  const [ocupado, setOcupado] = useState(false);
  const pediuQr = useRef(false);
  const texto = t.etapas[isca.etapa];

  // Na etapa do aplicativo, o QR é pedido uma vez ao serviço de contas (como a isca).
  useEffect(() => {
    if (isca.etapa !== "cadastrar_fator" || isca.qr || pediuQr.current) return;
    pediuQr.current = true;
    void comecarFatorDaIsca(isca).then((r) => (r.ok ? aoMudar(r.valor) : setErro(erroDoMotivo(r.motivo))));
  }, [isca, aoMudar]);

  async function fazer(acao: () => Promise<ResultadoDaIsca<IscaAberta>>) {
    setOcupado(true);
    setErro("");
    try {
      const r = await acao();
      if (r.ok) aoMudar(r.valor);
      else setErro(erroDoMotivo(r.motivo));
    } catch {
      setErro("falha");
    } finally {
      setOcupado(false);
    }
  }

  function mandarPedido() {
    const c = codinome.trim();
    const m = motivo.trim();
    const antes: Erro | null = c.length < 3 || c.length > 30 || /[@\n]|https?:|www\./i.test(c) ? "codinome"
      : [...m].length < 10 || [...m].length > 500 || /\d{8,}/.test(m.replace(/[\s.\-()/]/g, "")) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(m) ? "motivo"
      : !maior ? "idade" : !aceite ? "aceite" : null;
    if (antes) return setErro(antes);
    void fazer(() => pedirEntradaDaIsca(c, m, isca.regras));
  }

  const botaoDeVolta = <Botao variante="contorno" tamanho="m" disabled={ocupado} onClick={aoRecomecar}>{texto.botao}</Botao>;
  let corpo: React.ReactNode = <div className="sg-acoes">{botaoDeVolta}</div>;
  if (isca.etapa === "sem_pedido") {
    corpo = (
      <form className="sg-isca-form" noValidate onSubmit={(e) => { e.preventDefault(); mandarPedido(); }}>
        <Campo id={`${id}-codinome`} rotulo={t.codinome}>
          <input id={`${id}-codinome`} className="sg-entrada" autoComplete="off" maxLength={30} value={codinome} onChange={(e) => setCodinome(e.target.value)} />
        </Campo>
        <Campo id={`${id}-motivo`} rotulo={t.motivo}>
          <textarea id={`${id}-motivo`} className="sg-entrada sg-entrada-texto" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <label className="sg-marcar sg-marcar-isca">
          <input type="checkbox" checked={maior} onChange={(e) => setMaior(e.target.checked)} />
          <span>{t.maior}</span>
        </label>
        <label className="sg-marcar sg-marcar-isca">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          <span>{t.aceite}</span>
        </label>
        <div className="sg-acoes">
          <Botao type="submit" variante="dourado" tamanho="m" disabled={ocupado} aria-busy={ocupado || undefined}>{ocupado ? t.enviando : texto.botao}</Botao>
        </div>
      </form>
    );
  } else if (isca.etapa === "cadastrar_fator" || isca.etapa === "pedir_codigo") {
    corpo = (
      <form className="sg-isca-form" noValidate onSubmit={(e) => { e.preventDefault(); if (isca.fator) void fazer(() => conferirCodigoDaIsca(isca.fator as string, codigo)); }}>
        {isca.etapa === "cadastrar_fator" && isca.qr && (
          <div className="sg-qr">
            {/* O QR vem do serviço de contas como dado embutido (data:), não como arquivo: o next/image não serve aqui. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {isca.qr.imagem ? <img src={isca.qr.imagem} alt={t.qr} width={168} height={168} /> : <span className="sg-qr-vazio" role="img" aria-label={t.qr} />}
            <p className="sg-cinza">
              {t.segredo} <code className="sg-segredo">{isca.qr.segredo}</code>
            </p>
          </div>
        )}
        <CampoDoCodigo id={`${id}-codigo`} t={t} valor={codigo} mudar={setCodigo} />
        <div className="sg-acoes">
          <Botao type="submit" variante="dourado" tamanho="m" disabled={ocupado || codigo.replace(/\D/g, "").length !== 6 || !isca.fator} aria-busy={ocupado || undefined}>{texto.botao}</Botao>
        </div>
      </form>
    );
  } else if (isca.etapa === "povoar") {
    corpo = (
      <form className="sg-isca-form" noValidate onSubmit={(e) => { e.preventDefault(); void fazer(() => povoarIsca(pacote || null)); }}>
        <fieldset className="sg-pacotes">
          <legend className="sg-rotulo">{t.pacotesTitulo}</legend>
          {[{ slug: "", titulo: t.nenhumPacote }, ...isca.pacotes].map((p) => (
            <label key={p.slug || "nenhum"} className="sg-marcar sg-marcar-isca">
              <input type="radio" name={`${id}-pacote`} value={p.slug} checked={pacote === p.slug} onChange={() => setPacote(p.slug)} />
              <span>{p.titulo}</span>
            </label>
          ))}
        </fieldset>
        <div className="sg-acoes">
          <Botao type="submit" variante="dourado" tamanho="m" disabled={ocupado} aria-busy={ocupado || undefined}>{ocupado ? t.enviando : texto.botao}</Botao>
        </div>
      </form>
    );
  }

  return (
    <div className="sg-etapa" data-etapa={isca.etapa}>
      <p className="sg-subtitulo">
        <Icone nome={isca.etapa === "pronta" ? "escudo" : isca.etapa === "recusada" || isca.etapa === "suspensa" ? "alerta" : "cadeado"} className="h-4 w-4" />
        {texto.titulo}
      </p>
      <p className="sg-cinza">{texto.texto}</p>
      {corpo}
      {erro && <p role="alert" className="sg-nota sg-nota-erro">{t.erros[erro]}</p>}
    </div>
  );
}

/**
 * Preparar: a senha de pânico abre o cofre deste aparelho, e a isca abre só na memória desta página (lib/rede/seguranca/isca.ts).
 * É também por aqui que se desativa: a tela só sabe que há senha de pânico depois que ela é digitada.
 */
function Preparar({ t, lang, aoDesativar }: { t: TI; lang: string; aoDesativar: () => void }) {
  const id = useId();
  const desafio = useCaptcha();
  const [senha, setSenha] = useState("");
  const [aberta, setAberta] = useState<{ isca: IscaAberta; conteudo: ConteudoDoCofre } | null>(null);
  const [erro, setErro] = useState<Erro | "">("");
  const [ocupado, setOcupado] = useState(false);
  const [desativando, setDesativando] = useState(false);

  // Saiu da tela: a sessão da isca (só na memória) fecha junto.
  useEffect(() => () => void fecharIsca(), []);

  async function abrir() {
    setOcupado(true);
    setErro("");
    try {
      const cofre = garantirCofre();
      const conteudo = cofre ? await abrirCofre(senha, cofre) : null;
      if (!conteudo) return setErro("errada");
      const r = await abrirIsca(conteudo, desafio.token);
      desafio.spend();
      if (!r.ok) return setErro(erroDoMotivo(r.motivo));
      setSenha("");
      setAberta({ isca: r.valor, conteudo });
    } catch {
      setErro("falha");
    } finally {
      setOcupado(false);
    }
  }

  function recomecar() {
    void fecharIsca();
    setAberta(null);
    setErro("");
  }

  if (aberta) {
    return (
      <div className="sg-confirma sg-isca-aberta">
        <p className="sg-situacao sg-fator" data-ligado>
          <Icone nome="escudo" className="h-5 w-5 shrink-0" grosso />
          <span><strong>{t.ativa}</strong> <span className="sg-cinza">{t.ativaTexto}</span></span>
        </p>
        <p className="sg-isca-quem al-cond">{aberta.isca.codinome || aberta.conteudo.codinome}</p>
        <Etapa key={aberta.isca.etapa} t={t} isca={aberta.isca} conteudo={aberta.conteudo} aoMudar={(isca) => setAberta({ ...aberta, isca })} aoRecomecar={recomecar} />
        {desativando ? (
          <div className="sg-confirma" role="group" aria-labelledby={`${id}-d`}>
            <p id={`${id}-d`}>{t.desativarTexto}</p>
            <div className="sg-acoes">
              <Botao variante="primario" tamanho="m" autoFocus onClick={() => { apagarCofre(); recomecar(); aoDesativar(); }}>{t.desativarConfirmar}</Botao>
              <Botao variante="fantasma" tamanho="m" onClick={() => setDesativando(false)}>{t.cancelar}</Botao>
            </div>
          </div>
        ) : (
          <div className="sg-acoes">
            <Botao variante="fantasma" tamanho="m" onClick={recomecar}>{t.fechar}</Botao>
            <Botao variante="contorno" tamanho="m" onClick={() => setDesativando(true)}>{t.desativar}</Botao>
          </div>
        )}
      </div>
    );
  }
  return (
    <form className="sg-confirma sg-isca-form" noValidate onSubmit={(e) => { e.preventDefault(); void abrir(); }}>
      <p className="sg-cinza">{t.prepararTexto}</p>
      <Campo id={`${id}-senha`} rotulo={t.senha} erro={erro === "errada" || undefined}>
        <input id={`${id}-senha`} className="sg-entrada" type="password" autoComplete="off" value={senha} onChange={(e) => { setSenha(e.target.value); if (erro) setErro(""); }} aria-invalid={erro === "errada" || undefined} />
      </Campo>
      <Captcha action="entrar" lang={lang as Locale} round={desafio.round} onToken={desafio.receive} onFalha={desafio.fail} />
      {erro && <p role="alert" className="sg-nota sg-nota-erro">{t.erros[erro]}</p>}
      <div className="sg-acoes">
        <Botao type="submit" variante="dourado" tamanho="m" disabled={ocupado || !senha} aria-busy={ocupado || undefined}>{ocupado ? t.abrindo : t.abrir}</Botao>
      </div>
    </form>
  );
}

/**
 * A senha de pânico (onda 11, frente 11G), nos Ajustes de segurança. Ativar cria a conta isca pela porta de entrada e guarda o
 * cofre dela, cifrado, SÓ neste aparelho (lib/rede/seguranca/cofre-de-panico.ts). Todo aparelho tem um cofre (o de quem não ativou
 * é de fachada) e nada em claro diz de que conta ele é: por isso a seção é a mesma na conta real, na isca e em quem nunca ativou.
 * Só a senha de pânico digitada em "Preparar a conta isca" abre o cofre; é ali que a pessoa prepara a isca (confirmar o e-mail, o
 * pedido de entrada, o aplicativo autenticador, o perfil neutro) e desativa.
 */
export function SenhaDePanico({ t: tudo, lang }: { t: T; lang: string }) {
  const t = tudo.isca;
  const id = useId();
  const [modo, setModo] = useState<"parado" | "ativar" | "preparar">("parado");
  const [nota, setNota] = useState("");

  // Todo aparelho que abre os Ajustes fica com um cofre (de fachada, se a pessoa não ativou).
  useEffect(() => {
    garantirCofre();
  }, []);

  return (
    <section className="sg-bloco sg-isca" aria-labelledby={`${id}-t`}>
      <div className="sg-panico-alto">
        <span className="sg-carimbo sg-carimbo-ouro al-cond">{t.carimbo}</span>
        <Ladrilhos cores={[2, 1, 2, 3, 2]} />
      </div>
      <h2 id={`${id}-t`} className="sg-titulo al-cond">{t.titulo}</h2>
      <p className="sg-texto">{t.texto}</p>
      <p className="sg-cinza sg-isca-lei">{t.servidor}</p>

      {modo === "ativar" && <Ativar t={t} lang={lang} aoCancelar={() => setModo("parado")} aoAtivar={() => { setModo("parado"); setNota(t.criada); }} />}
      {modo === "preparar" && <Preparar t={t} lang={lang} aoDesativar={() => { setModo("parado"); setNota(t.desativada); }} />}
      {modo === "parado" && (
        <div className="sg-acoes">
          <Botao variante="dourado" tamanho="m" icone={<Icone nome="cadeado" className="h-5 w-5" />} onClick={() => { setNota(""); setModo("ativar"); }}>{t.ativar}</Botao>
          <Botao variante="contorno" tamanho="m" onClick={() => { setNota(""); setModo("preparar"); }}>{t.preparar}</Botao>
        </div>
      )}
      {modo === "preparar" && (
        <div className="sg-acoes">
          <Botao variante="fantasma" tamanho="m" onClick={() => { void fecharIsca(); setModo("parado"); }}>{t.cancelar}</Botao>
        </div>
      )}
      {nota && <p role="status" className="sg-nota">{nota}</p>}
    </section>
  );
}
