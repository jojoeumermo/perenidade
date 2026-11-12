// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os formulários da entrada da Alumia: entrar (e-mail, senha com mostrar/ocultar, esqueci a senha), criar conta (codinome, e-mail,
// senha forte e confirmação, 18+, por que quer entrar, aceite das normas e da privacidade, desafio contra robôs), o pedido de quem
// já tem conta e a senha nova. Nada de "entrar com Google" nem nada que rastreie. Os rótulos ficam ligados aos campos, os erros
// são anunciados (role="alert") e apontados pelo campo (aria-describedby / aria-invalid), e o foco vai para o primeiro erro.
import { useCallback, useId, useRef, useState } from "react";
import { Captcha, captchaEnabled } from "@/components/Captcha";
import type { Locale } from "@/i18n/config";
import { BackendError, getClient, localBackend, rpc } from "@/lib/backend";
import { avaliarSenha, REGRAS_DE_SENHA } from "@/lib/forca-senha";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { senhaVazada } from "@/lib/senha";
import { liberarPonte } from "@/lib/sessao/cliente-ponte";

type T = TextosDaEntrada;
type ChaveDeErro = keyof T["erros"];

/** O endereço da Alumia neste idioma (para os links do e-mail voltarem para cá, não para o painel do site). */
export function raizDaAlumia(lang: string): string {
  const { origin, hostname } = window.location;
  if (hostname.startsWith("alumia.")) return lang === "pt" ? `${origin}/` : `${origin}/${lang}`;
  return `${origin}/${lang}/alumia`;
}

/** O código de erro do banco vira a mensagem da tela. */
export function erroDoCodigo(codigo: string): ChaveDeErro {
  const mapa: Record<string, ChaveDeErro> = {
    "invalido:codinome": "codinome",
    codinome_usado: "codinomeUsado",
    codinome_civil: "codinomeCivil",
    codinome_reservado: "codinomeReservado",
    "invalido:motivo": "motivo",
    dado_pessoal: "dadoPessoal",
    idade_minima: "idade",
    aceite_obrigatorio: "aceite",
    muitos_pedidos: "muitos",
    recusada_recente: "recusadaRecente",
  };
  return mapa[codigo] ?? "falha";
}

// O pedido escrito no "Criar conta" espera a confirmação do e-mail aqui, por no máximo um dia, e some assim que é enviado.
const PEDIDO = "lucia:alumia-pedido";
export interface PedidoGuardado {
  codinome: string;
  motivo: string;
}
export function lerPedidoGuardado(): PedidoGuardado | null {
  try {
    const p = JSON.parse(localStorage.getItem(PEDIDO) ?? "null") as (PedidoGuardado & { ate?: number }) | null;
    if (!p || typeof p.ate !== "number" || p.ate < Date.now()) {
      localStorage.removeItem(PEDIDO);
      return null;
    }
    return { codinome: String(p.codinome ?? ""), motivo: String(p.motivo ?? "") };
  } catch {
    return null;
  }
}
export function esquecerPedidoGuardado() {
  try {
    localStorage.removeItem(PEDIDO);
  } catch {
    // nada guardado
  }
}
function guardarPedido(p: PedidoGuardado) {
  try {
    localStorage.setItem(PEDIDO, JSON.stringify({ ...p, ate: Date.now() + 86_400_000 }));
  } catch {
    // sem armazenamento: a tela pede de novo depois de entrar
  }
}

export function Mensagem({ tipo, children, id }: { tipo: "erro" | "ok" | "info"; children: React.ReactNode; id?: string }) {
  return (
    <p id={id} role={tipo === "erro" ? "alert" : "status"} className={`ale-msg ale-msg-${tipo}`}>
      {children}
    </p>
  );
}

function Olho({ aberto }: { aberto: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
      {!aberto && <path d="M4 20 20 4" />}
    </svg>
  );
}

export function CampoSenha({ t, rotulo, valor, mudar, autoComplete, invalido, descrito, regras, pessoais = [] }: {
  t: T; rotulo: string; valor: string; mudar: (v: string) => void; autoComplete: string; invalido?: boolean; descrito?: string; regras?: boolean; pessoais?: string[];
}) {
  const id = useId();
  const [ver, setVer] = useState(false);
  const avaliacao = avaliarSenha(valor, pessoais);
  return (
    <div className="ale-campo">
      <label className="ale-rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <div className="ale-senha">
        <input
          id={id}
          className="ale-entrada"
          type={ver ? "text" : "password"}
          value={valor}
          onChange={(e) => mudar(e.target.value)}
          autoComplete={autoComplete}
          required
          spellCheck={false}
          autoCapitalize="off"
          aria-invalid={invalido || undefined}
          aria-describedby={[descrito, regras ? `${id}-regras` : ""].filter(Boolean).join(" ") || undefined}
        />
        <button type="button" className="ale-olho" aria-label={ver ? t.ocultar : t.mostrar} aria-pressed={ver} aria-controls={id} onClick={() => setVer((v) => !v)}>
          <Olho aberto={ver} />
        </button>
      </div>
      {regras && (
        <ul id={`${id}-regras`} className="ale-regras" aria-live="polite">
          {REGRAS_DE_SENHA.map((r) => (
            <li key={r} data-ok={avaliacao.regras[r] ? "sim" : "nao"}>
              {t.regrasSenha[r]}
              <span className="ale-sr">{avaliacao.regras[r] ? " ✓" : ""}</span>
            </li>
          ))}
          {avaliacao.aceita && <li data-ok="sim">{t.senhaAceita}</li>}
        </ul>
      )}
    </div>
  );
}

function Botao({ ocupado, rotulo, rotuloOcupado, desligado }: { ocupado: boolean; rotulo: string; rotuloOcupado: string; desligado?: boolean }) {
  return (
    <button type="submit" className="ale-botao ale-botao-principal" disabled={ocupado || desligado} aria-busy={ocupado || undefined}>
      {ocupado ? (
        <>
          <span aria-hidden className="ale-giro" /> {rotuloOcupado}
        </>
      ) : (
        rotulo
      )}
    </button>
  );
}

/** O desafio contra robôs (Turnstile, components/Captcha.tsx): cada resposta vale um pedido. */
function useDesafio() {
  const [token, setToken] = useState("");
  const [rodada, setRodada] = useState(0);
  const receber = useCallback((v: string) => setToken(v), []);
  const gastar = () => {
    setToken("");
    setRodada((r) => r + 1);
  };
  return { token, rodada, receber, gastar, esperando: captchaEnabled && !token };
}

async function bloqueado(funcao: "entrada_situacao" | "entrada_falhou", conta: string): Promise<number | null> {
  if (localBackend) return null;
  try {
    const r = await rpc<{ bloqueado: boolean; segundos?: number }>(funcao, { p_email: conta });
    return r?.bloqueado ? Math.max(1, Math.ceil((r.segundos ?? 900) / 60)) : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────── Entrar ───────────────────────────────
export function FormEntrar({ t, lang, aoEntrar }: { t: T; lang: Locale; aoEntrar: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [naoConfirmado, setNaoConfirmado] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const d = useDesafio();
  const idErro = useId();
  const emailRef = useRef<HTMLInputElement>(null);

  async function entrar() {
    setErro("");
    setAviso("");
    setNaoConfirmado(false);
    if (!email.includes("@")) {
      setErro(t.erros.email);
      emailRef.current?.focus();
      return;
    }
    setOcupado(true);
    try {
      const espera = await bloqueado("entrada_situacao", email);
      if (espera) return setErro(t.erros.bloqueado.replace("{min}", String(espera)));
      const supabase = await getClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: localBackend ? "local" : senha, options: { captchaToken: d.token || undefined } });
      if (error) {
        if (error.code === "email_not_confirmed") {
          setNaoConfirmado(true);
          return setErro(t.erros.naoConfirmado);
        }
        if (error.code === "invalid_credentials") {
          const espera2 = await bloqueado("entrada_falhou", email);
          return setErro(espera2 ? t.erros.bloqueado.replace("{min}", String(espera2)) : t.erros.credenciais);
        }
        return setErro(t.erros.falha);
      }
      void rpc("entrada_certa").catch(() => undefined);
      liberarPonte();
      setSenha("");
      aoEntrar();
    } catch {
      setErro(t.erros.falha);
    } finally {
      setOcupado(false);
      d.gastar();
    }
  }

  async function reenviar() {
    setOcupado(true);
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: raizDaAlumia(lang), captchaToken: d.token || undefined } });
      if (error) throw error;
      setErro("");
      setAviso(t.reenviado);
    } catch {
      setErro(t.erros.falha);
    } finally {
      setOcupado(false);
      d.gastar();
    }
  }

  if (esqueci) return <FormEsqueci t={t} lang={lang} emailInicial={email} voltar={() => setEsqueci(false)} />;

  return (
    <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void entrar(); }}>
      <div className="ale-campo">
        <label className="ale-rotulo" htmlFor="ale-entrar-email">{t.email}</label>
        <input ref={emailRef} id="ale-entrar-email" className="ale-entrada" type="email" inputMode="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(erro) || undefined} aria-describedby={erro ? idErro : undefined} />
      </div>
      <CampoSenha t={t} rotulo={t.senha} valor={senha} mudar={setSenha} autoComplete="current-password" invalido={Boolean(erro)} descrito={erro ? idErro : undefined} />
      <Captcha action="alumia_entrar" lang={lang} round={d.rodada} onToken={d.receber} />
      {erro && <Mensagem tipo="erro" id={idErro}>{erro}</Mensagem>}
      {aviso && <Mensagem tipo="ok">{aviso}</Mensagem>}
      {naoConfirmado && (
        <button type="button" className="ale-botao ale-botao-contorno" disabled={ocupado || d.esperando} onClick={() => void reenviar()}>
          {t.reenviar}
        </button>
      )}
      <Botao ocupado={ocupado} rotulo={t.entrarBotao} rotuloOcupado={t.entrando} desligado={d.esperando || !senha} />
      <button type="button" className="ale-link" onClick={() => setEsqueci(true)}>
        {t.esqueci}
      </button>
    </form>
  );
}

function FormEsqueci({ t, lang, emailInicial, voltar }: { t: T; lang: Locale; emailInicial: string; voltar: () => void }) {
  const [email, setEmail] = useState(emailInicial);
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "falhou" | "email">("parado");
  const d = useDesafio();
  async function enviar() {
    if (!email.includes("@")) return setEstado("email");
    setEstado("enviando");
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: raizDaAlumia(lang), captchaToken: d.token || undefined });
      // Conta inexistente volta como sucesso: a tela não diz quem tem conta.
      if (error && (error.code === "captcha_failed" || (error.status !== 400 && error.status !== 422))) throw error;
      setEstado("enviado");
    } catch {
      setEstado("falhou");
    } finally {
      d.gastar();
    }
  }
  return (
    <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      <p className="ale-cartao-texto">{t.esqueciTexto}</p>
      <div className="ale-campo">
        <label className="ale-rotulo" htmlFor="ale-esqueci-email">{t.email}</label>
        <input id="ale-esqueci-email" className="ale-entrada" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={estado === "email" || undefined} autoFocus />
      </div>
      <Captcha action="alumia_senha" lang={lang} round={d.rodada} onToken={d.receber} />
      {estado === "enviado" && <Mensagem tipo="ok">{t.linkEnviado}</Mensagem>}
      {estado === "falhou" && <Mensagem tipo="erro">{t.erros.falha}</Mensagem>}
      {estado === "email" && <Mensagem tipo="erro">{t.erros.email}</Mensagem>}
      <Botao ocupado={estado === "enviando"} rotulo={t.enviarLink} rotuloOcupado={t.enviarLink} desligado={d.esperando} />
      <button type="button" className="ale-link" onClick={voltar}>
        {t.voltarAoEntrar}
      </button>
    </form>
  );
}

// ─────────────────────────────── Os campos do pedido (criar conta e pedido de quem já tem conta) ───────────────────────────────
function CamposDoPedido({ t, lang, codinome, setCodinome, motivo, setMotivo, maior, setMaior, aceite, setAceite, erroCampo }: {
  t: T; lang: Locale; codinome: string; setCodinome: (v: string) => void; motivo: string; setMotivo: (v: string) => void;
  maior: boolean; setMaior: (v: boolean) => void; aceite: boolean; setAceite: (v: boolean) => void; erroCampo: string;
}) {
  return (
    <>
      <div className="ale-campo">
        <label className="ale-rotulo" htmlFor="ale-codinome">{t.codinome}</label>
        <input id="ale-codinome" className="ale-entrada" value={codinome} onChange={(e) => setCodinome(e.target.value)} maxLength={30} autoComplete="nickname" required aria-describedby="ale-codinome-ajuda" aria-invalid={erroCampo === "codinome" || undefined} />
        <span id="ale-codinome-ajuda" className="ale-ajuda">{t.codinomeAjuda}</span>
      </div>
      <div className="ale-campo">
        <label className="ale-rotulo" htmlFor="ale-motivo">{t.porque}</label>
        <textarea id="ale-motivo" className="ale-area" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={4} required aria-describedby="ale-motivo-ajuda ale-motivo-conta" aria-invalid={erroCampo === "motivo" || undefined} />
        <span id="ale-motivo-ajuda" className="ale-ajuda">{t.porqueAjuda}</span>
        <span id="ale-motivo-conta" className="ale-contador" aria-live="off">{[...motivo.trim()].length}/500</span>
      </div>
      <label className="ale-marcar">
        <input type="checkbox" checked={maior} onChange={(e) => setMaior(e.target.checked)} required aria-invalid={erroCampo === "idade" || undefined} />
        <span>{t.maior}</span>
      </label>
      <label className="ale-marcar">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} required aria-invalid={erroCampo === "aceite" || undefined} />
        <span>
          {t.aceite[0]}
          <a href={`/${lang}/conduta`} target="_blank" rel="noopener">{t.regras}</a>
          {t.aceite[1]}
          {t.aceite[2]}
          <a href={`/${lang}/privacidade`} target="_blank" rel="noopener">{t.privacidade}</a>
          {t.aceite[3]}
        </span>
      </label>
    </>
  );
}

/** Confere o pedido antes de mandar: a mesma regra do banco (que confere de novo). */
function conferirPedido(codinome: string, motivo: string, maior: boolean, aceite: boolean): ChaveDeErro | null {
  const c = codinome.trim();
  if (c.length < 3 || c.length > 30 || /[@\n]|https?:|www\./i.test(c)) return "codinome";
  const m = motivo.trim();
  if ([...m].length < 10 || [...m].length > 500) return "motivo";
  if (/\d{8,}/.test(m.replace(/[\s.\-()/]/g, "")) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(m)) return "dadoPessoal";
  if (!maior) return "idade";
  if (!aceite) return "aceite";
  return null;
}
const campoDoErro: Partial<Record<ChaveDeErro, string>> = { codinome: "codinome", codinomeUsado: "codinome", codinomeCivil: "codinome", codinomeReservado: "codinome", motivo: "motivo", dadoPessoal: "motivo", idade: "idade", aceite: "aceite" };
const focar = (campo: string) => document.getElementById(campo === "codinome" ? "ale-codinome" : campo === "motivo" ? "ale-motivo" : "")?.focus();

// ─────────────────────────────── Criar conta ───────────────────────────────
export function FormCriar({ t, lang, aberto }: { t: T; lang: Locale; aberto: boolean }) {
  const [codinome, setCodinome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [motivo, setMotivo] = useState("");
  const [maior, setMaior] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<ChaveDeErro | "">("");
  const [pronto, setPronto] = useState(false);
  const d = useDesafio();

  async function criar() {
    const antes = conferirPedido(codinome, motivo, maior, aceite) ?? (!email.includes("@") ? "email" : null) ?? (!avaliarSenha(senha, [codinome, email]).aceita ? "senhaFraca" : null) ?? (senha !== senha2 ? "senhasDiferentes" : null);
    setErro(antes ?? "");
    if (antes) {
      focar(campoDoErro[antes] ?? "");
      return;
    }
    setOcupado(true);
    try {
      if ((await senhaVazada(senha)) === true) return setErro("senhaVazada");
      const supabase = await getClient();
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha, options: { data: { apelido: codinome.trim() }, captchaToken: d.token || undefined, emailRedirectTo: raizDaAlumia(lang) } });
      if (error) return setErro(/convite/.test(error.message ?? "") ? "cadastroFechado" : error.code === "weak_password" ? "senhaFraca" : "falha");
      guardarPedido({ codinome: codinome.trim(), motivo: motivo.trim() });
      liberarPonte();
      setSenha("");
      setSenha2("");
      // Sem confirmação de e-mail ligada, a sessão já vem: a casca da entrada manda o pedido sozinha.
      if (!data.session) setPronto(true);
    } catch {
      setErro("falha");
    } finally {
      setOcupado(false);
      d.gastar();
    }
  }

  if (!aberto) return <Mensagem tipo="info">{t.erros.cadastroFechado}</Mensagem>;
  if (pronto) return <div className="ale-form"><Mensagem tipo="ok">{t.confirmeEmail}</Mensagem></div>;
  return (
    <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void criar(); }}>
      <CamposDoPedido t={t} lang={lang} {...{ codinome, setCodinome, motivo, setMotivo, maior, setMaior, aceite, setAceite }} erroCampo={campoDoErro[erro as ChaveDeErro] ?? ""} />
      <div className="ale-campo">
        <label className="ale-rotulo" htmlFor="ale-criar-email">{t.email}</label>
        <input id="ale-criar-email" className="ale-entrada" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={erro === "email" || undefined} />
      </div>
      <CampoSenha t={t} rotulo={t.senhaNova} valor={senha} mudar={setSenha} autoComplete="new-password" regras pessoais={[codinome, email]} invalido={erro === "senhaFraca" || erro === "senhaVazada"} />
      <CampoSenha t={t} rotulo={t.senhaDeNovo} valor={senha2} mudar={setSenha2} autoComplete="new-password" invalido={erro === "senhasDiferentes"} />
      <Captcha action="alumia_criar" lang={lang} round={d.rodada} onToken={d.receber} />
      {erro && <Mensagem tipo="erro">{t.erros[erro]}</Mensagem>}
      <Botao ocupado={ocupado} rotulo={t.criarBotao} rotuloOcupado={t.criando} desligado={d.esperando} />
    </form>
  );
}

// ─────────────────────────────── O pedido de quem já tem conta ───────────────────────────────
export function FormPedido({ t, lang, codinomeInicial, motivoInicial, versao, aoEnviar }: { t: T; lang: Locale; codinomeInicial: string; motivoInicial: string; versao: number; aoEnviar: () => void }) {
  const [codinome, setCodinome] = useState(codinomeInicial);
  const [motivo, setMotivo] = useState(motivoInicial);
  const [maior, setMaior] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<ChaveDeErro | "">("");
  async function enviar() {
    const antes = conferirPedido(codinome, motivo, maior, aceite);
    setErro(antes ?? "");
    if (antes) return focar(campoDoErro[antes] ?? "");
    setOcupado(true);
    try {
      await enviarPedido({ codinome, motivo }, versao);
      aoEnviar();
    } catch (e) {
      setErro(erroDoCodigo(e instanceof BackendError ? e.code : ""));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      <CamposDoPedido t={t} lang={lang} {...{ codinome, setCodinome, motivo, setMotivo, maior, setMaior, aceite, setAceite }} erroCampo={campoDoErro[erro as ChaveDeErro] ?? ""} />
      {erro && <Mensagem tipo="erro">{t.erros[erro]}</Mensagem>}
      <Botao ocupado={ocupado} rotulo={t.pedidoBotao} rotuloOcupado={t.criando} />
    </form>
  );
}

/** Manda o pedido ao banco (alumia_entrada_pedir). O "18+" e o aceite já foram marcados na tela. */
export async function enviarPedido(p: PedidoGuardado, versao: number) {
  await rpc("alumia_entrada_pedir", { p_codinome: p.codinome.trim(), p_motivo: p.motivo.trim(), p_maior: true, p_versao: versao, p_aceite: true });
  esquecerPedidoGuardado();
}

// ─────────────────────────────── Senha nova (link do e-mail) ───────────────────────────────
export function FormNovaSenha({ t, aoSalvar }: { t: T; aoSalvar: () => void }) {
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<ChaveDeErro | "">("");
  async function salvar() {
    const antes = !avaliarSenha(senha).aceita ? "senhaFraca" : senha !== senha2 ? "senhasDiferentes" : null;
    setErro(antes ?? "");
    if (antes) return;
    setOcupado(true);
    try {
      if ((await senhaVazada(senha)) === true) return setErro("senhaVazada");
      const supabase = await getClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) return setErro("falha");
      window.history.replaceState(null, "", window.location.pathname);
      aoSalvar();
    } catch {
      setErro("falha");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
      <CampoSenha t={t} rotulo={t.senhaNova} valor={senha} mudar={setSenha} autoComplete="new-password" regras invalido={erro === "senhaFraca"} />
      <CampoSenha t={t} rotulo={t.senhaDeNovo} valor={senha2} mudar={setSenha2} autoComplete="new-password" invalido={erro === "senhasDiferentes"} />
      {erro && <Mensagem tipo="erro">{t.erros[erro]}</Mensagem>}
      <Botao ocupado={ocupado} rotulo={t.novaSenhaSalvar} rotuloOcupado={t.novaSenhaSalvar} />
    </form>
  );
}
