// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { getClient, hasBackend, localBackend, rpc, signOut, useMe } from "@/lib/backend";
import { useHydrated } from "@/lib/storage";
import { Captcha, captchaEnabled } from "./Captcha";
import { L, useI18n } from "./I18n";

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const primary = "cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
/** Senha criada aqui tem pelo menos doze caracteres. */
const MINIMO = 12;

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
  const asked = hydrated && new URLSearchParams(window.location.search).has("criar");
  const [recovery, setRecovery] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "wrong" | "failed" | "invalid" | "confirm" | "saved" | "code" | "badCode">("idle");
  const [detail, setDetail] = useState("");
  /** O aplicativo autenticador cadastrado na conta que acabou de acertar a senha. */
  const [factor, setFactor] = useState("");
  const [digits, setDigits] = useState("");
  const [token, setToken] = useState("");
  const [round, setRound] = useState(0);
  const receive = useCallback((value: string) => setToken(value), []);
  const changing = recovering || recovery;

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

  if (!hasBackend) return <p className="mt-8 text-lg text-ink-soft">{s.offline}</p>;
  const waiting = captchaEnabled && !token;
  const creating = Boolean(code);
  const opening = !creating && (signingUp || (asked && !dismissed));
  const address = invite?.email || email;
  const done = () => {
    // A resposta do desafio vale uma vez só: pede outra para a próxima tentativa.
    setToken("");
    setRound((value) => value + 1);
  };

  async function enter() {
    setState("sending");
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: localBackend ? "local" : password, options: { captchaToken: token || undefined } });
      if (error) throw error;
      // Senha certa não basta para quem cadastrou o aplicativo autenticador: a entrada só termina com o código.
      const [{ data: level }, { data: factors }] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors()]);
      const verified = factors?.totp?.find((item) => item.status === "verified");
      if (verified && level?.currentLevel !== "aal2") {
        setFactor(verified.id);
        setDigits("");
        setState("code");
      } else {
        setState("idle");
      }
    } catch (failure) {
      // O motivo exato ajuda a coordenação a consertar: senha errada é uma coisa, serviço fora do ar é outra.
      const reason = failure as { code?: string; status?: number; message?: string };
      const code = reason.code ?? "";
      setDetail(code === "invalid_credentials" ? "" : [reason.status, code, reason.message].filter(Boolean).join(" · ").slice(0, 200));
      setState(code === "invalid_credentials" ? "wrong" : "failed");
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
      setState("badCode");
    }
  }

  async function create() {
    setState("sending");
    try {
      const supabase = await getClient();
      const { data, error } = await supabase.auth.signUp({ email: address, password, options: { data: code ? { convite: code } : {}, captchaToken: token || undefined } });
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
  const twice = (
    <>
      <label className="block">
        {s.passwordNew}
        <input type="password" required autoComplete="new-password" minLength={MINIMO} maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
      <label className="block">
        {s.passwordAgain}
        <input type="password" required autoComplete="new-password" minLength={MINIMO} maxLength={200} value={again} onChange={(e) => setAgain(e.target.value)} className={field} />
      </label>
      {again !== "" && again !== password && <p role="alert" className="text-oxblood">{s.mismatch}</p>}
    </>
  );
  const weak = password.length < MINIMO || password !== again;

  if (state === "saved") {
    return (
      <p role="status" className="mt-8 border-l-2 border-ok pl-4 text-lg">
        {s.saved} <L href="/painel" className="underline hover:text-oxblood">{t.nav.panel}</L>
      </p>
    );
  }
  if (state === "confirm") return <p role="status" className="mt-8 border-l-2 border-ok pl-4 text-lg">{s.confirm}</p>;

  if (factor && (state === "code" || state === "badCode" || state === "sending")) {
    return (
      <form className="mt-8 max-w-md space-y-5 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void confirmCode(); }}>
        <h2 className="font-serif text-2xl font-semibold">{s.codeTitle}</h2>
        <label className="block">
          {s.codeLabel}
          <input value={digits} onChange={(e) => setDigits(e.target.value)} required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={`${field} font-mono text-lg tracking-[0.4em]`} />
        </label>
        <button type="submit" disabled={state === "sending" || digits.replace(/\D/g, "").length !== 6} className={primary}>{s.codeConfirm}</button>
        {state === "badCode" && <p role="alert" className="text-oxblood">{s.codeWrong}</p>}
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
        {twice}
        <Captcha action="convite" lang={lang} round={round} onToken={receive} />
        <button type="submit" disabled={state === "sending" || !address.includes("@") || waiting || weak} className={primary}>{s.create}</button>
        {state === "invalid" && <p role="alert" className="text-oxblood">{s.inviteInvalid}</p>}
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
        {twice}
        <Captcha action="cadastro" lang={lang} round={round} onToken={receive} />
        <button type="submit" disabled={state === "sending" || !email.includes("@") || waiting || weak} className={primary}>{s.create}</button>
        {state === "invalid" && <p role="alert" className="text-oxblood">{s.createFailed}</p>}
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
      <label className="block">
        {s.email}
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>
      <label className="block">
        {s.password}
        <input type="password" required autoComplete="current-password" maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
      <Captcha action="entrar" lang={lang} round={round} onToken={receive} />
      <button type="submit" disabled={state === "sending" || !email.includes("@") || waiting || password.length < 1} className={primary}>{s.enter}</button>
      {state === "wrong" && <p role="alert" className="text-oxblood">{s.wrong}</p>}
      {state === "failed" && (
        <p role="alert" className="text-oxblood">
          {s.failed}
          {detail && <span className="mt-1 block font-mono text-xs">{detail}</span>}
        </p>
      )}
      <p className="text-ink-soft">{s.why}</p>
      <p>
        <button type="button" className="cursor-pointer font-medium underline hover:text-oxblood" onClick={() => { setSigningUp(true); setState("idle"); }}>
          {s.toCreate}
        </button>
      </p>
      {footer}
    </form>
  );
}
