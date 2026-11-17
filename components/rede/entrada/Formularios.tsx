// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os formulários da entrada da Alumia: entrar (e-mail, senha com mostrar/ocultar, esqueci a senha), criar conta em dois passos
// (a conta: e-mail, senha forte e confirmação; o pedido: codinome, o rosto na rede, 18+, por que quer entrar, aceite das normas e
// da privacidade, a prova contra robôs feita no aparelho e, quando ligado, o desafio da Cloudflare), o pedido de quem já tem conta e a senha nova. O que a pessoa escreve no codinome (e a
// foto, se ela escolher uma) acende o painel dela na parede: só neste aparelho (components/rede/entrada/Voce.tsx). Nada de "entrar com Google" nem nada que rastreie. Os rótulos ficam ligados aos campos, os erros
// são anunciados (role="alert") e apontados pelo campo (aria-describedby / aria-invalid), e o foco vai para o primeiro erro.
import { useEffect, useId, useRef, useState } from "react";
import { Captcha, useCaptcha } from "@/components/Captcha";
import type { Locale } from "@/i18n/config";
import { BackendError, getClient, localBackend, rpc } from "@/lib/backend";
import { registrarRede } from "@/lib/rede/painel/cliente-rede";
import { avaliarSenha, REGRAS_DE_SENHA } from "@/lib/forca-senha";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { senhaVazada } from "@/lib/senha";
import { liberarPonte } from "@/lib/sessao/cliente-ponte";
import { lerFoto, RostoDoCodinome, useVoce } from "./Voce";
import { redeIdentidade } from "@/lib/rede/cliente-identidade";
import { CHAVE_DA_INTENCAO } from "@/lib/rede/identidade";
import { guardarIntencao } from "../identidade/Lembrete";
import { useTextosDaIdentidade } from "../identidade/textos";
// A porta de entrada (onda 8, frente 8D) pendura aqui pelo encaixe dela: a prova no aparelho no lugar do desafio de terceiros, no
// criar conta, no pedido e (onda 9) no entrar, no reenviar a confirmação e no esqueci a senha.
import { antesDoPedido, avisoPelaPorta, entrarPelaPorta, type EstadoDaProva, ProvaDoAparelho, useProvaDaPorta } from "../convites/encaixe-da-entrada";
// O questionário de interesses (onda 11, 11F): entre o pedido e o envio, opcional, e as respostas ficam só neste aparelho.
import { ligado } from "@/lib/recursos";
import { guardarInteresses, lerInteresses } from "@/lib/rede/interesses";
import { Questionario } from "../interesses/Questionario";
import { useTextosDosInteresses } from "../interesses/textos";
// A senha de pânico (onda 11, frente 11G) pendura aqui pelo encaixe dela: digitada no entrar, a conta isca entra no lugar da real.
import { trocaDePanico } from "../seguranca/encaixe-da-entrada";

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
      <svg aria-hidden viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {tipo === "erro" ? (
          <>
            <path d="M12 3 2.5 20h19L12 3Z" />
            <path d="M12 10v4.5M12 17.5v.5" />
          </>
        ) : tipo === "ok" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12.5 3 3 5-6" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7.5v.5" />
          </>
        )}
      </svg>
      <span>{children}</span>
    </p>
  );
}

/** O caminho da entrada: os 4 passos de verdade (conta, pedido, triagem, segundo fator), com o de agora marcado. */
export function Caminho({ t, agora }: { t: T; agora: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="ale-caminho" aria-label={t.p.caminhoRotulo}>
      {t.p.caminho.map((nome, i) => (
        <li key={nome} data-e={i < agora ? "feito" : i === agora ? "agora" : "falta"} aria-current={i === agora ? "step" : undefined}>
          {nome}
        </li>
      ))}
    </ol>
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
          {/* O desenho é a ação: olho aberto para mostrar a senha escondida; riscado para esconder a que está à vista. */}
          <Olho aberto={!ver} />
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
        </ul>
      )}
      {regras && avaliacao.aceita && (
        <p className="ale-senha-estado" role="status">
          {t.senhaAceita}
        </p>
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
  // O desafio da Cloudflare (Turnstile), quando ligado: a resposta vai junto e o servidor confere; cada uma vale um pedido.
  const desafio = useCaptcha();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  // Qual campo o erro aponta: só ele fica marcado (e-mail torto não pinta a senha de vermelho).
  const [campoErrado, setCampoErrado] = useState<"email" | "senha" | "ambos" | "">("");
  const [aviso, setAviso] = useState("");
  const [naoConfirmado, setNaoConfirmado] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const [prova, setProva] = useState<EstadoDaProva>({ f: "parada" });
  const idErro = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function entrar() {
    setErro("");
    setCampoErrado("");
    setAviso("");
    setNaoConfirmado(false);
    if (!email.includes("@")) {
      setErro(t.erros.email);
      setCampoErrado("email");
      emailRef.current?.focus();
      return;
    }
    if (!senha) {
      setErro(t.erros.senhaVazia);
      setCampoErrado("senha");
      formRef.current?.querySelector<HTMLInputElement>("input[autocomplete=current-password]")?.focus();
      return;
    }
    setOcupado(true);
    setProva({ f: "parada" });
    try {
      // A senha de pânico deste aparelho? Então quem entra é a conta isca, pelo mesmo caminho e com as mesmas telas.
      const conta = (await trocaDePanico(senha)) ?? { email, senha };
      const espera = await bloqueado("entrada_situacao", conta.email);
      if (espera) return setErro(t.erros.bloqueado.replace("{min}", String(espera)));
      const supabase = await getClient();
      // Pelo servidor do site (a prova no aparelho, o freio, e a sessão pedida com a chave de serviço); a cópia local de testes
      // (scripts/backend-local.mjs) não tem as rotas da porta e entra direto.
      let codigo = "";
      if (localBackend) {
        const { error } = await supabase.auth.signInWithPassword({ email: conta.email, password: "local" });
        codigo = error ? (error.code === "email_not_confirmed" ? "nao_confirmado" : error.code === "invalid_credentials" ? "credenciais" : "falha") : "";
      } else {
        setProva({ f: "fazendo", demorando: false });
        const r = await entrarPelaPorta({ email: conta.email, senha: conta.senha, turnstile: desafio.token });
        desafio.spend();
        if (!r.ok && r.motivo === "bloqueado") {
          setProva({ f: "parada" });
          return setErro(t.erros.bloqueado.replace("{min}", String(r.minutos ?? 15)));
        }
        if (r.ok) {
          const { error } = await supabase.auth.setSession(r.sessao);
          codigo = error ? "falha" : "";
        } else codigo = r.motivo;
        setProva(r.ok || r.motivo === "credenciais" || r.motivo === "nao_confirmado" ? { f: "parada" } : { f: "erro", motivo: r.motivo === "bloqueado" ? "falha" : r.motivo });
      }
      if (codigo) {
        if (codigo === "nao_confirmado") {
          setNaoConfirmado(true);
          return setErro(t.erros.naoConfirmado);
        }
        if (codigo === "credenciais") {
          const espera2 = await bloqueado("entrada_falhou", conta.email);
          if (!espera2) setCampoErrado("ambos");
          return setErro(espera2 ? t.erros.bloqueado.replace("{min}", String(espera2)) : t.erros.credenciais);
        }
        // O motivo da porta (rede barrada, muitos pedidos...) já aparece na linha da prova.
        if (codigo === "falha") setErro(t.erros.falha);
        return;
      }
      void rpc("entrada_certa").catch(() => undefined);
      liberarPonte();
      setSenha("");
      aoEntrar();
    } catch {
      setProva({ f: "parada" });
      setErro(t.erros.falha);
    } finally {
      setOcupado(false);
    }
  }

  async function reenviar() {
    setOcupado(true);
    try {
      if (localBackend) {
        const { error } = await (await getClient()).auth.resend({ type: "signup", email, options: { emailRedirectTo: raizDaAlumia(lang) } });
        if (error) throw error;
      } else {
        setProva({ f: "fazendo", demorando: false });
        const r = await avisoPelaPorta({ tipo: "confirmacao", email, volta: raizDaAlumia(lang), turnstile: desafio.token });
        desafio.spend();
        setProva(r.ok ? { f: "parada" } : { f: "erro", motivo: r.motivo });
        if (!r.ok) {
          setErro("");
          return;
        }
      }
      setErro("");
      setAviso(t.reenviado);
    } catch {
      setProva({ f: "parada" });
      setErro(t.erros.falha);
    } finally {
      setOcupado(false);
    }
  }

  if (esqueci) return <FormEsqueci t={t} lang={lang} emailInicial={email} voltar={() => setEsqueci(false)} />;

  return (
    <form ref={formRef} className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void entrar(); }}>
      <div className="ale-campo">
        <label className="ale-rotulo" htmlFor="ale-entrar-email">{t.email}</label>
        <input ref={emailRef} id="ale-entrar-email" className="ale-entrada" type="email" inputMode="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={campoErrado === "email" || campoErrado === "ambos" || undefined} aria-describedby={erro && (campoErrado === "email" || campoErrado === "ambos") ? idErro : undefined} />
      </div>
      <CampoSenha t={t} rotulo={t.senha} valor={senha} mudar={setSenha} autoComplete="current-password" invalido={campoErrado === "senha" || campoErrado === "ambos"} descrito={erro && (campoErrado === "senha" || campoErrado === "ambos") ? idErro : undefined} />
      <Captcha action="entrar" lang={lang} round={desafio.round} onToken={desafio.receive} />
      <ProvaDoAparelho lang={lang} estado={prova} momento="entrar" />
      {erro && <Mensagem tipo="erro" id={idErro}>{erro}</Mensagem>}
      {aviso && <Mensagem tipo="ok">{aviso}</Mensagem>}
      {naoConfirmado && (
        <button type="button" className="ale-botao ale-botao-contorno" disabled={ocupado} onClick={() => void reenviar()}>
          {t.reenviar}
        </button>
      )}
      {/* Sempre ativo (e na ordem do Tab): o que falta é dito no envio, no campo certo. */}
      <Botao ocupado={ocupado} rotulo={t.entrarBotao} rotuloOcupado={t.entrando} />
      <button type="button" className="ale-link" onClick={() => setEsqueci(true)}>
        {t.esqueci}
      </button>
      <p className="ale-ajuda">{t.p.escola}</p>
    </form>
  );
}

function FormEsqueci({ t, lang, emailInicial, voltar }: { t: T; lang: Locale; emailInicial: string; voltar: () => void }) {
  const [email, setEmail] = useState(emailInicial);
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "falhou" | "email">("parado");
  const [prova, setProva] = useState<EstadoDaProva>({ f: "parada" });
  const desafio = useCaptcha();
  async function enviar() {
    if (!email.includes("@")) return setEstado("email");
    setEstado("enviando");
    try {
      if (localBackend) {
        const { error } = await (await getClient()).auth.resetPasswordForEmail(email.trim(), { redirectTo: raizDaAlumia(lang) });
        if (error && error.status !== 400 && error.status !== 422) throw error;
        return setEstado("enviado");
      }
      // Pelo servidor do site, com a prova no aparelho. Conta inexistente volta como sucesso: a tela não diz quem tem conta.
      setProva({ f: "fazendo", demorando: false });
      const r = await avisoPelaPorta({ tipo: "senha", email: email.trim(), volta: raizDaAlumia(lang), turnstile: desafio.token });
      desafio.spend();
      setProva(r.ok ? { f: "parada" } : { f: "erro", motivo: r.motivo });
      setEstado(r.ok ? "enviado" : "parado");
    } catch {
      setProva({ f: "parada" });
      setEstado("falhou");
    }
  }
  return (
    <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      <p className="ale-cartao-texto">{t.esqueciTexto}</p>
      <div className="ale-campo">
        <label className="ale-rotulo" htmlFor="ale-esqueci-email">{t.email}</label>
        <input id="ale-esqueci-email" className="ale-entrada" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={estado === "email" || undefined} autoFocus />
      </div>
      <Captcha action="aviso" lang={lang} round={desafio.round} onToken={desafio.receive} />
      <ProvaDoAparelho lang={lang} estado={prova} momento="aviso" />
      {estado === "enviado" && <Mensagem tipo="ok">{t.linkEnviado}</Mensagem>}
      {estado === "falhou" && <Mensagem tipo="erro">{t.erros.falha}</Mensagem>}
      {estado === "email" && <Mensagem tipo="erro">{t.erros.email}</Mensagem>}
      <Botao ocupado={estado === "enviando"} rotulo={t.enviarLink} rotuloOcupado={t.enviarLink} />
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
  const { definirCodinome } = useVoce();
  // O codinome do campo acende o painel da pessoa na parede (só neste aparelho; nada é enviado por causa disso).
  useEffect(() => definirCodinome(codinome), [codinome, definirCodinome]);
  return (
    <>
      <div className="ale-campo">
        <label className="ale-rotulo" htmlFor="ale-codinome">{t.codinome}</label>
        <input id="ale-codinome" className="ale-entrada" value={codinome} onChange={(e) => setCodinome(e.target.value)} maxLength={30} autoComplete="nickname" autoCapitalize="off" spellCheck={false} required aria-describedby="ale-codinome-ajuda" aria-invalid={erroCampo === "codinome" || undefined} />
        <span id="ale-codinome-ajuda" className="ale-ajuda">{t.codinomeAjuda}</span>
      </div>
      {/* Uma pergunta só: como a pessoa quer aparecer. Codinome e mosaico (o padrão) ou, com a escolha aberta no banco, nome e
          foto; a foto só aparece para quem escolhe "nome e foto". Nada daqui vai ao servidor no cadastro. */}
      <ComoAparecer t={t} lang={lang} codinome={codinome} />
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
          <a href={`/${lang}/alumia/regras`} target="_blank" rel="noopener">{t.regras}</a>
          {t.aceite[1]}
          <a href={`/${lang}/alumia/termos`} target="_blank" rel="noopener">{t.termos}</a>
          {t.aceite[2]}
          <a href={`/${lang}/alumia/privacidade`} target="_blank" rel="noopener">{t.privacidade}</a>
          {t.aceite[3]}
        </span>
      </label>
    </>
  );
}

/**
 * Como a pessoa quer aparecer: UMA pergunta, que diz o que muda. O rosto em mosaico nasce do codinome (o padrão, protegido). Com a
 * identidade pública aberta no banco, há a segunda opção, nome e foto: só ela mostra o botão da foto. A resposta e a foto ficam
 * neste aparelho (a foto só desenha o painel da pessoa na parede; não é enviada com o pedido): toda conta entra com codinome,
 * porque quem analisa o pedido só vê o codinome, e a troca de verdade é feita depois, no perfil, numa tela que mostra o que muda.
 */
function ComoAparecer({ t, lang, codinome }: { t: T; lang: Locale; codinome: string }) {
  const ti = useTextosDaIdentidade(lang);
  const { foto, definirFoto } = useVoce();
  const [aberta, setAberta] = useState(false);
  const [publica, setPublica] = useState(false);
  const [erro, setErro] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const nome = useId();
  useEffect(() => {
    let vivo = true;
    redeIdentidade.aberta().then((sim) => {
      if (!vivo) return;
      setAberta(sim);
      // Quem já marcou neste aparelho (voltou ao formulário) reencontra a marca.
      try {
        if (sim) setPublica(window.localStorage.getItem(CHAVE_DA_INTENCAO) === "1");
      } catch {
        // sem armazenamento: fica o codinome
      }
    });
    return () => {
      vivo = false;
    };
  }, []);
  const escolher = (v: boolean) => {
    setPublica(v);
    guardarIntencao(v);
    if (!v) {
      setErro(false);
      definirFoto(null);
    }
  };
  async function lerArquivo(f: File | undefined) {
    if (!f) return;
    try {
      definirFoto(await lerFoto(f));
      setErro(false);
    } catch {
      setErro(true);
    }
  }
  const comFoto = aberta && publica;
  return (
    <fieldset className="ale-rosto">
      <legend>{aberta && ti ? ti.cadastro.titulo : t.p.rosto.titulo}</legend>
      <div className="ale-rosto-linha">
        <RostoDoCodinome codinome={codinome} foto={comFoto ? foto : null} />
        <p>
          <b>{codinome.trim() || t.codinome}</b>
          {!codinome.trim() ? t.p.rosto.semCodinome : comFoto && foto ? t.p.voceFoto : t.p.voce.replace("{codinome}", codinome.trim())}
        </p>
      </div>
      {aberta && ti && (
        <div className="ale-rosto-escolhas">
          <label className="ale-rosto-escolha">
            <input type="radio" name={nome} checked={!publica} onChange={() => escolher(false)} />
            <b>
              {ti.cadastro.codinome} <em className="ale-rosto-padrao">{ti.padrao}</em>
            </b>
            {ti.cadastro.codinomeAjuda}
          </label>
          <label className="ale-rosto-escolha">
            <input type="radio" name={nome} checked={publica} onChange={() => escolher(true)} />
            <b>{ti.cadastro.publica}</b>
            {ti.cadastro.publicaAjuda}
          </label>
        </div>
      )}
      {comFoto && (
        <>
          <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void lerArquivo(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className="ale-botao ale-botao-contorno" onClick={() => arquivo.current?.click()}>
            {foto ? t.p.rosto.trocar : t.p.rosto.escolher}
          </button>
          {erro && <Mensagem tipo="erro">{t.p.rosto.erro}</Mensagem>}
          <p className="ale-ajuda">{t.p.rosto.nota}</p>
        </>
      )}
      {aberta && ti && <p className="ale-ajuda">{ti.cadastro.nota}</p>}
    </fieldset>
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
/** O questionário de interesses no cadastro só existe com a linha Em roda, que é o que ele muda. */
const COM_INTERESSES = ligado("alumia-linha-aberta");

export function FormCriar({ t, lang, aberto }: { t: T; lang: Locale; aberto: boolean }) {
  const [passo, setPasso] = useState<"conta" | "pedido" | "interesses">("conta");
  // O questionário: em andamento, respondido (guardado neste aparelho) ou pulado.
  const [questionario, setQuestionario] = useState<"aberto" | "pronto" | "pulado">("aberto");
  const ti = useTextosDosInteresses(lang);
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
  const porta = useProvaDaPorta();
  const desafio = useCaptcha();
  const emailRef = useRef<HTMLInputElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const idErro = useId();

  /** Passo 1: confere a conta (e-mail e senha forte, igual nas duas vezes, fora dos vazamentos conhecidos) antes de seguir. */
  async function continuar() {
    const antes = !email.includes("@") ? "email" : !avaliarSenha(senha, [email]).aceita ? "senhaFraca" : senha !== senha2 ? "senhasDiferentes" : null;
    setErro(antes ?? "");
    if (antes) {
      if (antes === "email") emailRef.current?.focus();
      return;
    }
    setOcupado(true);
    try {
      if ((await senhaVazada(senha)) === true) return setErro("senhaVazada");
      setPasso("pedido");
      // O foco segue para o título do passo novo: quem usa leitor de tela ou teclado continua dali.
      requestAnimationFrame(() => tituloRef.current?.focus());
    } finally {
      setOcupado(false);
    }
  }

  /** Com o questionário: o pedido é conferido aqui e o envio fica para depois dele (o desafio e a prova vão junto do envio). */
  function seguirParaInteresses() {
    const antes = conferirPedido(codinome, motivo, maior, aceite) ?? (!avaliarSenha(senha, [codinome, email]).aceita ? "senhaFraca" : null);
    setErro(antes ?? "");
    if (antes) {
      focar(campoDoErro[antes] ?? "");
      return;
    }
    setPasso("interesses");
    requestAnimationFrame(() => tituloRef.current?.focus());
  }

  async function criar() {
    const antes = conferirPedido(codinome, motivo, maior, aceite) ?? (!avaliarSenha(senha, [codinome, email]).aceita ? "senhaFraca" : null);
    setErro(antes ?? "");
    if (antes) {
      // O campo com o problema está no passo do pedido: volta para ele.
      if (passo === "interesses" && campoDoErro[antes]) {
        setPasso("pedido");
        requestAnimationFrame(() => focar(campoDoErro[antes] ?? ""));
      }
      focar(campoDoErro[antes] ?? "");
      return;
    }
    setOcupado(true);
    try {
      const supabase = await getClient();
      let sessao: { access_token: string; refresh_token: string } | null = null;
      if (localBackend) {
        // A cópia local de testes (scripts/backend-local.mjs) não tem as rotas da porta: cria a conta direto.
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha, options: { data: { apelido: codinome.trim() }, emailRedirectTo: raizDaAlumia(lang) } });
        if (error) return setErro(/convite/.test(error.message ?? "") ? "cadastroFechado" : error.code === "weak_password" ? "senhaFraca" : "falha");
        sessao = data.session;
      } else {
        // A porta de entrada: a prova no aparelho e o servidor confere antes de a conta existir. O motivo de uma recusa aparece na
        // linha da prova (ProvaDoAparelho).
        const r = await porta.criarConta({ email: email.trim(), senha, codinome: codinome.trim(), volta: raizDaAlumia(lang), turnstile: desafio.token });
        desafio.spend();
        if (!r.ok) return;
        sessao = r.sessao;
      }
      guardarPedido({ codinome: codinome.trim(), motivo: motivo.trim() });
      liberarPonte();
      setSenha("");
      setSenha2("");
      // Sem confirmação de e-mail ligada, a sessão já vem: a casca da entrada manda o pedido sozinha.
      if (sessao && !localBackend) await supabase.auth.setSession(sessao);
      if (!sessao) setPronto(true);
    } catch {
      setErro("falha");
    } finally {
      setOcupado(false);
    }
  }

  if (!aberto) return <Mensagem tipo="info">{t.erros.cadastroFechado}</Mensagem>;
  if (pronto) {
    return (
      <>
        <Caminho t={t} agora={0} />
        <Mensagem tipo="ok">{t.confirmeEmail}</Mensagem>
      </>
    );
  }
  if (passo === "conta") {
    return (
      <>
        <Caminho t={t} agora={0} />
        <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void continuar(); }}>
          <div className="ale-campo">
            <label className="ale-rotulo" htmlFor="ale-criar-email">{t.email}</label>
            <input ref={emailRef} id="ale-criar-email" className="ale-entrada" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={erro === "email" || undefined} aria-describedby={`ale-criar-email-ajuda${erro === "email" ? ` ${idErro}` : ""}`} />
            <span id="ale-criar-email-ajuda" className="ale-ajuda">{t.p.emailAjuda}</span>
            {/* O erro do e-mail fica embaixo do campo dele (o campo também fica marcado), não no pé do formulário. */}
            {erro === "email" && <Mensagem tipo="erro" id={idErro}>{t.erros.email}</Mensagem>}
          </div>
          <CampoSenha t={t} rotulo={t.senhaNova} valor={senha} mudar={setSenha} autoComplete="new-password" regras pessoais={[email]} invalido={erro === "senhaFraca" || erro === "senhaVazada"} descrito={erro === "senhaFraca" || erro === "senhaVazada" ? idErro : undefined} />
          <CampoSenha t={t} rotulo={t.senhaDeNovo} valor={senha2} mudar={setSenha2} autoComplete="new-password" invalido={erro === "senhasDiferentes"} descrito={erro === "senhasDiferentes" ? idErro : undefined} />
          {erro && erro !== "email" && <Mensagem tipo="erro" id={idErro}>{t.erros[erro]}</Mensagem>}
          <Botao ocupado={ocupado} rotulo={t.p.continuar} rotuloOcupado={t.p.continuar} />
        </form>
      </>
    );
  }
  if (passo === "interesses") {
    return (
      <>
        <Caminho t={t} agora={1} />
        <h2 ref={tituloRef} tabIndex={-1} data-ale-foco="" className="ale-cond ale-cartao-titulo">{ti?.cadastro.titulo ?? t.p.pecaTitulo}</h2>
        {ti && <p className="ale-ajuda">{ti.cadastro.nota}</p>}
        {questionario === "aberto" ? (
          <Questionario
            lang={lang}
            inicial={lerInteresses()}
            rotuloDoFim={ti?.cadastro.continuar}
            aoTerminar={(i) => {
              guardarInteresses(i);
              setQuestionario("pronto");
            }}
            aoPular={() => setQuestionario("pulado")}
          />
        ) : (
          <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void criar(); }}>
            {ti && <Mensagem tipo={questionario === "pronto" ? "ok" : "info"}>{questionario === "pronto" ? ti.cadastro.pronto : ti.cadastro.pulado}</Mensagem>}
            {ti && (
              <button type="button" className="ale-link" onClick={() => setQuestionario("aberto")}>
                {ti.cadastro.refazer}
              </button>
            )}
            <Captcha action="conta" lang={lang} round={desafio.round} onToken={desafio.receive} />
            <ProvaDoAparelho lang={lang} estado={porta.estado} />
            {erro && <Mensagem tipo="erro">{t.erros[erro]}</Mensagem>}
            <Botao ocupado={ocupado} rotulo={t.criarBotao} rotuloOcupado={t.criando} />
          </form>
        )}
        {/* "Voltar ao pedido", e não "Voltar para a conta": logo acima, o Voltar do questionário volta de pergunta em pergunta. */}
        <button type="button" className="ale-link" onClick={() => { setErro(""); setPasso("pedido"); }}>
          {ti?.cadastro.voltarAoPedido ?? t.p.voltarPasso}
        </button>
      </>
    );
  }
  if (COM_INTERESSES) {
    return (
      <>
        <Caminho t={t} agora={1} />
        <h2 ref={tituloRef} tabIndex={-1} data-ale-foco="" className="ale-cond ale-cartao-titulo">{t.p.pecaTitulo}</h2>
        <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); seguirParaInteresses(); }}>
          <CamposDoPedido t={t} lang={lang} {...{ codinome, setCodinome, motivo, setMotivo, maior, setMaior, aceite, setAceite }} erroCampo={campoDoErro[erro as ChaveDeErro] ?? ""} />
          {erro && <Mensagem tipo="erro">{t.erros[erro]}</Mensagem>}
          <Botao ocupado={false} rotulo={t.p.continuar} rotuloOcupado={t.p.continuar} />
          <button type="button" className="ale-link" onClick={() => { setErro(""); setPasso("conta"); }}>
            {t.p.voltarPasso}
          </button>
        </form>
      </>
    );
  }
  return (
    <>
      <Caminho t={t} agora={1} />
      <h2 ref={tituloRef} tabIndex={-1} data-ale-foco="" className="ale-cond ale-cartao-titulo">{t.p.pecaTitulo}</h2>
      <form className="ale-form" noValidate onSubmit={(e) => { e.preventDefault(); void criar(); }}>
        <CamposDoPedido t={t} lang={lang} {...{ codinome, setCodinome, motivo, setMotivo, maior, setMaior, aceite, setAceite }} erroCampo={campoDoErro[erro as ChaveDeErro] ?? ""} />
        <Captcha action="conta" lang={lang} round={desafio.round} onToken={desafio.receive} />
        <ProvaDoAparelho lang={lang} estado={porta.estado} />
        {erro && <Mensagem tipo="erro">{t.erros[erro]}</Mensagem>}
        <Botao ocupado={ocupado} rotulo={t.criarBotao} rotuloOcupado={t.criando} />
        <button type="button" className="ale-link" onClick={() => { setErro(""); setPasso("conta"); }}>
          {t.p.voltarPasso}
        </button>
      </form>
    </>
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
  // O servidor vê de que rede o pedido veio (só o resumo, sem o endereço): com banimento por rede em vigor, o banco exige isso.
  await registrarRede("pedido");
  // A porta de entrada: a prova no aparelho e o passe do servidor (com a porta ligada, o banco exige o passe).
  const barrado = await antesDoPedido();
  if (barrado) throw new BackendError(barrado);
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
