// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { getClient } from "@/lib/backend";
import { semanaDe } from "@/lib/lambe-do-dia";
import { Aviso, dataHora, useAcao, useLista } from "./comum";
import { Abas, Area, Botao, Campo, confirmar, notificar, perguntarTexto, Selecao, Vazio } from "./ui";

// Back-end novo, parte 1 (Etapa 8). Duas seções do painel: "Controles avançados" (Site e operação) e "Confirmações" (Segurança).
// Cada tela chama uma função public.* de supabase/migracoes/2026-11-backend-1.sql; quem confere o papel é sempre o banco.
// Texto do pacote: docs/backend-1.md.

async function tokenDaSessao(): Promise<string | undefined> {
  try {
    const supabase = await getClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  } catch {
    return undefined;
  }
}

async function pedirAoServidor(caminho: string, metodo: "GET" | "POST", corpo?: unknown): Promise<{ ok: boolean; dados: Record<string, unknown> }> {
  const token = await tokenDaSessao();
  const r = await fetch(caminho, { method: metodo, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo ? { "Content-Type": "application/json" } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, dados };
}

const NOMES_DE_RECURSO: Record<string, string> = {
  escola: "Escola Lúcia Maria",
  "vale-o-escrito": "Vale o Escrito",
  "rede-v2": "Rede Lúcia v2",
};

// ───────────────────────── 1. Recursos ─────────────────────────

interface EstadoDosRecursos {
  recursos: { nome: string; so_pelo_nome: boolean; decisao: boolean | null; em: string | null; aguardando: boolean }[];
}

function Recursos() {
  const lista = useLista<EstadoDosRecursos>("recursos_estado");
  const acao = useAcao(lista.recarregar);
  async function ajustar(nome: string, ligar: boolean | null) {
    let motivo = "";
    if (ligar && lista.dados?.recursos.find((r) => r.nome === nome)?.so_pelo_nome) {
      const m = await perguntarTexto(`Por que ligar ${NOMES_DE_RECURSO[nome] ?? nome}?\nOutra pessoa da coordenação precisa confirmar depois, em Segurança › Confirmações.`, "", { obrigatorio: true });
      if (!m) return;
      motivo = m;
    }
    const r = await acao.agir("recurso_ajustar", { p_nome: nome, p_ligar: ligar, p_motivo: motivo }, ligar === null ? "Decisão apagada: vale a variável de montagem." : "Feito.");
    if (r && (r as { aguardando?: boolean }).aguardando) notificar.info("Pedido aberto: falta a confirmação de uma segunda pessoa.");
  }
  return (
    <div className="pn-tela">
      <p className="pn-ajuda">
        Liga ou desliga um recurso sem publicar o site de novo; o site lê esta lista a cada minuto. Desligar vale na hora. Ligar a Escola, o Vale o Escrito e a Rede v2 pede a confirmação de uma segunda pessoa. Páginas já geradas na montagem só mudam quando forem geradas de novo.
      </p>
      <Aviso texto={lista.erro || acao.aviso} />
      <ul className="pn-lista-simples">
        {(lista.dados?.recursos ?? []).map((r) => (
          <li key={r.nome} className="pn-linha-simples">
            <div>
              <strong>{NOMES_DE_RECURSO[r.nome] ?? r.nome}</strong> <code>{r.nome}</code>
              <p className="pn-ajuda">
                {r.decisao === null ? "Sem decisão do painel: vale a variável de montagem." : r.decisao ? `Ligado pelo painel${r.em ? ` em ${dataHora(r.em)}` : ""}.` : `Desligado pelo painel${r.em ? ` em ${dataHora(r.em)}` : ""}.`}
                {r.so_pelo_nome ? " Só liga pelo nome." : ""}
                {r.aguardando ? " Pedido esperando uma segunda pessoa." : ""}
              </p>
            </div>
            <div className="pn-acoes">
              <Botao pequeno disabled={acao.ocupado || r.decisao === true || r.aguardando} onClick={() => ajustar(r.nome, true)}>
                Ligar
              </Botao>
              <Botao pequeno perigo disabled={acao.ocupado || r.decisao === false} onClick={() => ajustar(r.nome, false)}>
                Desligar
              </Botao>
              <Botao pequeno variante="discreto" disabled={acao.ocupado || r.decisao === null} onClick={() => ajustar(r.nome, null)}>
                Apagar decisão
              </Botao>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── 5 e 6. Limites e constantes ─────────────────────────

interface Limites {
  ajustados: { acao: string; maximo: number; minutos: number; em: string }[];
  vistos: { acao: string; pessoas: number; maior: number }[];
}

function LimitesAjustaveis() {
  const lista = useLista<Limites>("limites_listar");
  const acao = useAcao(lista.recarregar);
  const [nome, setNome] = useState("");
  const [maximo, setMaximo] = useState("30");
  const [minutos, setMinutos] = useState("60");
  return (
    <div className="pn-tela">
      <p className="pn-ajuda">O banco freia abuso contando pedidos por pessoa numa janela de tempo. Aqui a coordenação sobe ou desce um limite sem mexer no código. Sem ajuste, vale o número que está na função.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      <form
        className="pn-config-grupo"
        onSubmit={(e) => {
          e.preventDefault();
          void acao.agir("limite_ajustar", { p_acao: nome.trim(), p_maximo: Number(maximo), p_minutos: Number(minutos) }, "Limite ajustado.");
        }}
      >
        <Campo rotulo="Ação" ajuda="O nome da ação, como aparece na lista abaixo (letras minúsculas, números e _)." value={nome} onChange={(e) => setNome(e.target.value)} list="limites-vistos" required pattern="[a-z0-9_]{2,60}" />
        <datalist id="limites-vistos">
          {(lista.dados?.vistos ?? []).map((v) => (
            <option key={v.acao} value={v.acao} />
          ))}
        </datalist>
        <Campo rotulo="No máximo (pedidos)" type="number" min={1} max={5000} value={maximo} onChange={(e) => setMaximo(e.target.value)} required />
        <Campo rotulo="Por quantos minutos" type="number" min={1} max={1440} value={minutos} onChange={(e) => setMinutos(e.target.value)} required />
        <Botao type="submit" variante="principal" disabled={acao.ocupado}>
          Guardar limite
        </Botao>
      </form>
      <h3 className="pn-secao-titulo">Ajustados</h3>
      {(lista.dados?.ajustados ?? []).length === 0 && <Vazio titulo="Nenhum limite ajustado" texto="Todos valem o número do código." />}
      <ul className="pn-lista-simples">
        {(lista.dados?.ajustados ?? []).map((l) => (
          <li key={l.acao} className="pn-linha-simples">
            <span>
              <code>{l.acao}</code>: {l.maximo} a cada {l.minutos} min
            </span>
            <Botao pequeno variante="discreto" onClick={() => acao.agir("limite_restaurar", { p_acao: l.acao }, "Voltou ao padrão.")}>
              Restaurar padrão
            </Botao>
          </li>
        ))}
      </ul>
      <h3 className="pn-secao-titulo">Vistos nos últimos 2 dias</h3>
      <p className="pn-ajuda">Só contagem: quantas pessoas ou origens usaram a ação e o maior número numa janela. Nada que identifique alguém.</p>
      <ul className="pn-lista-simples">
        {(lista.dados?.vistos ?? []).map((v) => (
          <li key={v.acao} className="pn-linha-simples">
            <code>{v.acao}</code>
            <span className="pn-ajuda">
              {v.pessoas} · maior {v.maior}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Constantes {
  modelo: Record<string, string>;
  valores: Record<string, string>;
}
const ROTULOS_DE_CONSTANTE: Record<string, { nome: string; ajuda: string }> = {
  apoio_url: { nome: "Endereço da campanha de apoio", ajuda: "Começa com https://." },
  instagram_usuario: { nome: "Usuário do Instagram", ajuda: "Sem @ nem endereço." },
  contato_email: { nome: "E-mail de contato", ajuda: "O endereço para onde vão os pedidos do boletim." },
  historico_desde: { nome: "Histórico público desde", ajuda: "AAAA-MM-DD. Vazio: o site usa o valor do código." },
};

function ConstantesDoSite() {
  const lista = useLista<Constantes>("site_constantes_listar");
  const acao = useAcao(lista.recarregar);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const chaves = Object.keys(lista.dados?.modelo ?? {});
  return (
    <div className="pn-tela">
      <p className="pn-ajuda">Valores que antes só mudavam publicando o site. Campo vazio apaga a constante e o site volta ao valor do código. Só estas chaves existem; o banco confere o formato.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      {chaves.map((chave) => {
        const atual = lista.dados?.valores[chave] ?? "";
        const valor = rascunho[chave] ?? atual;
        const info = ROTULOS_DE_CONSTANTE[chave] ?? { nome: chave, ajuda: "" };
        return (
          <form
            key={chave}
            className="pn-config-grupo"
            onSubmit={(e) => {
              e.preventDefault();
              void acao.agir("site_constante_gravar", { p_chave: chave, p_valor: valor }, "Guardado.").then(() => setRascunho((r) => ({ ...r, [chave]: undefined as unknown as string })));
            }}
          >
            <Campo rotulo={info.nome} ajuda={info.ajuda} value={valor} onChange={(e) => setRascunho((r) => ({ ...r, [chave]: e.target.value }))} />
            <Botao type="submit" disabled={acao.ocupado || valor === atual}>
              Guardar
            </Botao>
          </form>
        );
      })}
    </div>
  );
}

// ───────────────────────── 7. Destaques e aula da semana ─────────────────────────

interface Destaques {
  destaques: { posicao: number; caminho: string; titulo: string; resumo: string; ate: string | null }[];
  aulas: { semana: number; trilha: string; aula: string }[];
}

function DestaquesEAula() {
  const lista = useLista<Destaques>("destaques_listar");
  const acao = useAcao(lista.recarregar);
  const [d, setD] = useState({ posicao: "1", caminho: "", titulo: "", resumo: "", ate: "" });
  const agora = semanaDe(new Date());
  const [a, setA] = useState({ semana: String(agora), trilha: "", aula: "" });
  return (
    <div className="pn-tela">
      <p className="pn-ajuda">Escolha à mão o que a página inicial destaca (até 6, com data de fim opcional) e qual aula vale numa semana. Sem escolha, o site faz o sorteio de sempre.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      <h3 className="pn-secao-titulo">Destaques da página inicial</h3>
      <form
        className="pn-config-grupo"
        onSubmit={(e) => {
          e.preventDefault();
          void acao.agir("destaque_salvar", { p_posicao: Number(d.posicao), p_caminho: d.caminho.trim(), p_titulo: d.titulo, p_resumo: d.resumo, p_ate: d.ate || null }, "Destaque guardado.");
        }}
      >
        <Selecao rotulo="Posição" value={d.posicao} onChange={(e) => setD({ ...d, posicao: e.target.value })}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Selecao>
        <Campo rotulo="Endereço no site" ajuda="Ex.: /trilhas/nome-da-trilha. Só páginas do próprio site." value={d.caminho} onChange={(e) => setD({ ...d, caminho: e.target.value })} required pattern="/[a-z0-9/_-]{1,160}" />
        <Campo rotulo="Título" value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} required minLength={3} maxLength={120} />
        <Campo rotulo="Resumo (opcional)" value={d.resumo} onChange={(e) => setD({ ...d, resumo: e.target.value })} maxLength={240} />
        <Campo rotulo="Até (opcional)" type="date" value={d.ate} onChange={(e) => setD({ ...d, ate: e.target.value })} />
        <Botao type="submit" variante="principal" disabled={acao.ocupado}>
          Guardar destaque
        </Botao>
      </form>
      <ul className="pn-lista-simples">
        {(lista.dados?.destaques ?? []).map((x) => (
          <li key={x.posicao} className="pn-linha-simples">
            <span>
              {x.posicao}. <strong>{x.titulo}</strong> <code>{x.caminho}</code>
              {x.ate ? ` · até ${x.ate.split("-").reverse().join("/")}` : ""}
            </span>
            <Botao pequeno perigo variante="discreto" onClick={() => acao.agir("destaque_remover", { p_posicao: x.posicao }, "Destaque tirado.")}>
              Tirar
            </Botao>
          </li>
        ))}
      </ul>
      <h3 className="pn-secao-titulo">Aula da semana</h3>
      <form
        className="pn-config-grupo"
        onSubmit={(e) => {
          e.preventDefault();
          void acao.agir("aula_semana_definir", { p_semana: Number(a.semana), p_trilha: a.trilha.trim(), p_aula: a.aula.trim() }, "Aula da semana guardada.");
        }}
      >
        <Selecao rotulo="Semana" value={a.semana} onChange={(e) => setA({ ...a, semana: e.target.value })}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={agora + n}>
              {n === 0 ? "Esta semana" : `Daqui a ${n} semana${n > 1 ? "s" : ""}`} ({agora + n})
            </option>
          ))}
        </Selecao>
        <Campo rotulo="Trilha" ajuda="O endereço da trilha, como em /trilhas/<trilha>/<aula>." value={a.trilha} onChange={(e) => setA({ ...a, trilha: e.target.value })} required pattern="[a-z0-9-]{2,80}" />
        <Campo rotulo="Aula" value={a.aula} onChange={(e) => setA({ ...a, aula: e.target.value })} required pattern="[a-z0-9-]{1,100}" />
        <Botao type="submit" variante="principal" disabled={acao.ocupado}>
          Guardar aula da semana
        </Botao>
      </form>
      <ul className="pn-lista-simples">
        {(lista.dados?.aulas ?? []).map((x) => (
          <li key={x.semana} className="pn-linha-simples">
            <span>
              Semana {x.semana}: <code>{x.trilha}/{x.aula}</code>
            </span>
            <Botao pequeno variante="discreto" onClick={() => acao.agir("aula_semana_limpar", { p_semana: x.semana }, "Voltou ao sorteio.")}>
              Voltar ao sorteio
            </Botao>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── 8. Texto de apresentação da trilha ─────────────────────────

const IDIOMAS = [
  ["pt", "Português"],
  ["en", "English (rascunho)"],
  ["es", "Español (rascunho)"],
  ["fr", "Français (rascunho)"],
  ["ru", "Русский (rascunho)"],
  ["zh", "中文 (rascunho)"],
];

function ApresentacaoDaTrilha() {
  const lista = useLista<{ slug: string; idioma: string; texto: string; em: string }[]>("trilhas_apresentacao_listar");
  const acao = useAcao(lista.recarregar);
  const [slug, setSlug] = useState("");
  const [idioma, setIdioma] = useState("pt");
  const [texto, setTexto] = useState("");
  return (
    <div className="pn-tela">
      <p className="pn-ajuda">Um parágrafo de apresentação no alto da trilha, escrito por quem cuida do currículo. Texto vazio apaga e a trilha volta ao resumo do arquivo.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      <form
        className="pn-config-grupo"
        onSubmit={(e) => {
          e.preventDefault();
          void acao.agir("trilha_apresentacao_salvar", { p_slug: slug.trim(), p_idioma: idioma, p_texto: texto }, "Apresentação guardada.");
        }}
      >
        <Campo rotulo="Trilha" ajuda="O endereço da trilha: /trilhas/<este-nome>." value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]{2,80}" />
        <Selecao rotulo="Idioma" value={idioma} onChange={(e) => setIdioma(e.target.value)}>
          {IDIOMAS.map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </Selecao>
        <Area rotulo="Texto de apresentação" rows={5} maxLength={1200} value={texto} onChange={(e) => setTexto(e.target.value)} ajuda={`${texto.length}/1200`} />
        <Botao type="submit" variante="principal" disabled={acao.ocupado}>
          Guardar
        </Botao>
      </form>
      <ul className="pn-lista-simples">
        {(lista.dados ?? []).map((t) => (
          <li key={`${t.slug}/${t.idioma}`} className="pn-linha-simples">
            <span>
              <code>
                {t.slug} · {t.idioma}
              </code>
              <span className="pn-ajuda"> {t.texto.slice(0, 120)}</span>
            </span>
            <Botao
              pequeno
              variante="discreto"
              onClick={() => {
                setSlug(t.slug);
                setIdioma(t.idioma);
                setTexto(t.texto);
              }}
            >
              Editar
            </Botao>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── 9 e 10. Conteúdo em arquivo e correções ─────────────────────────

interface PR {
  id: string;
  caminho: string;
  numero: number;
  url: string;
  tipo: string;
  em: string;
}
interface Correcao {
  id: string;
  caminho: string;
  trecho: string;
  troca: string;
  motivo: string;
  status: "proposta" | "aprovada" | "aplicada" | "recusada";
  minha: boolean;
  proposta_em: string;
  nota: string;
  pr_url: string;
}

function ConteudoEmArquivo({ decide }: { decide: boolean }) {
  const prs = useLista<PR[]>("conteudo_prs_listar");
  const correcoes = useLista<Correcao[]>("correcoes_listar");
  const acao = useAcao(() => {
    prs.recarregar();
    correcoes.recarregar();
  });
  const [caminho, setCaminho] = useState("");
  const [texto, setTexto] = useState<string | null>(null);
  const [resumo, setResumo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [c, setC] = useState({ caminho: "", trecho: "", troca: "", motivo: "" });

  async function abrir() {
    setOcupado(true);
    setAviso("");
    const r = await pedirAoServidor(`/api/painel/conteudo?caminho=${encodeURIComponent(caminho.trim())}`, "GET");
    setOcupado(false);
    if (r.ok) setTexto(String(r.dados.texto ?? ""));
    else setAviso(String(r.dados.erro ?? "Não deu para abrir o arquivo."));
  }
  async function enviar() {
    if (texto === null) return;
    setOcupado(true);
    const r = await pedirAoServidor("/api/painel/conteudo", "POST", { caminho: caminho.trim(), texto, resumo });
    setOcupado(false);
    if (r.ok) {
      setAviso(`PR aberto: ${String(r.dados.url)}. Nada foi publicado; alguém precisa ler e juntar.`);
      setTexto(null);
      prs.recarregar();
    } else setAviso(String(r.dados.erro ?? "Não deu para abrir o PR."));
  }
  async function aplicar(id: string) {
    setOcupado(true);
    const r = await pedirAoServidor("/api/painel/correcoes", "POST", { id });
    setOcupado(false);
    setAviso(r.ok ? `PR aberto: ${String(r.dados.url)}` : String(r.dados.erro ?? "Não deu para aplicar."));
    correcoes.recarregar();
    prs.recarregar();
  }
  async function decidir(x: Correcao, aprovar: boolean) {
    const nota = aprovar ? "" : ((await perguntarTexto("Por que recusar esta correção?", "", { obrigatorio: true })) ?? null);
    if (nota === null) return;
    if (aprovar && !(await confirmar({ titulo: "Aprovar e abrir o PR?", texto: "A correção vira um PR no GitHub. Nada vai ao ar até alguém ler e juntar.", confirmar: "Aprovar" }))) return;
    const r = await acao.agir("correcao_decidir", { p_id: x.id, p_aprovar: aprovar, p_nota: nota }, aprovar ? "Aprovada." : "Recusada.");
    // Aprovada, a correção segue sozinha para o PR (a rota confere de novo no banco que está aprovada).
    if (r && aprovar) await aplicar(x.id);
  }

  return (
    <div className="pn-tela">
      <p className="pn-ajuda">
        Edite um arquivo de conteúdo (Markdown) daqui: o texto novo vira um branch e um PR no GitHub, para ser lido antes de publicar. Nunca vai ao ar sozinho. O PR não leva o seu nome. Só as pastas de aulas, páginas, glossário, professores, contribuir, falácias, debates e memorial.
      </p>
      <Aviso texto={aviso || prs.erro || correcoes.erro || acao.aviso} />
      <div className="pn-config-grupo">
        <Campo rotulo="Arquivo" ajuda="Ex.: content/paginas/conduta.md" value={caminho} onChange={(e) => setCaminho(e.target.value)} />
        <Botao disabled={ocupado || !caminho.trim()} onClick={abrir}>
          Abrir o arquivo
        </Botao>
        {texto !== null && (
          <>
            <Area rotulo="Texto do arquivo" rows={16} value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck />
            <Campo rotulo="O que mudou (vai no PR)" maxLength={200} value={resumo} onChange={(e) => setResumo(e.target.value)} />
            <Botao variante="principal" disabled={ocupado} onClick={enviar}>
              Abrir PR para revisão
            </Botao>
          </>
        )}
      </div>

      <h3 className="pn-secao-titulo">Propor uma correção</h3>
      <p className="pn-ajuda">Troca de um trecho exato. Quem propõe não aprova: outra pessoa da curadoria ou da coordenação decide, e a aprovada abre o PR sozinha.</p>
      <form
        className="pn-config-grupo"
        onSubmit={(e) => {
          e.preventDefault();
          void acao.agir("correcao_propor", { p_caminho: c.caminho.trim(), p_trecho: c.trecho, p_troca: c.troca, p_motivo: c.motivo }, "Proposta guardada: falta a aprovação de outra pessoa.").then((r) => r && setC({ caminho: "", trecho: "", troca: "", motivo: "" }));
        }}
      >
        <Campo rotulo="Arquivo" value={c.caminho} onChange={(e) => setC({ ...c, caminho: e.target.value })} required />
        <Area rotulo="Trecho atual (exato)" rows={3} value={c.trecho} onChange={(e) => setC({ ...c, trecho: e.target.value })} required minLength={3} maxLength={2000} />
        <Area rotulo="Trecho novo" rows={3} value={c.troca} onChange={(e) => setC({ ...c, troca: e.target.value })} maxLength={2000} />
        <Campo rotulo="Motivo" value={c.motivo} onChange={(e) => setC({ ...c, motivo: e.target.value })} maxLength={500} />
        <Botao type="submit" disabled={acao.ocupado}>
          Propor correção
        </Botao>
      </form>
      <ul className="pn-lista-simples">
        {(correcoes.dados ?? []).map((x) => (
          <li key={x.id} className="pn-linha-simples">
            <div>
              <strong>{x.status}</strong> · <code>{x.caminho}</code> · {dataHora(x.proposta_em)}
              <p className="pn-ajuda">
                “{x.trecho.slice(0, 120)}” vira “{x.troca.slice(0, 120)}”{x.motivo ? ` (${x.motivo})` : ""}
                {x.nota ? ` Nota: ${x.nota}` : ""}
              </p>
              {x.pr_url && (
                <a href={x.pr_url} target="_blank" rel="noopener noreferrer">
                  Ver o PR
                </a>
              )}
            </div>
            <div className="pn-acoes">
              {x.status === "proposta" && decide && !x.minha && (
                <>
                  <Botao pequeno onClick={() => decidir(x, true)} disabled={ocupado}>
                    Aprovar
                  </Botao>
                  <Botao pequeno perigo onClick={() => decidir(x, false)} disabled={ocupado}>
                    Recusar
                  </Botao>
                </>
              )}
              {x.status === "proposta" && x.minha && <span className="pn-ajuda">Espera outra pessoa</span>}
              {x.status === "aprovada" && decide && (
                <Botao pequeno onClick={() => aplicar(x.id)} disabled={ocupado}>
                  Abrir o PR de novo
                </Botao>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h3 className="pn-secao-titulo">PRs abertos pelo painel</h3>
      {(prs.dados ?? []).length === 0 && <Vazio titulo="Nenhum PR ainda" />}
      <ul className="pn-lista-simples">
        {(prs.dados ?? []).map((p) => (
          <li key={p.id} className="pn-linha-simples">
            <span>
              <code>{p.caminho}</code> · {p.tipo} · {dataHora(p.em)}
            </span>
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              PR #{p.numero}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── As duas seções ─────────────────────────

type AbaAvancada = "recursos" | "home" | "trilhas" | "constantes" | "limites" | "conteudo";

/** Site e operação › Controles avançados. "coordena": coordenação ou vice. "edita": também curadoria e desenvolvimento; "cura": quem aprova correções (coordenação, vice e curadoria). */
export function ControlesAvancados({ coordena, edita, cura = coordena }: { coordena: boolean; edita: boolean; cura?: boolean }) {
  const opcoes: { id: AbaAvancada; nome: string }[] = [
    ...(coordena ? ([{ id: "recursos", nome: "Recursos" }] as { id: AbaAvancada; nome: string }[]) : []),
    ...(edita
      ? ([
          { id: "home", nome: "Home e aula da semana" },
          { id: "trilhas", nome: "Apresentação das trilhas" },
          { id: "conteudo", nome: "Conteúdo e correções" },
        ] as { id: AbaAvancada; nome: string }[])
      : []),
    ...(coordena
      ? ([
          { id: "constantes", nome: "Constantes do site" },
          { id: "limites", nome: "Limites" },
        ] as { id: AbaAvancada; nome: string }[])
      : []),
  ];
  const [aba, setAba] = useState<AbaAvancada>(opcoes[0]?.id ?? "recursos");
  if (opcoes.length === 0) return <Vazio titulo="Sem acesso" texto="Estes controles são da coordenação, da curadoria e do desenvolvimento." />;
  return (
    <div>
      <Abas
        rotulo="Controles avançados"
        valor={aba}
        aoMudar={setAba}
        opcoes={opcoes}
        painel={(id) => (
          <>
            {id === "recursos" && <Recursos />}
            {id === "home" && <DestaquesEAula />}
            {id === "trilhas" && <ApresentacaoDaTrilha />}
            {id === "conteudo" && <ConteudoEmArquivo decide={cura} />}
            {id === "constantes" && <ConstantesDoSite />}
            {id === "limites" && <LimitesAjustaveis />}
          </>
        )}
      />
    </div>
  );
}

interface Confirmacao {
  id: string;
  tipo: "recurso" | "zerar_2fa" | "zerar_aparelhos" | "avaliacao_externa";
  alvo: string;
  alvo_nome: string;
  motivo: string;
  pedido_por: string;
  meu: boolean;
  pedido_em: string;
  expira_em: string;
  status: "aguardando" | "confirmada" | "recusada" | "cancelada" | "expirada";
}
const TITULO_DA_CONFIRMACAO: Record<Confirmacao["tipo"], (c: Confirmacao) => string> = {
  recurso: (c) => `Ligar ${NOMES_DE_RECURSO[c.alvo] ?? c.alvo}`,
  zerar_2fa: (c) => `Zerar o segundo fator de ${c.alvo_nome || "uma pessoa"}`,
  zerar_aparelhos: (c) => `Zerar os aparelhos de ${c.alvo_nome || "uma pessoa"}`,
  avaliacao_externa: () => "Ligar a segunda avaliação externa da Comunidade",
};

/** Segurança › Confirmações: pedidos que esperam uma segunda pessoa, zerar 2FA e aparelhos, segunda avaliação externa. */
export function Confirmacoes() {
  const lista = useLista<Confirmacao[]>("confirmacoes_listar");
  const pessoas = useLista<{ id: string; nome: string }[]>("zerar_pessoas", {}, { quieta: true });
  const avaliacao = useLista<{ ligada: boolean; aguardando: boolean }>("avaliacao_externa_estado");
  const acao = useAcao(() => {
    lista.recarregar();
    avaliacao.recarregar();
  });
  const [pessoa, setPessoa] = useState("");
  const [motivo, setMotivo] = useState("");
  const [privacidade, setPrivacidade] = useState(false);

  async function decidir(c: Confirmacao, aceitar: boolean) {
    if (aceitar && !(await confirmar({ titulo: `${TITULO_DA_CONFIRMACAO[c.tipo](c)}?`, texto: `Pedido de ${c.pedido_por}. Motivo: ${c.motivo || "não informado"}.`, confirmar: "Confirmar", perigo: c.tipo !== "recurso" }))) return;
    await acao.agir("confirmacao_decidir", { p_id: c.id, p_aceitar: aceitar }, aceitar ? "Confirmado e feito." : "Recusado.");
  }
  const abertas = (lista.dados ?? []).filter((c) => c.status === "aguardando");
  const antigas = (lista.dados ?? []).filter((c) => c.status !== "aguardando");

  return (
    <div className="pn-tela">
      <p className="pn-ajuda">Ações sensíveis precisam de duas pessoas da coordenação: uma pede, a outra confirma. Quem pediu não confirma o próprio pedido, e o pedido vence em 48 horas.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      <h3 className="pn-secao-titulo">Esperando confirmação</h3>
      {abertas.length === 0 && <Vazio titulo="Nada esperando" />}
      <ul className="pn-lista-simples">
        {abertas.map((c) => (
          <li key={c.id} className="pn-linha-simples">
            <div>
              <strong>{TITULO_DA_CONFIRMACAO[c.tipo](c)}</strong>
              <p className="pn-ajuda">
                Pedido de {c.pedido_por} em {dataHora(c.pedido_em)}. Vence {dataHora(c.expira_em)}. {c.motivo}
              </p>
            </div>
            <div className="pn-acoes">
              {c.meu ? (
                <Botao pequeno variante="discreto" onClick={() => acao.agir("confirmacao_cancelar", { p_id: c.id }, "Pedido cancelado.")}>
                  Cancelar meu pedido
                </Botao>
              ) : (
                <>
                  <Botao pequeno onClick={() => decidir(c, true)} disabled={acao.ocupado}>
                    Confirmar
                  </Botao>
                  <Botao pequeno perigo onClick={() => decidir(c, false)} disabled={acao.ocupado}>
                    Recusar
                  </Botao>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h3 className="pn-secao-titulo">Zerar segundo fator ou aparelhos</h3>
      <p className="pn-ajuda">Para quem perdeu o celular do aplicativo autenticador. Zerar o segundo fator também encerra as sessões abertas da conta; a pessoa recebe um recado e cadastra de novo. Os aparelhos zerados são só a lista de acessos (as chaves das conversas cifradas não são tocadas).</p>
      <div className="pn-config-grupo">
        <Selecao rotulo="Pessoa" value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
          <option value="">Escolha…</option>
          {(pessoas.dados ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
        <Campo rotulo="Motivo (obrigatório, aparece para quem confirma)" value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={10} maxLength={500} />
        <div className="pn-acoes">
          <Botao disabled={acao.ocupado || !pessoa || motivo.trim().length < 10} onClick={() => acao.agir("zerar_2fa_pedir", { p_usuario: pessoa, p_motivo: motivo }, "Pedido aberto: falta a confirmação de uma segunda pessoa.")}>
            Pedir para zerar o segundo fator
          </Botao>
          <Botao disabled={acao.ocupado || !pessoa || motivo.trim().length < 10} onClick={() => acao.agir("zerar_aparelhos_pedir", { p_usuario: pessoa, p_motivo: motivo }, "Pedido aberto: falta a confirmação de uma segunda pessoa.")}>
            Pedir para zerar os aparelhos
          </Botao>
        </div>
      </div>

      <h3 className="pn-secao-titulo">Segunda avaliação externa da Comunidade</h3>
      <p className="pn-ajuda">
        Ligada, o texto de cada mensagem da Comunidade (só o texto) é enviado a um serviço de moderação de uma empresa de fora do país. Isso é transferência internacional de dados (LGPD, Lei 13.709/2018, art. 33): a página de privacidade precisa estar atualizada no mesmo dia (docs/privacidade-avaliacao-automatica.md). Estado agora: {avaliacao.dados?.ligada ? "ligada" : "desligada"}
        {avaliacao.dados?.aguardando ? ", com pedido esperando uma segunda pessoa" : ""}.
      </p>
      <div className="pn-config-grupo">
        {!avaliacao.dados?.ligada && (
          <>
            <label className="pn-marca">
              <input type="checkbox" checked={privacidade} onChange={(e) => setPrivacidade(e.target.checked)} /> A página de privacidade já foi atualizada com este envio.
            </label>
            <Botao disabled={acao.ocupado || !privacidade || avaliacao.dados?.aguardando} onClick={() => acao.agir("avaliacao_externa_pedir", { p_ligar: true, p_privacidade_ok: true }, "Pedido aberto: falta a confirmação de uma segunda pessoa.")}>
              Pedir para ligar
            </Botao>
          </>
        )}
        {avaliacao.dados?.ligada && (
          <Botao perigo disabled={acao.ocupado} onClick={() => acao.agir("avaliacao_externa_pedir", { p_ligar: false }, "Segunda avaliação desligada.")}>
            Desligar agora
          </Botao>
        )}
      </div>

      {antigas.length > 0 && (
        <>
          <h3 className="pn-secao-titulo">Decididos</h3>
          <ul className="pn-lista-simples">
            {antigas.slice(0, 20).map((c) => (
              <li key={c.id} className="pn-linha-simples">
                <span>{TITULO_DA_CONFIRMACAO[c.tipo](c)}</span>
                <span className="pn-ajuda">
                  {c.status} · {dataHora(c.pedido_em)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
