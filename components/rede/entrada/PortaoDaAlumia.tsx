// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O portão da Alumia (recurso "alumia-entrada"): sem conta aprovada e sem o segundo fator, ninguém vê a rede. Fica em volta de
// todas as telas da Alumia (app/[lang]/alumia/layout.tsx) e decide o que aparece:
//   sem sessão           → a entrada (entrar / criar conta), depois de tentar trazer a sessão do site (lib/sessao/cliente-ponte.ts)
//   sem pedido           → o pedido de entrada (codinome, por que quer entrar, 18+, aceite)
//   em análise           → "sua conta está em análise"     · recusada → o motivo e quando pedir de novo · suspensa → o aviso
//   aprovada, sem fator  → cadastrar o aplicativo autenticador   · com fator, sessão aal1 → o código
//   aprovada e aal2      → a Alumia
// O banco confere tudo de novo (20261110-alumia-entrada.sql): esconder a tela não é a trava, é só o caminho.
// Coordenação e militante da Escola chegam como "aprovada" direto (sem pedido nem triagem); o segundo fator vale para todo mundo.
import "@/styles/alumia-entrada.css";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { BackendError, getClient, hasBackend, hasSession, rpc, signOut } from "@/lib/backend";
import { useCadastro } from "@/lib/cadastro";
import type { FiguraDaEntrada } from "@/lib/rede/entrada/figuras";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { pararPonte, ponteDisponivel, trazerSessaoDoSite } from "@/lib/sessao/cliente-ponte";
import { KEYS, useHydrated, useStored } from "@/lib/storage";
import { enderecoDoSite } from "../VoltarAoSite";
import { Cena } from "./Cena";
import { enviarPedido, FormCriar, FormEntrar, FormNovaSenha, FormPedido, lerPedidoGuardado, Mensagem } from "./Formularios";
import { CadastrarFator, PedirCodigo } from "./SegundoFator";

interface EuNaEntrada {
  logado: boolean;
  situacao?: "sem_pedido" | "em_analise" | "aprovada" | "recusada" | "suspensa" | "sem_conta";
  direto?: boolean;
  aal2?: boolean;
  codinome?: string | null;
  pedido_em?: string | null;
  motivo_recusa?: string | null;
  pedir_de_novo_em?: string | null;
  regras_versao?: number;
}

type Fase =
  | { f: "conferindo" }
  | { f: "ponte" }
  | { f: "fora" }
  | { f: "nova-senha" }
  | { f: "atualizando" }
  | { f: "sem-servico" }
  | { f: "pedido"; eu: EuNaEntrada }
  | { f: "analise"; eu: EuNaEntrada }
  | { f: "recusada"; eu: EuNaEntrada; pode: boolean }
  | { f: "suspensa" }
  | { f: "fator-cadastrar" }
  | { f: "fator-codigo"; fator: string; conta: string }
  | { f: "dentro" };

/** Telas da Alumia que abrem sem conta: o que guardamos e a transparência (informação pública sobre a própria rede). */
const LIVRES = /\/(o-que-guardamos|transparencia)\/?$/;

export function PortaoDaAlumia({ lang, t, figuras, site: siteDoServidor, children }: { lang: Locale; t: TextosDaEntrada; figuras: FiguraDaEntrada[]; site: string; children: ReactNode }) {
  const caminho = usePathname() ?? "";
  // O endereço do site só se acerta no navegador (no host alumia.* sem a variável, "/pt" seria a própria Alumia).
  const site = useHydrated() ? enderecoDoSite(lang) : siteDoServidor;
  const sessao = useStored(KEYS.session);
  const [fase, setFase] = useState<Fase>({ f: "conferindo" });
  const [vez, setVez] = useState(0);
  const conferirDeNovo = useCallback(() => setVez((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    const ir = (x: Fase) => vivo && setFase(x);
    async function conferir() {
      if (!hasBackend) return ir({ f: "sem-servico" });
      const url = window.location.hash + window.location.search;
      // A volta de um link do e-mail (confirmar a conta, senha nova): o cliente lê a sessão do endereço.
      if (/access_token=|code=|type=recovery|token_hash=/.test(url)) {
        const supabase = await getClient();
        if (/type=recovery/.test(url)) {
          await supabase.auth.getSession();
          return ir({ f: "nova-senha" });
        }
        await supabase.auth.getSession();
      }
      if (!hasSession()) {
        if (ponteDisponivel()) {
          ir({ f: "ponte" });
          if (await trazerSessaoDoSite()) return; // a sessão nova muda o armazenamento e este efeito roda de novo
        }
        return ir({ f: "fora" });
      }
      let eu: EuNaEntrada;
      try {
        eu = await rpc<EuNaEntrada>("alumia_entrada_eu");
      } catch (e) {
        const codigo = e instanceof BackendError ? e.code : "";
        if (codigo === "banco_desatualizado") return ir({ f: "atualizando" });
        if (codigo === "sem_conexao" || codigo === "falha") return ir({ f: "atualizando" });
        return ir({ f: "fora" });
      }
      if (!eu?.logado) return ir({ f: "fora" });
      switch (eu.situacao) {
        case "suspensa":
          return ir({ f: "suspensa" });
        case "em_analise":
          return ir({ f: "analise", eu });
        case "recusada":
          return ir({ f: "recusada", eu, pode: !eu.pedir_de_novo_em || new Date(eu.pedir_de_novo_em).getTime() <= Date.now() });
        case "aprovada":
          break;
        default: {
          // Sem pedido: o "Criar conta" deste aparelho guardou o pedido até a confirmação do e-mail; ele segue sozinho.
          const guardado = lerPedidoGuardado();
          if (guardado) {
            try {
              await enviarPedido(guardado, eu.regras_versao ?? 1);
              const depois = await rpc<EuNaEntrada>("alumia_entrada_eu");
              if (depois.situacao === "em_analise") return ir({ f: "analise", eu: depois });
              if (depois.situacao !== "aprovada") return ir({ f: "pedido", eu: depois });
              eu = depois;
              break;
            } catch {
              // segue para o formulário, com o que foi escrito
            }
          }
          return ir({ f: "pedido", eu });
        }
      }
      // Aprovada: o segundo fator é obrigatório.
      try {
        const supabase = await getClient();
        const [{ data: nivel }, { data: fatores }, { data: usuario }] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
          supabase.auth.getUser(),
        ]);
        const confirmado = fatores?.totp?.find((f) => f.status === "verified");
        if (!confirmado) return ir({ f: "fator-cadastrar" });
        if (nivel?.currentLevel !== "aal2") return ir({ f: "fator-codigo", fator: confirmado.id, conta: usuario.user?.email ?? "" });
        return ir({ f: "dentro" });
      } catch {
        return ir({ f: "atualizando" });
      }
    }
    void conferir();
    return () => {
      vivo = false;
    };
  }, [sessao, vez]);

  const sair = useCallback(() => {
    pararPonte();
    void signOut().then(conferirDeNovo);
  }, [conferirDeNovo]);

  if (fase.f === "dentro" || LIVRES.test(caminho)) return <>{children}</>;

  const sozinho = (conteudo: ReactNode) => (
    <Cena t={t} figuras={figuras} site={site}>
      <main className="ale-sozinho" id="conteudo">
        <section className="ale-cartao" aria-live="polite">
          <div aria-hidden className="ale-faixa ale-cartao-faixa" />
          <div className="ale-cartao-corpo">{conteudo}</div>
        </section>
      </main>
    </Cena>
  );

  switch (fase.f) {
    case "conferindo":
    case "ponte":
      return (
        <Cena t={t} figuras={figuras} site={site}>
          <main className="ale-espera" id="conteudo" aria-busy="true">
            <div>
              <span aria-hidden className="ale-giro" style={{ display: "inline-block" }} />
              <p role="status">{fase.f === "ponte" ? t.ponte : t.carregando}</p>
            </div>
          </main>
        </Cena>
      );
    case "fora":
      return <Landing lang={lang} t={t} figuras={figuras} site={site} aoEntrar={conferirDeNovo} />;
    case "sem-servico":
      return sozinho(<Mensagem tipo="info">{t.semServico}</Mensagem>);
    case "atualizando":
      return sozinho(
        <>
          <Mensagem tipo="info">{t.atualizando}</Mensagem>
          <div className="ale-form">
            <button type="button" className="ale-botao ale-botao-contorno" onClick={conferirDeNovo}>{t.tentar}</button>
          </div>
        </>,
      );
    case "nova-senha":
      return sozinho(
        <>
          <h1 className="ale-cond ale-cartao-titulo">{t.novaSenhaTitulo}</h1>
          <FormNovaSenha t={t} aoSalvar={conferirDeNovo} />
        </>,
      );
    case "suspensa":
      return sozinho(
        <>
          <h1 className="ale-cond ale-cartao-titulo">{t.suspensaTitulo}</h1>
          <p className="ale-cartao-texto">{t.suspensaTexto}</p>
          <div className="ale-form"><button type="button" className="ale-botao ale-botao-contorno" onClick={sair}>{t.sair}</button></div>
        </>,
      );
    case "analise":
      return sozinho(
        <>
          <p className="ale-chamada">{fase.eu.codinome ?? t.codinome}</p>
          <h1 className="ale-cond ale-cartao-titulo" style={{ marginTop: 14 }}>{t.analiseTitulo}</h1>
          <p className="ale-cartao-texto">{t.analiseTexto}</p>
          {fase.eu.pedido_em && <p className="ale-ajuda" style={{ marginTop: 10 }}>{t.analiseData.replace("{data}", data(lang, fase.eu.pedido_em))}</p>}
          <div className="ale-form">
            <button type="button" className="ale-botao ale-botao-contorno" onClick={conferirDeNovo}>{t.conferir}</button>
            <button type="button" className="ale-link" onClick={sair}>{t.sair}</button>
          </div>
        </>,
      );
    case "recusada": {
      const podeEm = fase.eu.pedir_de_novo_em ? new Date(fase.eu.pedir_de_novo_em) : null;
      const pode = fase.pode;
      return sozinho(
        <>
          <h1 className="ale-cond ale-cartao-titulo">{t.recusadaTitulo}</h1>
          <p className="ale-cartao-texto">{t.recusadaTexto}</p>
          {fase.eu.motivo_recusa && <Mensagem tipo="info"><strong>{t.recusadaMotivo}:</strong> {fase.eu.motivo_recusa}</Mensagem>}
          {pode ? (
            <FormPedido t={t} lang={lang} codinomeInicial={fase.eu.codinome ?? ""} motivoInicial="" versao={fase.eu.regras_versao ?? 1} aoEnviar={conferirDeNovo} />
          ) : (
            podeEm && <p className="ale-ajuda" style={{ marginTop: 12 }}>{t.recusadaDeNovo.replace("{data}", data(lang, podeEm.toISOString()))}</p>
          )}
          <div className="ale-form"><button type="button" className="ale-link" onClick={sair}>{t.sair}</button></div>
        </>,
      );
    }
    case "pedido": {
      const guardado = lerPedidoGuardado();
      return sozinho(
        <>
          <h1 className="ale-cond ale-cartao-titulo">{t.pedidoTitulo}</h1>
          <p className="ale-cartao-texto">{t.pedidoTexto}</p>
          <FormPedido t={t} lang={lang} codinomeInicial={guardado?.codinome ?? fase.eu.codinome ?? ""} motivoInicial={guardado?.motivo ?? ""} versao={fase.eu.regras_versao ?? 1} aoEnviar={conferirDeNovo} />
          <div className="ale-form"><button type="button" className="ale-link" onClick={sair}>{t.sair}</button></div>
        </>,
      );
    }
    case "fator-cadastrar":
      return sozinho(<CadastrarFator t={t} aoConfirmar={conferirDeNovo} aoSair={sair} />);
    case "fator-codigo":
      return sozinho(<PedirCodigo t={t} fator={fase.fator} conta={fase.conta} aoConfirmar={conferirDeNovo} aoSair={sair} />);
  }
}

function data(lang: string, iso: string): string {
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** A entrada de quem não tem sessão: o chamado forte, os 4 passos e o cartão com Entrar / Criar conta. */
function Landing({ lang, t, figuras, site, aoEntrar }: { lang: Locale; t: TextosDaEntrada; figuras: FiguraDaEntrada[]; site: string; aoEntrar: () => void }) {
  const cadastro = useCadastro();
  const [aba, setAba] = useState<"entrar" | "criar">(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("criar") ? "criar" : "entrar"));
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const nova = e.key === "Home" ? "entrar" : e.key === "End" ? "criar" : aba === "entrar" ? "criar" : "entrar";
      setAba(nova);
      document.getElementById(`ale-aba-${nova}`)?.focus();
    }
  };
  return (
    <Cena t={t} figuras={figuras} site={site}>
      <main className="ale-corpo" id="conteudo">
        <section aria-labelledby="ale-titulo">
          <p className="ale-chamada">{t.chamada}</p>
          <h1 id="ale-titulo" className="ale-cond ale-titulo">
            Alumia<span>{t.titulo}</span>
          </h1>
          <p className="ale-lema">{t.lema}</p>
          <p className="ale-texto">{t.texto}</p>
          <ul className="ale-sinais">
            {t.sinais.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <section className="ale-como" aria-labelledby="ale-como">
            <h2 id="ale-como" className="ale-cond">{t.comoEntrar}</h2>
            <ol className="ale-passos">
              {t.passos.map((p, i) => (
                <li key={p.titulo} className="ale-passo">
                  <span aria-hidden className="ale-cond ale-passo-n">{i + 1}</span>
                  <span>
                    <strong>{p.titulo}</strong>
                    <span>{p.texto}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </section>
        <section className="ale-cartao" aria-label={t.abas}>
          <div aria-hidden className="ale-faixa ale-cartao-faixa" />
          <div className="ale-cartao-corpo">
            <div className="ale-abas" role="tablist" aria-label={t.abas} onKeyDown={teclas}>
              <button id="ale-aba-entrar" type="button" role="tab" className="ale-aba" aria-selected={aba === "entrar"} aria-controls="ale-painel-entrar" tabIndex={aba === "entrar" ? 0 : -1} onClick={() => setAba("entrar")}>
                {t.abaEntrar}
              </button>
              <button id="ale-aba-criar" type="button" role="tab" className="ale-aba" aria-selected={aba === "criar"} aria-controls="ale-painel-criar" tabIndex={aba === "criar" ? 0 : -1} onClick={() => setAba("criar")}>
                {t.abaCriar}
              </button>
            </div>
            <div id="ale-painel-entrar" role="tabpanel" aria-labelledby="ale-aba-entrar" hidden={aba !== "entrar"}>
              {aba === "entrar" && <FormEntrar t={t} lang={lang} aoEntrar={aoEntrar} />}
            </div>
            <div id="ale-painel-criar" role="tabpanel" aria-labelledby="ale-aba-criar" hidden={aba !== "criar"}>
              {aba === "criar" && <FormCriar t={t} lang={lang} aberto={!cadastro.pronto || cadastro.aberto} />}
            </div>
          </div>
        </section>
      </main>
    </Cena>
  );
}
