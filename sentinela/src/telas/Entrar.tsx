// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// A entrada: e-mail e senha; conta nova só com convite; e o segundo fator, obrigatório para abrir qualquer tela.
import { useEffect, useState } from "react";
import { ligacao, ligarDemo, rpc, salvarLigacao, supabase, temServico, textoDoErro, type Eu } from "../lib/backend.ts";
import { Aviso } from "../componentes/ui.tsx";

const MINIMO = 12;

export function Entrar({ eu, recarregar }: { eu: Eu | null; recarregar: () => void }) {
  const [modo, setModo] = useState<"entrar" | "convite" | "ligar">(temServico() ? "entrar" : "ligar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [codigo, setCodigo] = useState(() => new URLSearchParams(window.location.search).get("convite") ?? "");
  const [convite, setConvite] = useState<{ valido: boolean; email?: string; papel?: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lig, setLig] = useState(ligacao());

  useEffect(() => {
    if (codigo) setModo("convite");
  }, [codigo]);
  useEffect(() => {
    if (modo !== "convite" || codigo.length < 20 || !temServico()) return;
    let c = false;
    rpc<{ valido: boolean; email?: string; papel?: string }>("convite_ver", { p_codigo: codigo }).then((v) => !c && setConvite(v)).catch(() => !c && setConvite({ valido: false }));
    return () => {
      c = true;
    };
  }, [codigo, modo]);

  async function tentar(tarefa: () => Promise<void>, sucesso = "") {
    setOcupado(true);
    setAviso("");
    setOk("");
    try {
      await tarefa();
      if (sucesso) setOk(sucesso);
    } catch (erro) {
      const e = erro as { code?: string; message?: string };
      setAviso(e.code === "invalid_credentials" ? "E-mail ou senha errados." : e.code === "over_request_rate_limit" ? "Muitas tentativas. Espere um pouco." : textoDoErro(erro) === "Algo deu errado. Tente de novo." && e.message ? `Não deu certo: ${e.message.slice(0, 120)}` : textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  const entrar = () => tentar(async () => {
    const { error } = await supabase().auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    recarregar();
  });
  const criar = () => tentar(async () => {
    const { error } = await supabase().auth.signUp({ email: convite?.email || email, password: senha, options: { data: { convite: codigo } } });
    if (error) throw error;
    window.history.replaceState(null, "", "/");
    recarregar();
  }, "Conta criada. Se o serviço pedir confirmação de e-mail, confirme e volte aqui.");

  // Conta já aberta, mas sem o segundo fator confirmado nesta sessão: a tela de código ou de cadastro do autenticador.
  if (eu && !eu.segundo_fator_na_sessao) return <SegundoFator eu={eu} recarregar={recarregar} />;
  if (eu && !eu.ativo) {
    return (
      <Moldura>
        <h2 className="font-serif text-2xl font-semibold">Conta sem papel</h2>
        <p className="mt-3 font-sans text-sm text-ink-soft">A sua conta existe, mas ainda não tem um papel no painel. Se você é a primeira pessoa, rode no SQL Editor do projeto Supabase do Sentinela:</p>
        <pre className="mono mt-2 overflow-x-auto border border-rule bg-parchment p-2 text-xs">select public.promover_dono('{eu.email || "seu-email"}');</pre>
        <p className="mt-3 font-sans text-sm text-ink-soft">Senão, peça ao dono um convite.</p>
        <button type="button" className="botao-claro mt-4" onClick={() => supabase().auth.signOut().then(recarregar)}>Sair</button>
      </Moldura>
    );
  }

  if (modo === "ligar") {
    return (
      <Moldura>
        <h2 className="font-serif text-2xl font-semibold">Ligar ao serviço</h2>
        <p className="mt-2 font-sans text-sm text-ink-soft">Cole os endereços do projeto Supabase do Sentinela (não do site) e do coletor. Só valores públicos: a chave anônima não abre nada sozinha.</p>
        <form className="mt-4 space-y-3 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); salvarLigacao(lig); setModo("entrar"); recarregar(); }}>
          <label className="block">Endereço do Supabase do Sentinela<input className="campo" value={lig.url} onChange={(e) => setLig({ ...lig, url: e.target.value })} placeholder="https://xxxx.supabase.co" required /></label>
          <label className="block">Chave anônima (anon, pública)<input className="campo mono text-xs" value={lig.anon} onChange={(e) => setLig({ ...lig, anon: e.target.value })} required /></label>
          <label className="block">Endereço do coletor (Worker)<input className="campo" value={lig.worker} onChange={(e) => setLig({ ...lig, worker: e.target.value })} placeholder="https://sentinela-lucia.xxx.workers.dev" /></label>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className="botao">Guardar e entrar</button>
            <button type="button" className="botao-claro" onClick={() => { ligarDemo(true); window.location.reload(); }}>Ver a demonstração</button>
          </div>
        </form>
        <p className="mt-4 font-sans text-xs text-ink-soft">A demonstração usa dados fictícios e não fala com serviço nenhum.</p>
      </Moldura>
    );
  }

  if (modo === "convite") {
    return (
      <Moldura>
        <h2 className="font-serif text-2xl font-semibold">Criar conta com convite</h2>
        <form className="mt-4 space-y-3 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
          <label className="block">Código do convite<input className="campo mono text-xs" value={codigo} onChange={(e) => setCodigo(e.target.value.trim())} required /></label>
          {convite && !convite.valido && <Aviso texto="Este convite não vale (expirou, foi usado ou foi revogado)." />}
          {convite?.valido && <p className="font-sans text-xs text-ok">Convite para {convite.email}, como {convite.papel}.</p>}
          <label className="block">E-mail<input type="email" className="campo" value={convite?.email || email} readOnly={Boolean(convite?.email)} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="block">Senha (mínimo {MINIMO})<input type="password" className="campo" autoComplete="new-password" minLength={MINIMO} value={senha} onChange={(e) => setSenha(e.target.value)} required /></label>
          <label className="block">Repita a senha<input type="password" className="campo" autoComplete="new-password" minLength={MINIMO} value={senha2} onChange={(e) => setSenha2(e.target.value)} required /></label>
          {senha2 && senha2 !== senha && <Aviso texto="As senhas não são iguais." />}
          <button type="submit" className="botao" disabled={ocupado || !convite?.valido || senha.length < MINIMO || senha !== senha2}>Criar conta</button>
          <Aviso texto={aviso} />
          <Aviso texto={ok} ok />
          <p><button type="button" className="underline" onClick={() => setModo("entrar")}>Já tenho conta</button></p>
        </form>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <h2 className="font-serif text-2xl font-semibold">Entrar</h2>
      <form className="mt-4 space-y-3 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void entrar(); }}>
        <label className="block">E-mail<input type="email" className="campo" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="block">Senha<input type="password" className="campo" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></label>
        <button type="submit" className="botao" disabled={ocupado || !email.includes("@") || !senha}>Entrar</button>
        <Aviso texto={aviso} />
      </form>
      <div className="mt-5 flex flex-wrap gap-4 font-sans text-xs">
        <button type="button" className="underline" onClick={() => setModo("convite")}>Criar conta com convite</button>
        <button type="button" className="underline" onClick={() => setModo("ligar")}>Trocar o serviço</button>
        <button type="button" className="underline" onClick={() => { ligarDemo(true); window.location.reload(); }}>Ver a demonstração</button>
      </div>
      <p className="mt-4 font-sans text-xs text-ink-soft">Não existe "esqueci a senha" automático: peça ao dono do painel.</p>
    </Moldura>
  );
}

/** O segundo fator: cadastrar o aplicativo autenticador (obrigatório) ou digitar o código. */
function SegundoFator({ eu, recarregar }: { eu: Eu; recarregar: () => void }) {
  const [fator, setFator] = useState<string>("");
  const [cadastro, setCadastro] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [digitos, setDigitos] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void supabase().auth.mfa.listFactors().then(({ data }) => {
      const ok = data?.totp?.find((f) => f.status === "verified");
      if (ok) setFator(ok.id);
    });
  }, []);

  async function trabalhar(t: () => Promise<void>) {
    setOcupado(true);
    setAviso("");
    try {
      await t();
    } catch (erro) {
      setAviso((erro as { message?: string }).message?.includes("Invalid TOTP") ? "Código errado. Confira a hora do celular e tente de novo." : textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }
  const comecar = () => trabalhar(async () => {
    const s = supabase();
    const { data: lista } = await s.auth.mfa.listFactors();
    for (const f of lista?.all ?? []) if (f.status !== "verified") await s.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await s.auth.mfa.enroll({ factorType: "totp", friendlyName: `Sentinela ${Date.now()}` });
    if (error || !data) throw error ?? new Error("falha");
    setCadastro({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
  });
  const confirmar = (id: string) => trabalhar(async () => {
    const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId: id, code: digitos.replace(/\D/g, "") });
    if (error) throw error;
    setCadastro(null);
    recarregar();
  });
  const pronto = digitos.replace(/\D/g, "").length === 6;

  return (
    <Moldura>
      <h2 className="font-serif text-2xl font-semibold">Segundo fator</h2>
      {fator && !cadastro ? (
        <form className="mt-4 space-y-3 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void confirmar(fator); }}>
          <p className="text-ink-soft">Digite o código de seis números do aplicativo autenticador. O painel só abre com ele.</p>
          <input className="campo mono text-center text-xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} value={digitos} onChange={(e) => setDigitos(e.target.value)} aria-label="Código de seis números" />
          <button type="submit" className="botao" disabled={ocupado || !pronto}>Confirmar</button>
          <Aviso texto={aviso} />
        </form>
      ) : cadastro ? (
        <form className="mt-4 space-y-3 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void confirmar(cadastro.id); }}>
          <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
            <li>Instale um aplicativo autenticador (Aegis, 2FAS, ou o que já usa).</li>
            <li>Adicione uma conta apontando a câmera para o quadrado.</li>
            <li>Digite o código de seis números que ele mostrar.</li>
          </ol>
          <img src={cadastro.qr} alt="Código QR do aplicativo autenticador" className="h-44 w-44 border-2 border-ink bg-white p-1" />
          <p className="mono break-all text-xs text-ink-soft">Ou digite a chave: {cadastro.segredo}</p>
          <input className="campo mono text-center text-xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={digitos} onChange={(e) => setDigitos(e.target.value)} aria-label="Código de seis números" />
          <button type="submit" className="botao" disabled={ocupado || !pronto}>Confirmar</button>
          <Aviso texto={aviso} />
        </form>
      ) : (
        <div className="mt-4 space-y-3 font-sans text-sm">
          <p className="text-ink-soft">Olá, {eu.nome || eu.email}. O painel exige um aplicativo autenticador para toda conta: senha roubada, sozinha, não abre nada.</p>
          <button type="button" className="botao" disabled={ocupado} onClick={() => void comecar()}>Cadastrar o aplicativo autenticador</button>
          <Aviso texto={aviso} />
        </div>
      )}
      <p className="mt-5 font-sans text-xs"><button type="button" className="underline" onClick={() => supabase().auth.signOut().then(recarregar)}>Entrar com outra conta</button></p>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <img src="/icone-192.png" alt="" width={48} height={48} className="h-12 w-12" />
        <div>
          <p className="rotulo">Instituto Lúcia</p>
          <h1 className="font-serif text-3xl font-semibold leading-none">Sentinela Lúcia</h1>
        </div>
      </div>
      <div className="quadro surge">{children}</div>
    </main>
  );
}
