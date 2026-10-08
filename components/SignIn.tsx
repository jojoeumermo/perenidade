// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { getClient, googleEnabled, hasBackend, localBackend, useMe } from "@/lib/backend";
import { useI18n } from "./I18n";

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";

/** Entrada sem senha: um link enviado por e-mail ou a conta Google. Nenhuma senha é guardada pelo site. */
export function SignIn({ s }: { s: Dict["auth"] }) {
  const { lang } = useI18n();
  const router = useRouter();
  const me = useMe();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Quem já entrou (inclusive voltando do link do e-mail) segue direto para o painel.
  useEffect(() => {
    if (me.status === "in") router.replace(`/${lang}/painel`);
  }, [me.status, router, lang]);

  if (!hasBackend) return <p className="mt-8 text-lg text-ink-soft">{s.offline}</p>;
  const back = () => `${window.location.origin}/${lang}/entrar`;

  async function withEmail() {
    setState("sending");
    try {
      const supabase = await getClient();
      // No ambiente de teste local não existe e-mail: a entrada é direta.
      const { error } = localBackend
        ? await supabase.auth.signInWithPassword({ email, password: "local" })
        : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: back() } });
      if (error) throw error;
      setState(localBackend ? "idle" : "sent");
    } catch {
      setState("error");
    }
  }

  async function withGoogle() {
    const supabase = await getClient();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back() } });
  }

  if (state === "sent") return <p role="status" className="mt-8 border-l-2 border-ok pl-4 text-lg">{s.sent}</p>;

  return (
    <form className="mt-8 max-w-md space-y-5 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void withEmail(); }}>
      <label className="block">
        {s.email}
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>
      <button type="submit" disabled={state === "sending" || !email.includes("@")} className="cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
        {s.send}
      </button>
      {googleEnabled && (
        <p>
          <button type="button" onClick={withGoogle} className="cursor-pointer border-2 border-ink px-6 py-2 font-medium hover:border-oxblood hover:text-oxblood">
            {s.google}
          </button>
        </p>
      )}
      {state === "error" && <p role="alert" className="text-oxblood">{s.failed}</p>}
      <p className="text-ink-soft">{s.why}</p>
    </form>
  );
}
