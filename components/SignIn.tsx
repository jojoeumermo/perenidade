// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { getClient, hasBackend, localBackend, rpc, signOut, useMe } from "@/lib/backend";
import { useCadastro } from "@/lib/cadastro";
import { senhaVazada } from "@/lib/senha";
import { fingerprintAvailable, signInWithFingerprint } from "@/lib/passkey";
import { KEYS, useHydrated, useStored } from "@/lib/storage";
import { Captcha, captchaEnabled } from "./Captcha";
import { L, useI18n } from "./I18n";
import { SenhaCampo, senhaForte, type SenhaLabels } from "./SenhaCampo";

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
// No aplicativo os botões ocupam a largura toda e ficam mais altos: é o polegar que aperta.
const primary = "cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50 app:max-md:w-full app:max-md:py-3.5 app:max-md:text-base";
const secondary = "flex cursor-pointer items-center justify-center gap-2.5 border-2 border-ink px-6 py-2.5 font-medium hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50 app:max-md:w-full app:max-md:py-3.5 app:max-md:text-base";

interface Invite {
  valido: boolean;
  email?: string;
}

/**
 * A entrada do site. Quem tem conta entra com e-mail e senha; qualquer pessoa cria uma conta de participante da
 * comunidade (sem função nenhuma: o que ela escreve espera a mediação); quem recebeu um convite da coordenação cria a
 * conta pelo endereço do convite, já com a função combinada; e quem recebeu um link de senha nova escolhe a senha aqui.
 * Não existe "esqueci a senha" automático.
 */
export function SignIn({ s }: { s: Dict["auth"] }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const me = useMe();
  const hydrated = useHydrated();
  const code = hydrated ? (new URLSearchParams(window.location.search).get("convite") ?? "") : "";
  const recovering = hydrated && /type=recovery/.test(window.location.hash + window.location.search);
  /** Cadastro aberto: a pessoa chegou por "Criar conta" (da Comunidade, por exemplo) ou escolheu aqui. */
  const [signingUp, setSigningUp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const cadastro = useCadastro();
  const asked = hydrated && new URLSearchParams(window.location.search).has("criar");
  const [recovery, setRecovery] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  // Como a pessoa quer ser chamada no site: pode ser apelido. Vazio, o banco sorteia um codinome.
  const [apelido, setApelido] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "wrong" | "failed" | "unconfirmed" | "resent" | "invalid" | "confirm" | "saved" | "code" | "badCode" | "leaked" | "blocked">("idle");
  /** Minutos que faltam para poder tentar de novo, depois de muitos erros. */
  const [espera, setEspera] = useState(15);
  const [detail, setDetail] = useState("");
  /** O aplicativo autenticador cadastrado na conta que acabou de acertar a senha. */
  const [factor, setFactor] = useState("");
  const [digits, setDigits] = useState("");
  const [token, setToken] = useState("");
  const [round, setRound] = useState(0);
  const receive = useCallback((value: string) => setToken(value), []);
  /** O aparelho tem leitor de digital e sabe usar chave de acesso: só então o botão aparece. */
  const [finger, setFinger] = useState(false);
  const [fingerNote, setFingerNote] = useState<"" | "cancelled" | "failed">("");
  /** Este aparelho já cadastrou (ou já usou) a digital: o botão sobe para o começo da tela. */
  const known = useStored(KEYS.passkey) === "1";
  const changing = recovering || recovery;
  /** O link de confirmação do e-mail venceu (ou já foi usado): o serviço volta para cá com o erro no endereço. */
  const expired = hydrated && /error_code=otp_expired|error=access_denied/.test(window.location.hash + window.location.search);
  /** Para onde o link do e-mail de confirmação leva: a própria tela de entrar, no idioma da pessoa. */
  const back = hydrated ? `${window.location.origin}/${lang}/entrar` : undefined;

  // Quem já entrou segue direto para o painel (menos quem veio escolher uma senha nova ou ainda deve o código do aplicativo).
  useEffect(() => {
    if (me.status === "in" && !changing && state === "idle") router.replace(`/${lang}/painel`);
  }, [me.status, router, lang, changing, state]);

  useEffect(() => {
    if (!code || !hasBackend) return;
    let cancelled = false;
    rpc<Invite>("convite_ver", { p_codigo: code })
      .then((value) => {
        if (!cancelled) setInvite(value);
      })
      .catch(() => {
        if (!cancelled) setInvite({ valido: false });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // O link de senha nova abre uma sessão provisória: o serviço avisa e a tela pede a senha.
  useEffect(() => {
    if (!hasBackend || !recovering) return;
    let stop = () => {};
    void getClient().then((supabase) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
      });
      stop = () => data.subscription.unsubscribe();
    });
    return () => stop();
  }, [recovering]);

  useEffect(() => {
    let cancelled = false;
    void fingerprintAvailable().then((value) => {
      if (!cancelled) setFinger(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasBackend) return <p className="mt-8 text-lg text-ink-soft">{s.offline}</p>;
  const waiting = captchaEnabled && !token;
  const creating = Boolean(code);
  const opening = !creating && cadastro.aberto && (signingUp || (asked && !dismissed));
  const address = invite?.email || email;
  const done = () => {
    // A resposta do desafio vale uma vez só: pede outra para a próxima tentativa.
    setToken("");
    setRound((value) => value + 1);
  };

  /** Senha certa (ou digital conferida) não basta para quem cadastrou o aplicativo autenticador: a entrada só termina com o código. */
  async function finish() {
    const supabase = await getClient();
    const [{ data: level }, { data: factors }] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors()]);
    const verified = factors?.totp?.find((item) => item.status === "verified");
    if (verified && level?.currentLevel !== "aal2") {
      setFactor(verified.id);
      setDigits("");
      setState("code");
    } else {
      setState("idle");
    }
  }

  async function enterWithFingerprint() {
    setState("sending");
    setFingerNote("");
    const result = await signInWithFingerprint(token);
    done();
    if (result.outcome !== "ok") {
      setDetail(result.detail);
      setFingerNote(result.outcome === "cancelled" ? "cancelled" : "failed");
      setState("idle");
      return;
    }
    try {
      await finish();
    } catch {
      setState("idle");
    }
  }

  /** Situação do bloqueio por tentativas (ver install.sql): true quando esta origem está bloqueada para a conta. */
  async function bloqueado(funcao: "entrada_situacao" | "entrada_falhou", conta: string) {
    try {
      const r = await rpc<{ bloqueado: boolean; segundos?: number }>(funcao, { p_email: conta });
      if (r?.bloqueado) {
        setEspera(Math.max(1, Math.ceil((r.segundos ?? 900) / 60)));
        return true;
      }
    } catch {
      // Banco antigo, sem o bloqueio: segue como antes.
    }
    return false;
  }

  async function enter() {
    setState("sending");
    setFingerNote("");
    if (!localBackend && (await bloqueado("entrada_situacao", email))) {
      setState("blocked");
      done();
      return;
    }
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: localBackend ? "local" : password, options: { captchaToken: token || undefined } });
      if (error) throw error;
      void rpc("entrada_certa").catch(() => undefined);
      await finish();
    } catch (failure) {
      // O motivo exato ajuda a coordenação a consertar: senha errada é uma coisa, serviço fora do ar é outra.
      const reason = failure as { code?: string; status?: number; message?: string };
      const code = reason.code ?? "";
      if (code === "email_not_confirmed") {
        setDetail("");
        setState("unconfirmed");
        return;
      }
      setDetail(code === "invalid_credentials" ? "" : [reason.status, code, reason.message].filter(Boolean).join(" · ").slice(0, 200));
      if (code === "invalid_credentials" && !localBackend && (await bloqueado("entrada_falhou", email))) return setState("blocked");
      setState(code === "invalid_credentials" ? "wrong" : "failed");
    } finally {
      done();
    }
  }

  /** Manda de novo o e-mail de confirmação (o link vale por pouco tempo). */
  async function resend() {
    setState("sending");
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: back, captchaToken: token || undefined } });
      if (error) throw error;
      setState("resent");
    } catch (failure) {
      const reason = failure as { code?: string; status?: number; message?: string };
      setDetail([reason.status, reason.code, reason.message].filter(Boolean).join(" · ").slice(0, 200));
      setState("failed");
    } finally {
      done();
    }
  }

  async function confirmCode() {
    setState("sending");
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor, code: digits.replace(/\D/g, "") });
      if (error) throw error;
      me.reload();
      setState("idle");
    } catch {
      setDigits("");
      // O código do autenticador também conta: seis números se adivinham, com tempo.
      if (!localBackend && (await bloqueado("entrada_falhou", `codigo:${email || me.status}`))) return setState("blocked");
      setState("badCode");
    }
  }

  async function create() {
    setState("sending");
    // Senha que já apareceu em vazamento é a primeira que um invasor tenta: não serve.
    if ((await senhaVazada(password)) === true) {
      setState("leaked");
      done();
      return;
    }
    try {
      const supabase = await getClient();
      const { data, error } = await supabase.auth.signUp({ email: address, password, options: { data: { ...(code ? { convite: code } : {}), ...(apelido.trim() ? { apelido: apelido.trim().slice(0, 40) } : {}) }, captchaToken: token || undefined, emailRedirectTo: back } });
      if (error) throw error;
      // Tira o código do endereço: ele já foi gasto e não precisa ficar no histórico do navegador.
      window.history.replaceState(null, "", `/${lang}/entrar`);
      setState(data.session ? "idle" : "confirm");
    } catch {
      setState("invalid");
    } finally {
      done();
    }
  }

  async function change() {
    setState("sending");
    if ((await senhaVazada(password)) === true) return setState("leaked");
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.history.replaceState(null, "", `/${lang}/entrar`);
      setState("saved");
    } catch {
      setState("invalid");
    }
  }

  const footer = (
    <p className="font-sans text-sm text-ink-soft">
      {s.consent}{" "}
      <L href="/termos" className="underline hover:text-oxblood">{t.nav.terms}</L>
      {" · "}
      <L href="/privacidade" className="underline hover:text-oxblood">{t.nav.privacy}</L>
    </p>
  );
  // Senha nova: as regras (tamanho, maiúscula, minúscula, número, caractere especial) vão sendo marcadas enquanto a pessoa escreve.
  const senhaLabels: SenhaLabels = { show: s.show, hide: s.hide, rulesTitle: s.rulesTitle, rules: s.rules, strong: s.strong, meterTitle: s.meterTitle, meter: s.meter };
  const twice = (
    <>
      <label className="block">
        {s.passwordNew}
        <SenhaCampo value={password} onChange={setPassword} labels={senhaLabels} regras required className={field} />
      </label>
      <label className="block">
        {s.passwordAgain}
        <SenhaCampo value={again} onChange={setAgain} labels={senhaLabels} required className={field} />
      </label>
      {again !== "" && again !== password && <p role="alert" className="text-oxblood">{s.mismatch}</p>}
    </>
  );
  const weak = !senhaForte(password) || password !== again;
  const campoApelido = (
    <label className="block">
      {s.nickname}
      <input value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={40} autoComplete="nickname" placeholder={s.nicknameExample} className={field} />
      <span className="mt-1.5 block text-ink-soft">{s.nicknameHint}</span>
    </label>
  );
  const fingerprint = finger && (
    <div className="space-y-2">
      <button type="button" disabled={state === "sending" || waiting} onClick={() => void enterWithFingerprint()} className={known ? `${primary} flex items-center justify-center gap-2.5` : secondary}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M6.5 6.2A8 8 0 0 1 20 12v1.5M4 12a8 8 0 0 1 .7-3.3M8 19.5A12 12 0 0 1 7 12a5 5 0 0 1 10 0c0 2.6.3 4.6.9 6.3M12 12c0 3.4.5 6 1.6 8.5M4.6 15.5c.2 1 .5 2 .9 2.9M10 20.8A15 15 0 0 1 9.4 15" />
        </svg>
        {s.fingerprint}
      </button>
      {fingerNote === "cancelled" && <p role="status" className="text-ink-soft">{s.fingerprintCancelled}</p>}
      {fingerNote === "failed" && (
        <p role="alert" className="text-oxblood">
          {s.fingerprintFailed}
          {detail && <span className="mt-1 block font-mono text-xs">{detail}</span>}
        </p>
      )}
      {fingerNote === "" && <p className="text-ink-soft">{s.fingerprintHint}</p>}
    </div>
  );
  const or = <p aria-hidden className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-ink-soft before:h-px before:flex-1 before:bg-rule after:h-px after:flex-1 after:bg-rule">{s.or}</p>;

  if (state === "saved") {
    return (
      <p role="status" className="mt-8 border-l-2 border-ok pl-4 text-lg">
        {s.saved} <L href="/painel" className="underline hover:text-oxblood">{t.nav.panel}</L>
      </p>
    );
  }
  if (state === "confirm") return <p role="status" className="mt-8 border-l-2 border-ok pl-4 text-lg">{s.confirm}</p>;

  if (factor && (state === "code" || state === "badCode" || state === "sending" || state === "blocked")) {
    return (
      <form className="mt-8 max-w-md space-y-5 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void confirmCode(); }}>
        <h2 className="font-serif text-2xl font-semibold">{s.codeTitle}</h2>
        <label className="block">
          {s.codeLabel}
          <input value={digits} onChange={(e) => setDigits(e.target.value)} required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={`${field} font-mono text-lg tracking-[0.4em]`} />
        </label>
        <button type="submit" disabled={state === "sending" || digits.replace(/\D/g, "").length !== 6} className={primary}>{s.codeConfirm}</button>
        {state === "badCode" && <p role="alert" className="text-oxblood">{s.codeWrong}</p>}
        {state === "blocked" && <p role="alert" className="border-l-2 border-oxblood pl-3 text-oxblood">{s.blocked.replace("{min}", String(espera))}</p>}
        <CodigoDeRecuperacao s={s} pronto={() => { me.reload(); setState("idle"); }} />
        <p>
          <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => void signOut().then(() => { setFactor(""); setPassword(""); setState("idle"); })}>
            {s.codeOther}
          </button>
        </p>
      </form>
    );
  }

  if (changing) {
    return (
      <form className="mt-8 max-w-md space-y-5 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void change(); }}>
        <h2 className="font-serif text-2xl font-semibold">{s.newPasswordTitle}</h2>
        {twice}
        <button type="submit" disabled={state === "sending" || weak || !recovery} className={primary}>{s.save}</button>
        {state === "invalid" && <p role="alert" className="text-oxblood">{s.failed}</p>}
        {state === "leaked" && <p role="alert" className="text-oxblood">{s.leaked}</p>}
      </form>
    );
  }

  if (creating) {
    if (!invite) return <p className="mt-8 text-ink-soft">{t.common.loading}</p>;
    if (!invite.valido) return <p role="alert" className="mt-8 border-l-2 border-oxblood pl-4 text-lg">{s.inviteInvalid}</p>;
    return (
      <form className="mt-8 max-w-md space-y-5 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <h2 className="font-serif text-2xl font-semibold">{s.inviteTitle}</h2>
        <label className="block">
          {s.email}
          <input type="email" required autoComplete="email" value={address} readOnly={Boolean(invite.email)} onChange={(e) => setEmail(e.target.value)} className={`${field} ${invite.email ? "opacity-70" : ""}`} />
        </label>
        {campoApelido}
        {twice}
        <Captcha action="convite" lang={lang} round={round} onToken={receive} />
        <button type="submit" disabled={state === "sending" || !address.includes("@") || waiting || weak} className={primary}>{s.create}</button>
        {state === "invalid" && <p role="alert" className="text-oxblood">{s.inviteInvalid}</p>}
        {state === "leaked" && <p role="alert" className="text-oxblood">{s.leaked}</p>}
        <p className="text-ink-soft">{s.inviteWhy}</p>
        {footer}
      </form>
    );
  }

  if (opening) {
    return (
      <form className="mt-8 max-w-md space-y-5 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <h2 className="font-serif text-2xl font-semibold">{s.createTitle}</h2>
        <label className="block">
          {s.email}
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>
        {campoApelido}
        {twice}
        <Captcha action="cadastro" lang={lang} round={round} onToken={receive} />
        <button type="submit" disabled={state === "sending" || !email.includes("@") || waiting || weak} className={primary}>{s.create}</button>
        {state === "invalid" && <p role="alert" className="text-oxblood">{s.createFailed}</p>}
        {state === "leaked" && <p role="alert" className="text-oxblood">{s.leaked}</p>}
        <p className="text-ink-soft">{s.createWhy}</p>
        <p>
          <button
            type="button"
            className="cursor-pointer underline hover:text-oxblood"
            onClick={() => {
              window.history.replaceState(null, "", `/${lang}/entrar`);
              setSigningUp(false);
              setDismissed(true);
              setState("idle");
            }}
          >
            {s.toEnter}
          </button>
        </p>
        {footer}
      </form>
    );
  }

  return (
    <form className="mt-8 max-w-md space-y-5 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void enter(); }}>
      {fingerprint && known && (
        <>
          {fingerprint}
          {or}
        </>
      )}
      <label className="block">
        {s.email}
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>
      <label className="block">
        {s.password}
        <SenhaCampo value={password} onChange={setPassword} labels={senhaLabels} autoComplete="current-password" required className={field} />
      </label>
      <Captcha action="entrar" lang={lang} round={round} onToken={receive} />
      <button type="submit" disabled={state === "sending" || !email.includes("@") || waiting || password.length < 1} className={primary}>{s.enter}</button>
      {state === "wrong" && <p role="alert" className="text-oxblood">{s.wrong}</p>}
      {state === "blocked" && <p role="alert" className="border-l-2 border-oxblood pl-3 text-oxblood">{s.blocked.replace("{min}", String(espera))}</p>}
      {expired && state === "idle" && <p role="alert" className="border-l-2 border-oxblood pl-3 text-oxblood">{s.expired}</p>}
      {state === "unconfirmed" && (
        <div role="alert" className="space-y-3 border-l-2 border-oxblood pl-3">
          <p className="text-oxblood">{s.unconfirmed}</p>
          <button type="button" disabled={waiting} onClick={() => void resend()} className={secondary}>{s.resend}</button>
        </div>
      )}
      {state === "resent" && <p role="status" className="border-l-2 border-ok pl-3">{s.resent}</p>}
      {state === "failed" && (
        <p role="alert" className="text-oxblood">
          {s.failed}
          {detail && <span className="mt-1 block font-mono text-xs">{detail}</span>}
        </p>
      )}
      {fingerprint && !known && (
        <>
          {or}
          {fingerprint}
        </>
      )}
      {/* Até o serviço responder não se sabe se o cadastro está aberto: melhor não dizer nada do que dizer o contrário. */}
      {cadastro.pronto && <p className="text-ink-soft">{cadastro.aberto ? s.why : s.whyClosed}</p>}
      {cadastro.aberto && (
        <p>
          <button type="button" className="cursor-pointer font-medium underline hover:text-oxblood" onClick={() => { setSigningUp(true); setState("idle"); }}>
            {s.toCreate}
          </button>
        </p>
      )}
      {footer}
    </form>
  );
}

/**
 * Perdeu o celular do aplicativo autenticador: com a senha já conferida, um dos códigos de recuperação tira o
 * aplicativo da conta (a pessoa e a coordenação são avisadas) e a entrada termina; o aplicativo novo é cadastrado depois.
 */
function CodigoDeRecuperacao({ s, pronto }: { s: Dict["auth"]; pronto: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (!aberto) {
    return (
      <p>
        <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setAberto(true)}>{s.recoveryLink}</button>
      </p>
    );
  }
  async function usar() {
    setOcupado(true);
    setNota("");
    try {
      const r = await rpc<{ ok: boolean }>("conta_codigo_usar", { p_codigo: codigo });
      if (!r.ok) {
        setNota(s.recoveryBad);
        return;
      }
      setNota(s.recoveryDone);
      const supabase = await getClient();
      await supabase.auth.refreshSession().catch(() => null);
      pronto();
    } catch {
      setNota(s.recoveryBad);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="border-t border-rule pt-4">
      <label className="block">
        {s.recoveryLabel}
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" spellCheck={false} maxLength={14} className="mt-1 w-full max-w-56 border-2 border-ink bg-parchment-deep px-3 py-2 font-mono uppercase tracking-widest" />
      </label>
      <button type="button" disabled={ocupado || codigo.replace(/[^0-9a-f]/gi, "").length !== 10} onClick={() => void usar()} className="mt-2 cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood disabled:opacity-50">
        {s.recoveryButton}
      </button>
      {nota && <p role="status" className="mt-2">{nota}</p>}
    </div>
  );
}
