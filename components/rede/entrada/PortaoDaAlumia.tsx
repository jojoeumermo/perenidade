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
// Todas as telas usam a mesma cena (Cena.tsx): o chamado e a parede de ladrilhos de um lado, o cartão do outro. O que muda é o
// cartão. A cada troca, o título novo recebe o foco e uma linha de estado diz ao leitor de tela onde a pessoa está.
// Sem conta, duas coisas da Alumia continuam abertas: as páginas "o que guardamos" e "transparência", e o diretório das
// organizações com selo (decisão da coordenação; a lista de comunidades fica fechada).
// Coordenação e militante da Escola chegam como "aprovada" direto (sem pedido nem triagem); o segundo fator vale para todo mundo.
import "@/styles/alumia-entrada.css";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { BackendError, getClient, hasBackend, hasSession, rpc, signOut } from "@/lib/backend";
import { useCadastro } from "@/lib/cadastro";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import type { FiguraDaEntrada } from "@/lib/rede/entrada/figuras";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { registrarRede } from "@/lib/rede/painel/cliente-rede";
import { pararPonte, ponteDisponivel, trazerSessaoDoSite } from "@/lib/sessao/cliente-ponte";
import { KEYS, useHydrated, useStored } from "@/lib/storage";
import { enderecoDoSite } from "../VoltarAoSite";
import { Cena } from "./Cena";
import { Caminho, enviarPedido, raizDaAlumia, FormCriar, FormEntrar, FormNovaSenha, FormPedido, lerPedidoGuardado, Mensagem } from "./Formularios";
import { CadastrarFator, PedirCodigo } from "./SegundoFator";
// R1 (A3.2): a situação do pedido em quatro passos e os códigos de recuperação logo depois do aplicativo.
import { CodigosNaEntrada, etapaDe, SituacaoDoPedido } from "../uso/NaEntrada";
import { useTextosDoUso } from "../uso/textos";
import { ProvedorDeVoce, useVoce } from "./Voce";
// A porta de entrada (onda 8) pendura aqui pelo encaixe dela: a página do convite abre sem conta.
import { LIVRES_DA_PORTA } from "../convites/encaixe-da-entrada";

interface EuNaEntrada {
  logado: boolean;
  situacao?: "sem_pedido" | "em_analise" | "aprovada" | "recusada" | "suspensa" | "sem_conta";
  /** R1: "na_fila" enquanto ninguém da triagem viu o pedido, "em_analise" depois (o banco nunca diz quem viu nem quando). */
  etapa?: string | null;
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
  | { f: "codigos" }
  | { f: "fator-codigo"; fator: string; conta: string }
  | { f: "dentro" };

/**
 * Telas da Alumia que abrem sem conta: o que guardamos, a transparência e, da onda 8, os termos, a privacidade, as regras e a ajuda
 * (informação pública sobre a própria rede; quem teve a conta suspensa pede a revisão pelas regras) e, da onda 9, o guia "Sem sinal?"
 * do modo ato (abre sem sessão e sem rede, no dia do ato), da onda R3, a página de baixar e conferir o app (/alumia/app), e do P5
 * a página de denúncia da Alumia (/alumia/denunciar), que vale para quem está sem conta.
 */
const LIVRES = /\/(o-que-guardamos|transparencia|termos|privacidade|regras|ajuda|denunciar|modo-ato\/sem-sinal|app)\/?$/;
/**
 * O diretório das organizações com selo ("Traga sua organização"): com a trava ligada continua visível para quem não tem sessão
 * (o banco deixa rede_org_diretorio e rede_org_mapa abertas: 20261113-alumia-o7-entrada.sql). Quem tem sessão e ainda não passou
 * pela entrada vê a entrada, porque a página dela abriria a casca da rede, que o banco recusa.
 */
const DIRETORIO = /\/organizacoes\/?$/;

/** A fase pedida no endereço da prévia; nula para o que não é uma das telas sem banco. */
function faseDaPrevia(nome: string | null): Fase | null {
  const eu: EuNaEntrada = { logado: true, situacao: "sem_pedido", codinome: "Faísca", regras_versao: 1, pedido_em: new Date(Date.now() - 2 * 86_400_000).toISOString() };
  switch (nome) {
    case "fora":
    case "suspensa":
    case "atualizando":
    case "conferindo":
    case "sem-servico":
    case "nova-senha":
      return { f: nome };
    case "fator":
      return { f: "fator-cadastrar" };
    case "codigo":
      return { f: "fator-codigo", fator: "exemplo", conta: "" };
    case "recusada-pode":
      return { f: "recusada", pode: true, eu: { ...eu, situacao: "recusada", motivo_recusa: "Pedido de exemplo, sem relação com a organização." } };
    case "pedido":
      return { f: "pedido", eu: { ...eu, codinome: null } };
    case "analise":
      return { f: "analise", eu: { ...eu, situacao: "em_analise", etapa: "em_analise" } };
    case "fila":
      return { f: "analise", eu: { ...eu, situacao: "em_analise", etapa: "na_fila" } };
    case "codigos":
      return { f: "codigos" };
    case "recusada":
      return { f: "recusada", pode: false, eu: { ...eu, situacao: "recusada", motivo_recusa: "Pedido de exemplo, sem relação com a organização.", pedir_de_novo_em: new Date(Date.now() + 20 * 86_400_000).toISOString() } };
    default:
      return null;
  }
}

interface PropsDoPortao {
  lang: Locale;
  t: TextosDaEntrada;
  figuras: FiguraDaEntrada[];
  site: string;
  /** O diretório das organizações com selo está no ar (rotas da Alumia nova com "alumia-org")? Então a entrada aponta para ele. */
  comDiretorio?: boolean;
  children: ReactNode;
}

export function PortaoDaAlumia(props: PropsDoPortao) {
  return (
    <ProvedorDeVoce>
      <Portao {...props} />
    </ProvedorDeVoce>
  );
}

/** O nome de cada tela, para a linha de estado que o leitor de tela anuncia quando o cartão muda. */
function nomeDaTela(t: TextosDaEntrada, fase: Fase): string {
  switch (fase.f) {
    case "conferindo":
      return t.carregando;
    case "ponte":
      return t.ponte;
    case "fora":
      return t.abas;
    case "sem-servico":
      return t.semServicoTitulo;
    case "atualizando":
      return t.atualizando;
    case "nova-senha":
      return t.novaSenhaTitulo;
    case "suspensa":
      return t.suspensaTitulo;
    case "analise":
      return `${t.p.carimbos.analise}. ${t.analiseTitulo}`;
    case "recusada":
      return `${t.p.carimbos.recusada}. ${t.recusadaTitulo}`;
    case "pedido":
      return t.pedidoTitulo;
    case "fator-cadastrar":
      return `${t.p.carimbos.aprovada}. ${t.fatorTitulo}`;
    case "fator-codigo":
      return t.codigoTitulo;
    case "codigos":
      return t.p.carimbos.aprovada;
    default:
      return "";
  }
}

function Portao({ lang, t, figuras, site: siteDoServidor, comDiretorio = false, children }: PropsDoPortao) {
  const caminho = usePathname() ?? "";
  const { definirCodinome, definirFoto } = useVoce();
  // O endereço do site só se acerta no navegador (no host alumia.* sem a variável, "/pt" seria a própria Alumia).
  const hidratado = useHydrated();
  const site = hidratado ? enderecoDoSite(lang) : siteDoServidor;
  const sessao = useStored(KEYS.session);
  const [fase, setFase] = useState<Fase>({ f: "conferindo" });
  const [vez, setVez] = useState(0);
  const conferirDeNovo = useCallback(() => setVez((v) => v + 1), []);
  const tu = useTextosDoUso(lang);

  useEffect(() => {
    let vivo = true;
    const ir = (x: Fase) => vivo && setFase(x);
    async function conferir() {
      if (!hasBackend) {
        // Na prévia com dados de exemplo (NEXT_PUBLIC_ALUMIA_PREVIA=sim) não há banco: "?portao=fora" (ou pedido, analise,
        // recusada, suspensa, atualizando) mostra a tela pedida, para conferir os formulários. Nada é enviado.
        const pedida = previaDaAlumiaLigada() ? faseDaPrevia(new URLSearchParams(window.location.search).get("portao")) : null;
        if (vivo && pedida && "eu" in pedida && pedida.eu.codinome) definirCodinome(pedida.eu.codinome);
        if (vivo && pedida && (pedida.f === "fator-cadastrar" || pedida.f === "fator-codigo" || pedida.f === "codigos")) definirCodinome("Faísca");
        return ir(pedida ?? { f: "sem-servico" });
      }
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
      // De que rede a conta entrou (só o resumo, calculado no servidor): se a rede está barrada, a situação abaixo já vem "suspensa".
      await registrarRede("entrada");
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
      // O painel da pessoa na parede se forma com o codinome da conta que entrou (desenhado aqui, no aparelho).
      if (vivo && eu.codinome) definirCodinome(eu.codinome);
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
  }, [sessao, vez, definirCodinome]);

  const sair = useCallback(() => {
    pararPonte();
    // Quem sai leva o rosto junto: o painel da parede volta a ficar vazio.
    definirCodinome("");
    definirFoto(null);
    void signOut().then(conferirDeNovo);
  }, [conferirDeNovo, definirCodinome, definirFoto]);

  // Quando o cartão troca de tela (não na primeira), o foco vai para o título novo: teclado e leitor de tela seguem dali.
  const cartao = useRef<HTMLDivElement>(null);
  const telaAnterior = useRef<Fase["f"] | null>(null);
  useEffect(() => {
    const antes = telaAnterior.current;
    telaAnterior.current = fase.f;
    if (!antes || antes === fase.f || antes === "conferindo" || antes === "ponte") return;
    // Tela que já abre com o foco num campo (o código do aplicativo) fica como está.
    if (document.activeElement instanceof HTMLInputElement && cartao.current?.contains(document.activeElement)) return;
    cartao.current?.querySelector<HTMLElement>("[data-ale-foco]")?.focus();
  }, [fase.f]);

  // P5 (A3): "Entrar" e "Criar conta" de qualquer tela da Alumia trazem ?entrar ou ?criar (lib/rede/alumia.ts, entradaDaAlumia):
  // aí o portão aparece também nas telas que abrem sem conta (o diretório das organizações, os termos), e depois de entrar a
  // pessoa fica na mesma tela.
  const pedeEntrada = hidratado && /[?&](entrar|criar)(?:[=&]|$)/.test(window.location.search);
  if (fase.f === "dentro" || (!pedeEntrada && (LIVRES.test(caminho) || LIVRES_DA_PORTA.test(caminho) || (fase.f === "fora" && DIRETORIO.test(caminho))))) return <>{children}</>;

  const diretorio = comDiretorio ? (hidratado ? `${raizDaAlumia(lang).replace(/\/$/, "")}/organizacoes` : `/${lang}/alumia/organizacoes`) : null;
  const titulo = (texto: string) => (
    <h2 tabIndex={-1} data-ale-foco="" className="ale-cond ale-cartao-titulo">
      {texto}
    </h2>
  );
  const cena = (conteudo: ReactNode, opcoes: { comoEntrar?: boolean; ocupado?: boolean } = {}) => (
    <Cena t={t} figuras={figuras} site={site} organizacoes={diretorio} comoEntrar={opcoes.comoEntrar} ocupado={opcoes.ocupado}>
      <p className="ale-sr" role="status">{nomeDaTela(t, fase)}</p>
      <div ref={cartao} key={fase.f} className="ale-pilha">
        {conteudo}
      </div>
    </Cena>
  );

  switch (fase.f) {
    case "conferindo":
    case "ponte":
      return cena(
        <div className="ale-espera">
          <span aria-hidden className="ale-giro" />
          <p>{fase.f === "ponte" ? t.ponte : t.carregando}</p>
        </div>,
        { ocupado: true },
      );
    case "fora":
      return cena(<Landing lang={lang} t={t} aoEntrar={conferirDeNovo} />, { comoEntrar: true });
    case "sem-servico":
      return cena(
        <>
          {titulo(t.semServicoTitulo)}
          <Mensagem tipo="info">{t.semServico}</Mensagem>
          <div className="ale-linha-de-elos">
            <button type="button" className="ale-botao ale-botao-contorno" onClick={conferirDeNovo}>{t.tentar}</button>
            <a className="ale-link" href={site}>{t.voltar}</a>
          </div>
        </>,
      );
    case "atualizando":
      return cena(
        <>
          <Mensagem tipo="info">{t.atualizando}</Mensagem>
          <div className="ale-linha-de-elos">
            <button type="button" data-ale-foco="" className="ale-botao ale-botao-contorno" onClick={conferirDeNovo}>{t.tentar}</button>
            <a className="ale-link" href={site}>{t.voltar}</a>
          </div>
        </>,
      );
    case "nova-senha":
      return cena(
        <>
          {titulo(t.novaSenhaTitulo)}
          <FormNovaSenha t={t} aoSalvar={conferirDeNovo} />
        </>,
      );
    case "suspensa":
      return cena(
        <>
          <span className="ale-carimbo ale-carimbo-cinza">{t.p.carimbos.suspensa}</span>
          {titulo(t.suspensaTitulo)}
          <p className="ale-cartao-texto">{t.suspensaTexto}</p>
          <div className="ale-linha-de-elos"><button type="button" className="ale-botao ale-botao-contorno" onClick={sair}>{t.sair}</button></div>
        </>,
      );
    case "analise":
      return cena(
        <>
          <Caminho t={t} agora={2} />
          <span className="ale-carimbo ale-carimbo-ouro">{etapaDe(fase.eu) === "na_fila" && tu ? tu.entrada.passos.na_fila : t.p.carimbos.analise}</span>
          {titulo(t.analiseTitulo)}
          <p className="ale-cartao-texto">{t.analiseTexto}</p>
          <SituacaoDoPedido lang={lang} etapa={etapaDe(fase.eu) === "na_fila" ? "na_fila" : "em_analise"} />
          {(fase.eu.codinome || fase.eu.pedido_em) && (
            <p className="ale-ajuda">
              {fase.eu.codinome ? <b>{fase.eu.codinome}</b> : null}
              {fase.eu.codinome && fase.eu.pedido_em ? " · " : null}
              {fase.eu.pedido_em ? t.analiseData.replace("{data}", data(lang, fase.eu.pedido_em)) : null}
            </p>
          )}
          <div className="ale-linha-de-elos">
            <button type="button" className="ale-botao ale-botao-contorno" onClick={conferirDeNovo}>{t.conferir}</button>
            <button type="button" className="ale-link" onClick={sair}>{t.sair}</button>
          </div>
        </>,
      );
    case "recusada": {
      const podeEm = fase.eu.pedir_de_novo_em ? new Date(fase.eu.pedir_de_novo_em) : null;
      const pode = fase.pode;
      return cena(
        <>
          <Caminho t={t} agora={pode ? 1 : 2} />
          <span className="ale-carimbo ale-carimbo-cinza">{t.p.carimbos.recusada}</span>
          {titulo(t.recusadaTitulo)}
          <p className="ale-cartao-texto">{t.recusadaTexto}</p>
          <SituacaoDoPedido lang={lang} etapa="recusada" />
          {fase.eu.motivo_recusa && <Mensagem tipo="info"><strong>{t.recusadaMotivo}:</strong> {fase.eu.motivo_recusa}</Mensagem>}
          {pode ? (
            <FormPedido t={t} lang={lang} codinomeInicial={fase.eu.codinome ?? ""} motivoInicial="" versao={fase.eu.regras_versao ?? 1} aoEnviar={conferirDeNovo} />
          ) : (
            podeEm && <p className="ale-ajuda">{t.recusadaDeNovo.replace("{data}", data(lang, podeEm.toISOString()))}</p>
          )}
          <div className="ale-linha-de-elos"><button type="button" className="ale-link" onClick={sair}>{t.sair}</button></div>
        </>,
      );
    }
    case "pedido": {
      const guardado = lerPedidoGuardado();
      return cena(
        <>
          <Caminho t={t} agora={1} />
          {titulo(t.pedidoTitulo)}
          <p className="ale-cartao-texto">{t.pedidoTexto}</p>
          <FormPedido t={t} lang={lang} codinomeInicial={guardado?.codinome ?? fase.eu.codinome ?? ""} motivoInicial={guardado?.motivo ?? ""} versao={fase.eu.regras_versao ?? 1} aoEnviar={conferirDeNovo} />
          <div className="ale-linha-de-elos"><button type="button" className="ale-link" onClick={sair}>{t.sair}</button></div>
        </>,
      );
    }
    case "fator-cadastrar":
      return cena(
        <>
          <Caminho t={t} agora={3} />
          <span className="ale-carimbo ale-carimbo-vermelho">{t.p.carimbos.aprovada}</span>
          <CadastrarFator t={t} aoConfirmar={() => setFase({ f: "codigos" })} aoSair={sair} />
        </>,
      );
    case "codigos":
      return cena(
        <>
          <Caminho t={t} agora={3} />
          <span className="ale-carimbo ale-carimbo-vermelho">{t.p.carimbos.aprovada}</span>
          <CodigosNaEntrada lang={lang} aoPronto={conferirDeNovo} />
        </>,
      );
    case "fator-codigo":
      return cena(<PedirCodigo t={t} lang={lang} fator={fase.fator} conta={fase.conta} aoConfirmar={conferirDeNovo} aoSair={sair} />);
  }
}

function data(lang: string, iso: string): string {
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** O cartão de quem não tem sessão: as abas Entrar / Criar conta, com os formulários. */
function Landing({ lang, t, aoEntrar }: { lang: Locale; t: TextosDaEntrada; aoEntrar: () => void }) {
  const cadastro = useCadastro();
  const { definirCodinome, definirFoto } = useVoce();
  const [aba, setAba] = useState<"entrar" | "criar">(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("criar") ? "criar" : "entrar"));
  const trocar = (nova: "entrar" | "criar") => {
    if (nova === aba) return;
    // Quem desiste de criar a conta e volta para "Entrar" leva o rascunho junto: o painel da parede esvazia.
    if (nova === "entrar") {
      definirCodinome("");
      definirFoto(null);
    }
    setAba(nova);
  };
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const nova = e.key === "Home" ? "entrar" : e.key === "End" ? "criar" : aba === "entrar" ? "criar" : "entrar";
      trocar(nova);
      document.getElementById(`ale-aba-${nova}`)?.focus();
    }
  };
  return (
    <>
      <div className="ale-abas" role="tablist" aria-label={t.abas} onKeyDown={teclas}>
        <button id="ale-aba-entrar" type="button" role="tab" data-ale-foco="" className="ale-aba" aria-selected={aba === "entrar"} aria-controls="ale-painel-entrar" tabIndex={aba === "entrar" ? 0 : -1} onClick={() => trocar("entrar")}>
          {t.abaEntrar}
        </button>
        <button id="ale-aba-criar" type="button" role="tab" className="ale-aba" aria-selected={aba === "criar"} aria-controls="ale-painel-criar" tabIndex={aba === "criar" ? 0 : -1} onClick={() => trocar("criar")}>
          {t.abaCriar}
        </button>
      </div>
      <div id="ale-painel-entrar" role="tabpanel" aria-labelledby="ale-aba-entrar" className="ale-pilha" hidden={aba !== "entrar"}>
        {aba === "entrar" && <FormEntrar t={t} lang={lang} aoEntrar={aoEntrar} />}
      </div>
      <div id="ale-painel-criar" role="tabpanel" aria-labelledby="ale-aba-criar" className="ale-pilha" hidden={aba !== "criar"}>
        {aba === "criar" && <FormCriar t={t} lang={lang} aberto={!cadastro.pronto || cadastro.aberto} />}
      </div>
    </>
  );
}
