// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { getClient, googleEnabled, hasBackend, localBackend, useMe } from "@/lib/backend";
import { Captcha, captchaEnabled } from "./Captcha";
import { useI18n } from "./I18n";

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const primary = "cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Entrada. Quem estuda ou conversa entra por um link enviado ao e-mail, sem senha.
 * A equipe do painel entra com a conta criada pela liderança (e-mail e senha) e confirma
 * com o código do aplicativo autenticador já dentro do painel.
 */
export function SignIn({ s }: { s: Dict["auth"] }) {
  const { lang } = useI18n();
  const router = useRouter();
  const me = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [team, setTeam] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "wrong">("idle");
  const [token, setToken] = useState("");
  const [round, setRound] = useState(0);
  const receive = useCallback((value: string) => setToken(value), []);

  // Quem já entrou (inclusive voltando do link do e-mail) segue direto para o painel.
  useEffect(() => {
    if (me.status === "in") router.replace(`/${lang}/painel`);
  }, [me.status, router, lang]);

  if (!hasBackend) return <p className="mt-8 text-lg text-ink-soft">{s.offline}</p>;
  const back = () => `${window.location.origin}/${lang}/entrar`;
  const waiting = captchaEnabled && !token;

  async function submit() {
    setState("sending");
    const captchaToken = token || undefined;
    try {
      const supabase = await getClient();
      // No ambiente de teste local não existe e-mail: a entrada é direta.
      const { error } =
        team || localBackend
          ? await supabase.auth.signInWithPassword({ email, password: localBackend ? "local" : password, options: { captchaToken } })
          : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: back(), captchaToken } });
      if (error) throw error;
      setState(team || localBackend ? "idle" : "sent");
    } catch {
      setState(team ? "wrong" : "error");
    } finally {
      // A resposta do desafio vale uma vez só: pede outra para a próxima tentativa.
      setToken("");
      setRound((value) => value + 1);
    }
  }

  async function withGoogle() {
    const supabase = await getClient();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back() } });
  }

  if (state === "sent") return <p role="status" className="mt-8 border-l-2 border-ok pl-4 text-lg">{s.sent}</p>;

  return (
    <form className="mt-8 max-w-md space-y-5 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label className="block">
        {s.email}
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>
      {team && (
        <label className="block">
          {s.password}
          <input type="password" required autoComplete="current-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        </label>
      )}
      <Captcha action={team ? "entrar-equipe" : "entrar"} lang={lang} round={round} onToken={receive} />
      <button type="submit" disabled={state === "sending" || !email.includes("@") || waiting || (team && password.length < 8)} className={primary}>
        {team ? s.enter : s.send}
      </button>
      {googleEnabled && !team && (
        <p>
          <button type="button" onClick={withGoogle} className="cursor-pointer border-2 border-ink px-6 py-2 font-medium hover:border-oxblood hover:text-oxblood">
            {s.google}
          </button>
        </p>
      )}
      {state === "error" && <p role="alert" className="text-oxblood">{s.failed}</p>}
      {state === "wrong" && <p role="alert" className="text-oxblood">{s.wrong}</p>}
      <p>
        <button type="button" onClick={() => { setTeam((value) => !value); setState("idle"); }} className="cursor-pointer underline hover:text-oxblood">
          {team ? s.withLink : s.team}
        </button>
      </p>
      <p className="text-ink-soft">{team ? s.teamWhy : s.why}</p>
    </form>
  );
}
