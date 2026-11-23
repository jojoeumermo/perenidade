// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A casca do chat no app (onda R3, itens 1.2 e 2.3): entrar na conta, a senha do app (trava), a senha de pânico (conta isca), os
// ajustes do app (nome e ícone disfarçados, trava automática, apagar depois de X senhas erradas) e, destravado, as MESMAS telas do
// chat do site (components/rede/chat/Tela.tsx), empacotadas aqui dentro. Nenhum link abre ação sem confirmação: todo toque em link
// passa por aqui e só sai pelo nativo, que pergunta de novo com o endereço inteiro.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { getClient, hasBackend } from "@/lib/backend";
import { apagarDoAparelho } from "@/lib/modo-seguro";
import { entrarPelaPorta } from "@/lib/rede/convites/cliente";
import { abrirCofre, garantirCofre } from "@/lib/rede/seguranca/cofre-de-panico";
import { definirSenhaDoApp, destravar, LIMITE, limiteValido, senhaDoAppValida, temSenhaDoApp, travaAutomatica } from "@/lib/rede/casca/trava";
import { DISFARCES, type Disfarce, type NivelDoCofre } from "@/lib/rede/casca/android";
import type { Casca as CascaDoApp } from "@/lib/rede/casca/plataforma";
import { caminhoDaRede } from "@/lib/rede/casca/plataforma";
import { textosDaRede } from "@/lib/rede/textos";
import { preencher } from "@/lib/rede/preencher";
import type { Situacao } from "@/lib/rede/tipos";
import { aparelhoNativo, appNativo, cofreNativo, iniciar, noApp } from "./iniciar";
import { avaliarAparelho, type AvisoDoAparelho } from "@/lib/rede/conta/aparelho";
import { ligado } from "@/lib/recursos";
// Os textos da checagem do aparelho (Prompt 4, item 110) são os do lote "conta" (o português; os outros idiomas ainda são rascunho).
import contaPt from "@/i18n/rede/conta/pt.json";
import pt from "@/i18n/rede/casca/pt.json";
import en from "@/i18n/rede/casca/en.json";
import es from "@/i18n/rede/casca/es.json";
import fr from "@/i18n/rede/casca/fr.json";
import ru from "@/i18n/rede/casca/ru.json";
import zh from "@/i18n/rede/casca/zh.json";

type Textos = typeof pt;
const TEXTOS: Record<string, Textos> = { pt, en, es, fr, ru, zh };
const idioma = (): string => {
  const l = (typeof navigator !== "undefined" ? navigator.language : "pt").slice(0, 2).toLowerCase();
  return l in TEXTOS ? l : "pt";
};

// O chat é carregado só depois de destravado (e é o mesmo do site, empacotado na casca).
const TelaDoChat = dynamic(() => import("@/components/rede/chat/Tela"), { ssr: false });

/**
 * O motor de cifra do chat (@wireapp/core-crypto) exige o JSPI do WebAssembly, que o WebView do Android tem da versão 137 em diante
 * (o Android System WebView se atualiza pela loja). Sem ele, a casca diz o que fazer em vez de quebrar no meio.
 */
export const motorSuportado = (): boolean => typeof (WebAssembly as unknown as { Suspending?: unknown }).Suspending === "function";

type Tela = "iniciando" | "trava" | "entrar" | "fator" | "criar" | "chat" | "ajustes" | "apagado";

/** Minutos da trava automática (guardados no aparelho, sem nada de conta). */
const CHAVE_MINUTOS = "alumia-trava-minutos";
const lerMinutos = (): number => {
  try {
    const n = Number(localStorage.getItem(CHAVE_MINUTOS));
    return [1, 2, 5, 10, 30].includes(n) ? n : 2;
  } catch {
    return 2;
  }
};

/** Campo de senha do chat: sem corretor, sem sugestão, sem preencher sozinho (o teclado sem aprendizado é do nativo). */
const semAprendizado = { autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false } as const;

export default function Casca() {
  const [lang] = useState(idioma);
  const t = TEXTOS[lang] ?? pt;
  // A casca nativa é montada uma vez, antes da primeira tela (o componente só roda no aparelho: ssr desligado).
  const [casca] = useState<CascaDoApp>(() => iniciar());
  const [tela, setTela] = useState<Tela>(() => (temSenhaDoApp() ? "trava" : "iniciando"));
  const [capa, setCapa] = useState(false);
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const toque = useRef<() => void>(() => undefined);

  // Para onde ir depois de destravar, entrar ou criar a senha.
  const seguir = useCallback(async () => {
    if (!hasBackend) return setTela("entrar");
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return setTela("entrar");
    const nivel = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel.data && nivel.data.currentLevel !== "aal2") return setTela("fator");
    if (!temSenhaDoApp()) return setTela("criar");
    const { rede } = await import("@/lib/rede/cliente");
    setSituacao(await rede.situacao().catch(() => null));
    setTela("chat");
  }, []);

  useEffect(() => {
    const c = casca;
    garantirCofre();
    // Só no pacote de teste (a montagem resolve a condição; o de lançamento não leva o arquivo).
    if (process.env.NEXT_PUBLIC_CASCA_TESTE === "1") void import("./teste").then((m) => m.ligarTeste(c));
    // Sem trava, segue (entrar, código, criar a senha ou o chat) logo depois da primeira tela.
    const comeco = temSenhaDoApp() ? null : setTimeout(() => void seguir(), 0);
    // A trava automática: na ida para o fundo cobre a tela NA HORA (antes da foto da troca de apps) e trava.
    const relogio = travaAutomatica(c, lerMinutos(), () => {
      setCapa(true);
      if (temSenhaDoApp()) setTela("trava");
    });
    toque.current = relogio.tocou;
    return () => {
      if (comeco) clearTimeout(comeco);
      relogio.desligar();
    };
  }, [casca, seguir]);

  // Nenhum link abre ação sem confirmação: caminho do site abre a rede social FORA da casca; endereço de fora só pelo nativo, que
  // pergunta de novo mostrando o endereço inteiro. Nada abre sozinho.
  useEffect(() => {
    const ouvir = (e: MouseEvent) => {
      toque.current();
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#")) return;
      e.preventDefault();
      e.stopPropagation();
      const caminho = caminhoDaRede(href);
      if (!window.confirm(`${t.link.pergunta}\n\n${caminho ?? href}\n\n${t.link.aviso}`)) return;
      if (caminho) void casca.abrirRede(caminho);
      else if (/^https:\/\//i.test(href) && noApp()) void appNativo.abrirExterno({ url: href });
    };
    document.addEventListener("click", ouvir, true);
    const tecla = () => toque.current();
    document.addEventListener("keydown", tecla, true);
    return () => {
      document.removeEventListener("click", ouvir, true);
      document.removeEventListener("keydown", tecla, true);
    };
  }, [t, casca]);

  // Notificação sem conteúdo: com o app no fundo, se as não lidas deste aparelho subirem, o nativo mostra só "Nova mensagem".
  useEffect(() => {
    if (tela !== "chat" && tela !== "trava") return;
    let ultimo = -1;
    let vivo = true;
    const id = setInterval(async () => {
      if (!vivo || document.visibilityState !== "hidden") return;
      try {
        const supabase = await getClient();
        const conta = (await supabase.auth.getSession()).data.session?.user.id;
        if (!conta) return;
        const { resumoDasConversas } = await import("@/lib/rede/chat-chaveiro");
        let total = 0;
        for (const r of (await resumoDasConversas(conta)).values()) total += r.naoLidas;
        if (ultimo >= 0 && total > ultimo) await casca.notificar();
        ultimo = total;
      } catch {
        // sem chat neste aparelho ainda
      }
    }, 30_000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [tela, casca]);

  const travarAgora = () => {
    setCapa(true);
    setTela("trava");
    if (noApp()) void appNativo.paraOFundo();
  };

  return (
    <main className="casca-tela" data-tela={tela} onPointerDown={() => toque.current()}>
      {capa && tela !== "trava" ? <div className="casca-capa" aria-hidden /> : null}
      {tela === "iniciando" ? <p>{t.carregando}</p> : null}
      {tela === "trava" ? (
        <Trava
          t={t}
          casca={casca}
          aoAbrir={async (panico) => {
            setCapa(false);
            if (panico) await entrarNaIsca(panico);
            await seguir();
          }}
          aoApagar={() => setTela("apagado")}
        />
      ) : null}
      {tela === "entrar" ? <Entrar t={t} aoEntrar={seguir} /> : null}
      {tela === "fator" ? <Fator t={t} aoConfirmar={seguir} /> : null}
      {tela === "criar" ? <CriarSenha t={t} casca={casca} aoCriar={seguir} /> : null}
      {tela === "chat" && situacao ? (
        <>
          <nav className="casca-barra">
            <button className="casca-botao casca-leve" onClick={() => setTela("ajustes")}>{t.menu.ajustes}</button>
            <button className="casca-botao casca-leve" onClick={() => void casca.abrirRede("/alumia")}>{t.menu.rede}</button>
            <button className="casca-botao" onClick={travarAgora}>{t.menu.travar}</button>
          </nav>
          {motorSuportado() ? (
            <TelaDoChat lang={lang} s={textosDaRede(lang)} situacao={situacao} params={{}} aoEscrever={() => undefined} />
          ) : (
            <p role="alert" data-sem-webview>{t.sem_webview}</p>
          )}
        </>
      ) : null}
      {tela === "ajustes" ? <Ajustes t={t} casca={casca} aoVoltar={() => setTela("chat")} /> : null}
      {tela === "apagado" ? <p role="status">{t.apagado}</p> : null}
    </main>
  );
}

/** A senha de pânico abriu: tira a conta real deste aparelho e entra na isca, pelo caminho normal de entrar. */
async function entrarNaIsca(isca: { email: string; senha: string }): Promise<void> {
  await apagarDoAparelho();
  const r = await entrarPelaPorta({ email: isca.email, senha: isca.senha });
  if (r.ok) await (await getClient()).auth.setSession(r.sessao);
}

function Trava({ t, casca, aoAbrir, aoApagar }: { t: Textos; casca: CascaDoApp | null; aoAbrir: (panico: { email: string; senha: string } | null) => Promise<void>; aoApagar: () => void }) {
  const [senha, setSenha] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    if (!casca || ocupado) return;
    setOcupado(true);
    setAviso("");
    const contador = noApp() ? cofreNativo : { contarSenhaErrada: async () => ({ erros: 0, limite: 0 }), zerarSenhas: async () => undefined, apagarTudo: async () => undefined };
    const r = await destravar(senha, { casca, contador });
    setSenha("");
    setOcupado(false);
    if (r.tipo === "certa") return aoAbrir(null);
    if (r.tipo === "panico") return aoAbrir({ email: r.isca.email, senha: r.isca.senha });
    if (r.tipo === "apagado") return aoApagar();
    setAviso("restam" in r && r.restam !== null ? preencher(t.trava.restam, { n: r.restam }) : t.trava.errada);
  }
  return (
    <form onSubmit={abrir}>
      <h1 className="text-2xl font-bold">{t.trava.titulo}</h1>
      <p>{t.trava.texto}</p>
      <label htmlFor="casca-trava">{t.trava.rotulo}</label>
      <input id="casca-trava" className="casca-campo" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} {...semAprendizado} autoFocus />
      {aviso ? <p role="alert" className="casca-aviso">{aviso}</p> : null}
      <button className="casca-botao" disabled={ocupado || !senha}>{ocupado ? t.trava.conferindo : t.trava.abrir}</button>
    </form>
  );
}

function Entrar({ t, aoEntrar }: { t: Textos; aoEntrar: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setAviso("");
    try {
      // A senha de pânico também vale aqui: abre a isca, sem que a senha de pânico saia do aparelho.
      const cofre = garantirCofre();
      const isca = cofre ? await abrirCofre(senha, cofre) : null;
      if (isca) await apagarDoAparelho();
      const r = await entrarPelaPorta(isca ? { email: isca.email, senha: isca.senha } : { email, senha });
      if (!r.ok) {
        const m = r.motivo;
        setAviso(m === "credenciais" || m === "nao_confirmado" ? t.entrar[m] : m === "bloqueado" ? preencher(t.entrar.bloqueado, { n: r.minutos ?? 15 }) : t.entrar.falha);
        return;
      }
      await (await getClient()).auth.setSession(r.sessao);
      setSenha("");
      await aoEntrar();
    } catch {
      setAviso(t.entrar.falha);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form onSubmit={entrar}>
      <h1 className="text-2xl font-bold">{t.entrar.titulo}</h1>
      <p>{t.entrar.texto}</p>
      <label htmlFor="casca-email">{t.entrar.email}</label>
      <input id="casca-email" className="casca-campo" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} {...semAprendizado} />
      <label htmlFor="casca-senha">{t.entrar.senha}</label>
      <input id="casca-senha" className="casca-campo" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} {...semAprendizado} />
      {aviso ? <p role="alert" className="casca-aviso">{aviso}</p> : null}
      <button className="casca-botao" disabled={ocupado || !senha}>{ocupado ? t.entrar.entrando : t.entrar.botao}</button>
    </form>
  );
}

function Fator({ t, aoConfirmar }: { t: Textos; aoConfirmar: () => Promise<void> }) {
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setAviso("");
    try {
      const supabase = await getClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const fatores = (data?.totp ?? []).filter((f) => f.status === "verified");
      if (!fatores.length) return setAviso(t.entrar.semFator);
      // Confere o código em cada aplicativo confirmado da conta (o mesmo do site).
      for (const f of fatores) {
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code: codigo.replace(/\D/g, "") });
        if (!error) {
          setCodigo("");
          return aoConfirmar();
        }
      }
      setAviso(t.entrar.codigoErrado);
    } catch {
      setAviso(t.entrar.falha);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form onSubmit={confirmar}>
      <h1 className="text-2xl font-bold">{t.entrar.titulo}</h1>
      <label htmlFor="casca-codigo">{t.entrar.codigo}</label>
      <input id="casca-codigo" className="casca-campo" inputMode="numeric" maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ""))} {...semAprendizado} />
      {aviso ? <p role="alert" className="casca-aviso">{aviso}</p> : null}
      <button className="casca-botao" disabled={ocupado || codigo.replace(/\D/g, "").length !== 6}>{t.entrar.confirmar}</button>
    </form>
  );
}

function CriarSenha({ t, casca, aoCriar, titulo }: { t: Textos; casca: CascaDoApp | null; aoCriar: () => void | Promise<void>; titulo?: string }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!casca) return;
    if (!senhaDoAppValida(a)) return setAviso(t.criar.curta);
    if (a !== b) return setAviso(t.criar.diferentes);
    setOcupado(true);
    try {
      await definirSenhaDoApp(a, casca);
      setA("");
      setB("");
      await aoCriar();
    } catch {
      setAviso(t.entrar.falha);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form onSubmit={salvar}>
      <h1 className="text-2xl font-bold">{titulo ?? t.criar.titulo}</h1>
      <p>{t.criar.texto}</p>
      <label htmlFor="casca-nova">{t.criar.rotulo}</label>
      <input id="casca-nova" className="casca-campo" type="password" value={a} onChange={(e) => setA(e.target.value)} {...semAprendizado} />
      <label htmlFor="casca-repetir">{t.criar.repetir}</label>
      <input id="casca-repetir" className="casca-campo" type="password" value={b} onChange={(e) => setB(e.target.value)} {...semAprendizado} />
      {aviso ? <p role="alert" className="casca-aviso">{aviso}</p> : null}
      <button className="casca-botao" disabled={ocupado}>{t.criar.salvar}</button>
    </form>
  );
}

function Ajustes({ t, casca, aoVoltar }: { t: Textos; casca: CascaDoApp | null; aoVoltar: () => void }) {
  const [disfarce, setDisfarce] = useState<Disfarce>("padrao");
  const [limite, setLimite] = useState(0);
  const [pedido, setPedido] = useState<number | null>(null);
  const [nivel, setNivel] = useState<NivelDoCofre | null>(null);
  const [minutos, setMinutos] = useState(lerMinutos);
  const [salvo, setSalvo] = useState(false);
  const [trocar, setTrocar] = useState(false);

  useEffect(() => {
    if (!noApp()) return;
    void appNativo.disfarceAtual().then((d) => setDisfarce(d.nome));
    void cofreNativo.estado().then((e) => {
      setLimite(e.limite);
      setNivel(e.nivel);
    });
  }, []);

  const pronto = () => {
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  };

  async function mudarLimite(n: number) {
    if (!limiteValido(n)) return;
    if (n > 0 && limite === 0) return setPedido(n); // ligar pede o aviso antes
    if (noApp()) setLimite((await cofreNativo.definirLimite({ limite: n })).limite);
    pronto();
  }

  if (trocar) return <CriarSenha t={t} casca={casca} titulo={t.ajustes.senhaNova} aoCriar={() => setTrocar(false)} />;
  return (
    <section>
      <nav className="casca-barra">
        <button className="casca-botao casca-leve" onClick={aoVoltar}>{t.menu.voltar}</button>
      </nav>
      <h1 className="text-2xl font-bold">{t.ajustes.titulo}</h1>
      {salvo ? <p role="status">{t.ajustes.salvo}</p> : null}

      <h2 className="mt-6 text-lg font-bold">{t.ajustes.disfarce}</h2>
      <p>{t.ajustes.disfarceTexto}</p>
      {DISFARCES.map((d) => (
        <label key={d} className="block py-1">
          <input
            type="radio"
            name="disfarce"
            checked={disfarce === d}
            onChange={async () => {
              if (noApp()) setDisfarce((await appNativo.disfarce({ nome: d })).nome);
              pronto();
            }}
          />{" "}
          {t.ajustes.disfarces[d]}
        </label>
      ))}

      <h2 className="mt-6 text-lg font-bold">{t.ajustes.trava}</h2>
      <select
        className="casca-campo"
        value={minutos}
        onChange={(e) => {
          const n = Number(e.target.value);
          setMinutos(n);
          try {
            localStorage.setItem(CHAVE_MINUTOS, String(n));
          } catch {
            // sem armazenamento: fica o padrão
          }
          pronto();
        }}
      >
        {[1, 2, 5, 10, 30].map((n) => (
          <option key={n} value={n}>{preencher(t.ajustes.minutos, { n })}</option>
        ))}
      </select>

      <h2 className="mt-6 text-lg font-bold">{t.ajustes.apagar}</h2>
      <select className="casca-campo" value={limite} onChange={(e) => void mudarLimite(Number(e.target.value))}>
        <option value={LIMITE.desligado}>{t.ajustes.apagarDesligado}</option>
        {[3, 5, 10, 20, 50].map((n) => (
          <option key={n} value={n}>{preencher(t.ajustes.apagarDepois, { n })}</option>
        ))}
      </select>
      {pedido !== null ? (
        <div className="casca-aviso" role="alert">
          <p>{t.ajustes.apagarAviso}</p>
          <button
            className="casca-botao"
            onClick={async () => {
              if (noApp()) setLimite((await cofreNativo.definirLimite({ limite: pedido })).limite);
              setPedido(null);
              pronto();
            }}
          >
            {t.ajustes.apagarConfirmar}
          </button>
        </div>
      ) : null}

      <h2 className="mt-6 text-lg font-bold">{t.ajustes.cofre}</h2>
      <p>{nivel ? t.ajustes.cofres[nivel] : "…"}</p>

      {ligado("alumia-p4-conta") && noApp() ? <ChecagemDoAparelho /> : null}

      <p className="mt-6">
        <button className="casca-botao casca-leve" onClick={() => setTrocar(true)}>{t.ajustes.senhaNova}</button>
      </p>
    </section>
  );
}

/**
 * 110. Checagem do aparelho (Prompt 4, lote "conta", atrás de alumia-p4-conta): o sistema desatualizado, a falta de bloqueio de tela e
 * os apps com permissão de acessibilidade (que podem ler a tela). Lido do próprio Android pelo plugin AlumiaAparelho, avaliado aqui
 * (lib/rede/conta/aparelho.ts); nada vai ao servidor.
 */
function ChecagemDoAparelho() {
  const t = contaPt.aparelho;
  const [avisos, setAvisos] = useState<AvisoDoAparelho[] | null>(null);
  const frase = (a: AvisoDoAparelho): string =>
    a.tipo === "desatualizado" ? preencher(t.desatualizado, { patch: a.patch })
    : a.tipo === "antigo" ? t.antigo
    : a.tipo === "semBloqueio" ? t.semBloqueio
    : preencher(t.acessibilidade, { n: a.nomes.length, nomes: a.nomes.join(", ") });
  return (
    <>
      <h2 className="mt-6 text-lg font-bold">{t.titulo}</h2>
      <p>{t.sobre}</p>
      <p className="mt-2">
        <button className="casca-botao casca-leve" onClick={async () => setAvisos(avaliarAparelho(await aparelhoNativo.checar()))}>{t.conferir}</button>
      </p>
      {avisos ? (
        avisos.length === 0 ? <p role="status">{t.tudoCerto}</p> : (
          <ul className="casca-aviso" role="status">
            {avisos.map((a) => <li key={a.tipo}>{frase(a)}</li>)}
          </ul>
        )
      ) : null}
    </>
  );
}
