// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { can, getClient, hasBackend, leads, type Me, type Role, rpc, signOut, useMe } from "@/lib/backend";
import { registerDevice } from "@/lib/device";
import { applyPrefs, readPrefs } from "@/lib/prefs";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { L, useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, data, elo, oQueFaz, papeis, rotulo, situacoes, textoDoErro, useAcao, useLista } from "./comum";
import { Apoiadores, Comunidade, MuralFila, RadioAdmin } from "./Cuidar";
import { Boletim } from "./Boletim";
import { Conversas } from "./Conversas";
import { Equipe, type Membro } from "./Equipe";
import { Escrever } from "./Escrever";
import { Fila } from "./Fila";
import { Horas } from "./Horas";
import { AvisoDeAbertura, RegistroDeAtividades, SegurancaSucessao } from "./Lideranca";
import { Materiais } from "./Materiais";
import { Pessoas } from "./Pessoas";
import { Podcast } from "./podcast/Podcast";
import { Reforco } from "./Reforco";
import { Aparelhos, Digital, Recados, SegundoFator } from "./Seguranca";
import { type Controles, Site } from "./Site";

interface Resumo {
  fila: number;
  aguardando_publicacao: number;
  candidaturas: number;
  denuncias: number;
  anotacoes: number;
  retidos: number;
  mural: number;
  /** Envios do público que a mediação ainda não leu. */
  triagem?: number;
  reforco: number;
  horas: number;
  testemunhar: number;
  minhas: number;
  /** Contribuições pendentes de colegas que me chamaram para trabalhar junto. */
  juntas: number;
}

interface Secao {
  id: string;
  nome: string;
  /** Uma linha que diz para que a seção serve. */
  sobre: string;
  grupo: string;
  mostra: boolean;
  /** Quantas coisas esperam por alguém nesta seção. */
  conta?: number;
}

/** Sem uso por este tempo, o painel se fecha sozinho: aparelho esquecido aberto não vira porta de entrada. */
const OCIOSO = 30 * 60 * 1000;

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Claro ou escuro, como no site: a escolha fica guardada no navegador. */
function Tema() {
  // O cabeçalho do site não existe aqui dentro, então é o painel que reaplica o tema e as preferências de leitura.
  useLayoutEffect(() => {
    const tema = getItem(KEYS.theme);
    if (tema === "light" || tema === "dark") document.documentElement.setAttribute("data-theme", tema);
    applyPrefs(readPrefs());
  }, []);

  function trocar() {
    const atual = document.documentElement.getAttribute("data-theme") ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const novo = atual === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    setItem(KEYS.theme, novo);
  }

  return (
    <button type="button" onClick={trocar} className="cursor-pointer underline hover:text-white">
      Claro / escuro
    </button>
  );
}

/** Tela inteira para os estados em que o painel ainda não abriu (carregando, sem conta, segundo fator). */
function Porta({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#17130e] px-4 py-10 font-sans text-sm text-[#efe4c8]">
      <div className="w-full max-w-md">
        <p className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca-96.png" alt="" width={40} height={40} className="h-10 w-10" />
          <span>
            <span className="block font-serif text-2xl font-semibold leading-none">Instituto Lúcia</span>
            <span className="mt-1 block font-mono text-[0.65rem] uppercase tracking-[0.3em] text-[#c9a84a]">Painel</span>
          </span>
        </p>
        <div className="mt-8 border border-[#3a3226] bg-[#1f1a14] p-6">{children}</div>
        <p className="mt-6">
          <L href="/" className="underline hover:text-white">← Voltar ao site</L>
        </p>
      </div>
    </div>
  );
}

/**
 * O ambiente de trabalho de quem faz o instituto. É uma tela à parte do site: menu lateral por área,
 * uma seção de cada vez, e cada pessoa vê só o que diz respeito à função que recebeu.
 */
export function Painel() {
  const me = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const { lang } = useI18n();
  const [menu, setMenu] = useState(false);
  const dentro = me.status === "in";

  // Avisa o serviço de que a conta foi aberta neste navegador (gera alerta se for um aparelho novo).
  useEffect(() => {
    if (dentro) void registerDevice();
  }, [dentro]);

  // Fecha a sessão depois de meia hora sem ninguém mexer.
  useEffect(() => {
    if (!dentro) return;
    let ultimo = Date.now();
    const tocar = () => {
      ultimo = Date.now();
    };
    const sinais = ["pointerdown", "keydown", "scroll"] as const;
    for (const sinal of sinais) window.addEventListener(sinal, tocar, { passive: true });
    const relogio = window.setInterval(() => {
      if (Date.now() - ultimo > OCIOSO) void signOut().then(() => router.replace(`/${lang}/entrar`));
    }, 30_000);
    return () => {
      for (const sinal of sinais) window.removeEventListener(sinal, tocar);
      window.clearInterval(relogio);
    };
  }, [dentro, router, lang]);

  if (!hasBackend) return <Porta><p>O painel ainda não foi ligado neste endereço.</p></Porta>;
  if (me.status === "loading") return <Porta><p className="font-mono text-xs">Abrindo…</p></Porta>;
  if (me.status === "out") {
    return (
      <Porta>
        <p className="text-base">Esta é a área de trabalho da equipe.</p>
        <p className="mt-4">
          <L href="/entrar" className="inline-block bg-[#efe4c8] px-5 py-2.5 font-medium text-[#17130e] hover:bg-white">Entrar com a minha conta</L>
        </p>
      </Porta>
    );
  }

  const eu = me.me;
  const sair = async () => {
    await signOut();
    router.replace(`/${lang}`);
  };

  // Função sensível com a exigência ligada: nada do painel abre antes do código do aplicativo autenticador.
  if (eu.exige_segundo_fator && !eu.segundo_fator) {
    return (
      <Porta>
        <h1 className="font-serif text-2xl font-semibold">Confirme que é você</h1>
        <p className="mt-2 text-[#b9ad90]">A sua função exige uma segunda confirmação antes de abrir o painel.</p>
        <div className="mt-5 bg-parchment p-4 text-ink">
          <SegundoFator me={eu} recarregar={me.reload} />
        </div>
        <button type="button" className="mt-6 cursor-pointer underline hover:text-white" onClick={sair}>Sair</button>
      </Porta>
    );
  }

  return <Dentro eu={eu} recarregar={me.reload} sair={sair} aba={params.get("aba") ?? "mesa"} menu={menu} setMenu={setMenu} />;
}

function Dentro({ eu, recarregar, sair, aba, menu, setMenu }: { eu: Me; recarregar: () => void; sair: () => void; aba: string; menu: boolean; setMenu: (aberto: boolean) => void }) {
  const router = useRouter();
  const { lang } = useI18n();
  const resumo = useLista<Resumo>("painel_resumo");
  // O que espera por esta pessoa no podcast (aprovação, comentários, perguntas, pedidos de arte).
  const podcast = useLista<number>("podcast_contagem");
  const r = resumo.dados;
  // De minuto em minuto o painel diz que a pessoa está por aqui e pergunta se chegou mensagem nova.
  const presenca = useLista<{ conversas: number }>("presenca");
  const avisarPresenca = presenca.recarregar;
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") avisarPresenca();
    }, 60_000);
    return () => window.clearInterval(relogio);
  }, [avisarPresenca]);
  const voluntario = eu.papeis.length > 0;
  const lidera = can(eu, "coordenacao");
  // Cada função enxerga só as ferramentas dela. A coordenação e a vice-coordenação enxergam todas.
  const secoes: Secao[] = (
    [
      { id: "mesa", nome: "Mesa", sobre: "O que espera por você hoje.", grupo: "", mostra: true, conta: eu.avisos },
      { id: "conversas", nome: "Conversas", sobre: "Mensagens privadas e grupos da equipe, cifradas neste aparelho.", grupo: "", mostra: voluntario, conta: aba === "conversas" ? 0 : presenca.dados?.conversas },
      { id: "rede", nome: "Mural da equipe", sobre: "Publicações e pedidos de ajuda para todos ou por função, cifrados neste aparelho.", grupo: "", mostra: voluntario },
      { id: "escrever", nome: "Escrever", sobre: "Aulas, matérias, verbetes e tudo o que vai para o site.", grupo: "Produção", mostra: true },
      { id: "minhas", nome: "Meus envios", sobre: "O que você enviou e em que pé está.", grupo: "Produção", mostra: true },
      { id: "juntas", nome: "Compartilhadas comigo", sobre: "Contribuições de colegas que chamaram você para trabalhar junto.", grupo: "Produção", mostra: voluntario, conta: r?.juntas },
      { id: "fila", nome: "Fila de revisão", sobre: "Ler, dar parecer e decidir o que vai ao ar.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "revisao", "educacao"), conta: r?.fila },
      { id: "triagem", nome: "Triagem", sobre: "A primeira leitura do que o público envia: o que passa segue para a fila de revisão.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "mediacao"), conta: r?.triagem },
      { id: "materiais", nome: "Materiais e arquivos", sobre: "Zines, cartazes, imagens e PDFs.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "design") },
      { id: "comunidade", nome: "Comunidade", sobre: "Fila de revisão, banimentos, denúncias, anotações e o filtro de palavras.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "curadoria", "mediacao", "educacao"), conta: r ? r.denuncias + r.anotacoes + r.retidos : undefined },
      { id: "reforco", nome: "Aula de reforço", sobre: "Dúvidas de estudantes esperando resposta.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "curadoria", "mentoria", "educacao"), conta: r?.reforco },
      { id: "mural", nome: "Mural dos Trabalhadores", sobre: "Anúncios esperando a decisão da coordenação ou da mediação.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "mediacao"), conta: r?.mural },
      { id: "boletim", nome: "Boletim do jornal", sobre: "Quem pediu para receber o jornal por e-mail.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "jornalismo") },
      { id: "pessoas", nome: "Voluntários e convites", sobre: "Convidar, confiar funções e acompanhar a equipe.", grupo: "Pessoas", mostra: lidera, conta: r?.candidaturas },
      { id: "horas", nome: "Horas e certificados", sobre: "Termo de adesão, horas de trabalho e certificados.", grupo: "Pessoas", mostra: voluntario, conta: r ? r.horas + r.testemunhar : undefined },
      { id: "site", nome: "Controles do site", sobre: "A faixa do alto e a pausa geral de envios.", grupo: "Site", mostra: lidera },
      { id: "abertura", nome: "Aviso de abertura", sobre: "O quadro que aparece quando o site abre.", grupo: "Site", mostra: lidera },
      { id: "podcast", nome: "Podcast", sobre: "Episódios da pauta à publicação: roteiro, gravação, versões, revisão, capas, cortes, agenda e entregas.", grupo: "Produção", mostra: can(eu, "coordenacao", "jornalismo", "design", "mediacao", "curadoria"), conta: podcast.dados ?? undefined },
      { id: "radio", nome: "Rádio", sobre: "Rádio Lúcia: canais, faixas, transmissão ao vivo e sugestão de emissoras.", grupo: "Site", mostra: can(eu, "coordenacao", "jornalismo") },
      { id: "apoiadores", nome: "Apoiadores", sobre: "Quem autorizou aparecer no mural de apoio.", grupo: "Site", mostra: lidera },
      { id: "seguranca", nome: "Segurança e sucessão", sobre: "Segundo fator obrigatório, vice e ordem de sucessão.", grupo: "Segurança", mostra: lidera },
      { id: "registro", nome: "Registro de atividades", sobre: "Tudo o que foi decidido, por quem e quando.", grupo: "Segurança", mostra: lidera },
      { id: "conta", nome: "Minha conta", sobre: "Seu nome, sua senha e a proteção da sua conta.", grupo: "Você", mostra: true },
    ] satisfies Secao[]
  ).filter((secao) => secao.mostra);

  const atual = secoes.find((secao) => secao.id === aba) ?? secoes[0];
  const ir = (id: string) => {
    setMenu(false);
    router.replace(`/${lang}/painel?aba=${id}`);
    window.scrollTo(0, 0);
  };
  const grupos = [...new Set(secoes.map((secao) => secao.grupo))];
  const funcao = voluntario ? [...new Set(eu.papeis.map((papel) => papeis[papel.papel]))].join(" · ") : "Comunidade";
  // O nome do ambiente diz de quem ele é: só a coordenação vê "Coordenação".
  const ambiente = lidera ? "Coordenação" : voluntario ? "Equipe" : "Comunidade";

  return (
    <div className="min-h-screen bg-parchment font-sans text-sm text-ink lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Barra do alto no celular: nome e botão do menu. */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between bg-[#17130e] px-4 py-3 text-[#efe4c8] lg:hidden">
        <span className="font-serif text-lg font-semibold">
          Instituto Lúcia <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[#c9a84a]">{ambiente}</span>
        </span>
        <button type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="menu-do-painel" className="cursor-pointer border border-[#5a4e3a] px-3 py-1.5">
          {menu ? "Fechar" : "Menu"}
        </button>
      </div>

      <aside id="menu-do-painel" className={`no-print bg-[#17130e] text-[#efe4c8] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-[#3a3226] ${menu ? "block" : "hidden"}`}>
        <div className="hidden items-center gap-3 px-5 pt-6 lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca-96.png" alt="" width={40} height={40} className="h-10 w-10" />
          <span>
            <span className="block font-serif text-xl font-semibold leading-none">Instituto Lúcia</span>
            <span className="mt-1 block font-mono text-[0.6rem] uppercase tracking-[0.3em] text-[#c9a84a]">{ambiente}</span>
          </span>
        </div>
        <nav aria-label="Seções do painel" className="flex-1 overflow-y-auto px-3 py-5 [scrollbar-color:#4a4032_transparent] [scrollbar-width:thin]">
          {grupos.map((grupo) => (
            <div key={grupo || "inicio"} className="mb-4">
              {grupo && <p className="px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[#8f8468]">{grupo}</p>}
              <ul>
                {secoes
                  .filter((secao) => secao.grupo === grupo)
                  .map((secao) => {
                    const ativa = secao.id === atual.id;
                    return (
                      <li key={secao.id}>
                        <button
                          type="button"
                          onClick={() => ir(secao.id)}
                          aria-current={ativa ? "page" : undefined}
                          className={`flex w-full cursor-pointer items-center justify-between gap-2 border-l-2 px-3 py-2 text-left ${ativa ? "border-[#c9a84a] bg-[#2a231a] font-semibold text-white" : "border-transparent text-[#d9cdb0] hover:bg-[#221c15] hover:text-white"}`}
                        >
                          <span>{secao.nome}</span>
                          {Boolean(secao.conta) && <span className="min-w-6 bg-[#c21f17] px-1.5 py-0.5 text-center font-mono text-[0.7rem] font-semibold leading-none text-white">{secao.conta}</span>}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-[#3a3226] px-4 py-4">
          <p className="flex items-center gap-3">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#efe4c8] font-semibold text-[#17130e]">{iniciais(eu.nome)}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{eu.nome}</span>
              <span className="block truncate text-xs text-[#b9ad90]">{funcao}</span>
            </span>
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <L href="/" className="underline hover:text-white">← Voltar ao site</L>
            <Tema />
            <button type="button" onClick={sair} className="cursor-pointer underline hover:text-white">Sair</button>
          </p>
        </div>
      </aside>

      <div className={menu ? "hidden lg:block" : ""}>
        <header className="no-print border-b border-rule bg-parchment-deep px-5 py-5 sm:px-8">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gold">{atual.grupo || ambiente}</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">{atual.nome}</h1>
          <p className="mt-1 text-ink-soft">{atual.sobre}</p>
        </header>
        <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
          {eu.suspenso && <p className="mb-6 border-l-2 border-oxblood pl-4 text-oxblood">Esta conta está suspensa: você pode ler, mas não enviar.</p>}
          {atual.id === "mesa" && <Mesa me={eu} resumo={r ?? null} recarregar={() => { recarregar(); resumo.recarregar(); }} ir={ir} />}
          {atual.id === "conversas" && <Conversas me={eu} lider={leads(eu)} />}
          {atual.id === "rede" && <Equipe lider={leads(eu)} />}
          {atual.id === "escrever" && <Escrever me={eu} />}
          {atual.id === "minhas" && <Fila key="minhas" me={eu} minhas />}
          {atual.id === "juntas" && <Fila key="juntas" me={eu} juntas />}
          {atual.id === "fila" && <Fila key="fila" me={eu} />}
          {atual.id === "triagem" && <Fila key="triagem" me={eu} triagem />}
          {atual.id === "materiais" && <Materiais me={eu} />}
          {atual.id === "comunidade" && <Comunidade me={eu} />}
          {atual.id === "reforco" && <Reforco />}
          {atual.id === "mural" && <MuralFila />}
          {atual.id === "boletim" && <Boletim />}
          {atual.id === "pessoas" && <Pessoas me={eu} />}
          {atual.id === "horas" && <Horas me={eu} />}
          {atual.id === "site" && <Site />}
          {atual.id === "abertura" && <AvisoDeAbertura />}
          {atual.id === "radio" && <RadioAdmin me={eu} />}
          {atual.id === "podcast" && <Podcast />}
          {atual.id === "apoiadores" && <Apoiadores />}
          {atual.id === "seguranca" && <SegurancaSucessao me={eu} />}
          {atual.id === "registro" && <RegistroDeAtividades />}
          {atual.id === "conta" && <Conta me={eu} recarregar={recarregar} sair={sair} />}
        </div>
      </div>
    </div>
  );
}

/** A primeira tela: só o que pede atenção agora. */
function Mesa({ me, resumo, recarregar, ir }: { me: Me; resumo: Resumo | null; recarregar: () => void; ir: (aba: string) => void }) {
  const { t } = useI18n();
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const r = resumo;
  const pendencias: [string, number, string][] = r
    ? (
        [
          ["Colegas chamaram você para trabalhar junto", r.juntas, "juntas"],
          ["Envios do público para a triagem", r.triagem ?? 0, "triagem"],
          ["Na fila de revisão", r.fila, "fila"],
          ["Aprovadas, esperando a publicação", r.aguardando_publicacao, "fila"],
          ["Pedidos de voluntariado", r.candidaturas, "pessoas"],
          ["Denúncias abertas", r.denuncias, "comunidade"],
          ["Anotações para olhar", r.anotacoes, "comunidade"],
          ["Mensagens esperando a mediação", r.retidos, "comunidade"],
          ["Pedidos de reforço", r.reforco, "reforco"],
          ["Horas para conferir", r.horas, "horas"],
          ["Certificados esperando a sua assinatura", r.testemunhar, "horas"],
          ["Anúncios do mural", r.mural, "mural"],
        ] as [string, number, string][]
      ).filter(([, total]) => total > 0)
    : [];

  return (
    <div className="space-y-9">
      <section>
        <h2 className="font-serif text-2xl font-semibold">Olá, {me.nome.split(" ")[0]}</h2>
        {me.papeis.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {me.papeis.map((papel) => (
              <li key={papel.id} title={oQueFaz[papel.papel]} className="border border-rule bg-parchment-deep px-3 py-1.5">
                <strong>{papeis[papel.papel]}</strong>
                {papel.disciplina && <span className="text-ink-soft"> · {nomeDaArea(papel.disciplina)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 max-w-2xl text-ink-soft">Você participa da comunidade e pode escrever e enviar contribuições. Para revisar, traduzir, ensinar ou cuidar de uma disciplina, peça uma função abaixo.</p>
        )}
      </section>

      <section>
        <h2 className={rotulo}>Esperando por você</h2>
        {pendencias.length === 0 ? (
          <p className="mt-3 border border-rule bg-parchment-deep px-4 py-5 text-ink-soft">{r ? "Nada pendente. Tudo em dia." : "Carregando…"}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendencias.map(([titulo, total, destino]) => (
              <button key={titulo} type="button" onClick={() => ir(destino)} className="flex cursor-pointer items-center gap-4 border border-rule bg-parchment-deep p-4 text-left hover:border-ink">
                <span className="font-serif text-4xl font-semibold leading-none">{total}</span>
                <span className="text-ink-soft">{titulo}</span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={botao} onClick={() => ir("escrever")}>Escrever</button>
          {me.papeis.length > 0 && <button type="button" className={botaoClaro} onClick={() => ir("conversas")}>Abrir as conversas</button>}
          {(r?.minhas ?? 0) > 0 && <button type="button" className={botaoClaro} onClick={() => ir("minhas")}>Meus envios ({r?.minhas})</button>}
        </p>
      </section>

      {me.papeis.length > 0 && <Situacao lidera={can(me, "coordenacao")} ir={ir} />}

      <Recados recarregar={recarregar} />

      {me.papeis.length === 0 && <Candidatura />}
    </div>
  );
}

/** Como o instituto está agora, em três quadros: quem é a equipe e, para a coordenação, o estado do site. */
function Situacao({ lidera, ir }: { lidera: boolean; ir: (aba: string) => void }) {
  const membros = useLista<Membro[]>("equipe_membros");
  const site = useLista<Controles>("site");
  const online = membros.dados?.filter((membro) => membro.online && !membro.eu).length ?? 0;
  const quadro = "border border-rule bg-parchment-deep p-4 text-left";
  const alerta = "border-2 border-oxblood bg-parchment-deep p-4 text-left";
  return (
    <section>
      <h2 className={rotulo}>Como estamos</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" onClick={() => ir("conversas")} className={`${quadro} cursor-pointer hover:border-ink`}>
          <span className="block text-ink-soft">Equipe</span>
          <span className="mt-1 block font-serif text-2xl font-semibold leading-tight">{membros.dados ? `${membros.dados.length} ${membros.dados.length === 1 ? "pessoa" : "pessoas"}` : "…"}</span>
          <span className="mt-1 block text-ink-soft">{online > 0 ? `${online} online agora` : "Ninguém mais online agora"}</span>
        </button>
        {site.dados &&
          (lidera ? (
            <>
              <button type="button" onClick={() => ir("site")} className={`${site.dados.pausa ? alerta : `${quadro} hover:border-ink`} cursor-pointer`}>
                <span className="block text-ink-soft">Envios do público</span>
                <span className={`mt-1 block font-serif text-2xl font-semibold leading-tight ${site.dados.pausa ? "text-oxblood" : ""}`}>{site.dados.pausa ? "Pausados" : "Abertos"}</span>
                <span className="mt-1 block text-ink-soft">{site.dados.pausa ? "Ninguém de fora envia nada até você reabrir" : "Mural, reforço, boletim, contribuições e comunidade"}</span>
              </button>
              <button type="button" onClick={() => ir("site")} className={`${quadro} cursor-pointer hover:border-ink`}>
                <span className="block text-ink-soft">Faixa do alto</span>
                <span className="mt-1 block font-serif text-2xl font-semibold leading-tight">{site.dados.faixa ? "Com chamado" : "Texto de sempre"}</span>
                <span className="mt-1 block truncate text-ink-soft">{site.dados.faixa || "Nenhum chamado no ar"}</span>
              </button>
            </>
          ) : (
            site.dados.pausa && (
              <div className={alerta}>
                <span className="block text-ink-soft">Envios do público</span>
                <span className="mt-1 block font-serif text-2xl font-semibold leading-tight text-oxblood">Pausados</span>
                <span className="mt-1 block text-ink-soft">A coordenação pausou o que vem de fora. O trabalho da equipe segue normal.</span>
              </div>
            )
          ))}
      </div>
    </section>
  );
}

/** Quem ainda não tem função pede uma aqui; a coordenação responde pelo próprio painel. */
function Candidatura() {
  const { t } = useI18n();
  const pedidos = useLista<{ id: string; papel: Role["papel"]; disciplina: string | null; status: string; criado_em: string }[]>("candidaturas_minhas");
  const pedido = useAcao(pedidos.recarregar);
  const [quero, setQuero] = useState<{ papel: string; disciplina: string; mensagem: string }>({ papel: "educacao", disciplina: "", mensagem: "" });
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "todo o site");
  return (
    <section className="border border-rule bg-parchment-deep p-5">
      <h2 className="font-serif text-2xl font-semibold">Quero ser voluntário</h2>
      <p className="mt-1 text-ink-soft">Diga em que quer ajudar e conte um pouco da sua experiência.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          Em que função
          <select value={quero.papel} onChange={(e) => setQuero({ ...quero, papel: e.target.value })} className={campo}>
            {(["educacao", "mentoria", "mediacao", "revisao", "traducao", "jornalismo", "curadoria", "design", "desenvolvimento"] as const).map((papel) => (
              <option key={papel} value={papel}>{papeis[papel]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Disciplina{quero.papel === "educacao" ? "" : " (opcional)"}
          <select value={quero.disciplina} onChange={(e) => setQuero({ ...quero, disciplina: e.target.value })} className={campo}>
            <option value="">{quero.papel === "educacao" ? "Escolha…" : "Todo o site"}</option>
            {areaSlugs.map((area) => (
              <option key={area} value={area}>{t.areas[area][0]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block">
        Sua experiência e por que quer ajudar
        <textarea value={quero.mensagem} onChange={(e) => setQuero({ ...quero, mensagem: e.target.value })} rows={3} maxLength={2000} className={campo} />
      </label>
      <p className="mt-1 text-ink-soft">{oQueFaz[quero.papel as Role["papel"]]}</p>
      <button
        type="button"
        className={`mt-3 ${botao}`}
        disabled={pedido.ocupado || quero.mensagem.trim().length < 20 || (quero.papel === "educacao" && !quero.disciplina)}
        onClick={async () => {
          const ok = await pedido.agir("candidatar", { p_papel: quero.papel, p_disciplina: quero.disciplina || null, p_mensagem: quero.mensagem }, "Pedido enviado à coordenação.");
          if (ok) setQuero({ ...quero, mensagem: "" });
        }}
      >
        Enviar pedido
      </button>
      <Aviso texto={pedido.aviso} />
      {(pedidos.dados?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1 text-ink-soft">
          {pedidos.dados?.map((item) => (
            <li key={item.id}>
              {papeis[item.papel]} · {nomeDaArea(item.disciplina)} · {data(item.criado_em)} · <span className={rotulo}>{situacoes[item.status] ?? item.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Tudo o que é da própria pessoa: como aparece, como entra e como se protege. */
function Conta({ me, recarregar, sair }: { me: Me; recarregar: () => void; sair: () => void }) {
  const perfil = useAcao(recarregar);
  const [nome, setNome] = useState(me.nome);
  const [bio, setBio] = useState(me.bio);
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const [avisoSenha, setAvisoSenha] = useState("");
  const [confirma, setConfirma] = useState(false);
  const [aviso, setAviso] = useState("");
  const cartao = "border border-rule bg-parchment-deep p-5";

  async function trocarSenha() {
    setAvisoSenha("");
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setSenha("");
      setRepete("");
      setAvisoSenha("Senha trocada.");
    } catch {
      setAvisoSenha("Não foi possível trocar a senha agora. Saia, entre de novo e tente outra vez.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Como você aparece</h2>
        <p className="mt-1 text-ink-soft">O nome assina o que você publica. O seu e-mail nunca aparece.</p>
        <label className="mt-3 block">
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className={campo} />
        </label>
        <label className="mt-3 block">
          Sobre você (opcional)
          <input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} className={campo} />
        </label>
        <button type="button" className={`mt-3 ${botao}`} disabled={perfil.ocupado} onClick={() => perfil.agir("perfil_salvar", { p_nome: nome, p_bio: bio }, "Perfil guardado.")}>
          Guardar
        </button>
        <Aviso texto={perfil.aviso} />
      </section>

      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Senha</h2>
        <p className="mt-1 text-ink-soft">Pelo menos 12 caracteres. Uma frase de quatro ou cinco palavras funciona bem.</p>
        <form onSubmit={(e) => { e.preventDefault(); void trocarSenha(); }}>
          <label className="mt-3 block">
            Senha nova
            <input type="password" autoComplete="new-password" minLength={12} maxLength={200} value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
          </label>
          <label className="mt-3 block">
            Repita a senha
            <input type="password" autoComplete="new-password" maxLength={200} value={repete} onChange={(e) => setRepete(e.target.value)} className={campo} />
          </label>
          <button type="submit" className={`mt-3 ${botao}`} disabled={senha.length < 12 || senha !== repete}>Trocar a senha</button>
        </form>
        <Aviso texto={avisoSenha} />
      </section>

      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Entrar com a digital</h2>
        <p className="mt-1 text-ink-soft">Cadastre a impressão digital deste celular e entre sem digitar a senha. A digital fica só no aparelho; a senha continua valendo como reserva.</p>
        <div className="mt-3">
          <Digital />
        </div>
      </section>

      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Segundo fator</h2>
        <p className="mt-1 text-ink-soft">Um código do aplicativo autenticador, além da senha. Quem descobre a sua senha continua do lado de fora.</p>
        <div className="mt-3">
          <SegundoFator me={me} recarregar={recarregar} />
        </div>
      </section>

      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Aparelhos</h2>
        <p className="mt-1 text-ink-soft">Onde esta conta já foi aberta. Não reconhece algum? Troque a senha e avise a coordenação.</p>
        <div className="mt-3">
          <Aparelhos />
        </div>
      </section>

      <section className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-5">
          <button type="button" className={botaoClaro} onClick={sair}>Sair do painel</button>
          {confirma ? (
            <button
              type="button"
              className="cursor-pointer bg-oxblood px-5 py-2 font-medium text-parchment"
              onClick={async () => {
                try {
                  await rpc("conta_apagar");
                  sair();
                } catch (erro) {
                  setAviso(textoDoErro(erro));
                }
              }}
            >
              Confirmar: apagar minha conta
            </button>
          ) : (
            <button type="button" className={elo} onClick={() => setConfirma(true)}>Apagar minha conta</button>
          )}
        </div>
        <p className="mt-2 text-ink-soft">Apagar a conta remove o perfil, as funções e os votos. O que já foi publicado continua no acervo.</p>
        <Aviso texto={aviso} />
      </section>
    </div>
  );
}
