// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { getClient, rpc } from "@/lib/backend";
import { diasAteVencer, fraseDoToken, nivelDoToken } from "@/lib/operacao";
import { dataHora, textoDoErro, useLista } from "./comum";
import { Botao, Campo, confirmar, notificar, Vazio } from "./ui";

interface Situacao {
  registros: { quando: string; acao: string; fase: string; detalhe: string }[];
  ultima_limpeza: string | null;
  instagram: { definido: boolean; expira?: string; dias?: number; nivel: string };
}
interface Ligado {
  publicacao: boolean;
  backup: boolean;
  cache: boolean;
}

const NOME_DA_ACAO: Record<string, string> = { limpar_cache: "Limpar o cache", ver_publicacao: "Ver a publicação", ver_backup: "Ver a cópia do banco" };
const NOME_DA_FASE: Record<string, string> = { pedida: "pedida", ok: "deu certo", falhou: "falhou" };

/**
 * Operação do site (Etapa 8, backend-2; molde Configuração): o estado da última publicação, da última cópia do banco, a limpeza do
 * cache e o aviso de vencimento do token do Instagram. Só coordenação e vice. Os tokens dos serviços ficam no servidor
 * (app/api/painel/operacao); aqui só chega uma frase curta.
 */
export function Operacao() {
  const situacao = useLista<Situacao>("operacao_situacao", {}, { quieta: true });
  const [ligado, setLigado] = useState<Ligado | null>(null);
  const [ocupado, setOcupado] = useState("");
  const [frases, setFrases] = useState<Record<string, { ok: boolean; texto: string }>>({});

  useEffect(() => {
    let vivo = true;
    getClient()
      .then((supabase) => supabase.auth.getSession())
      .then(({ data }) => fetch("/api/painel/operacao", { headers: data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {} }))
      .then((r) => r.json())
      .then((r: { ligado?: Ligado }) => vivo && setLigado(r.ligado ?? null))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  async function pedir(acao: "ver_publicacao" | "ver_backup" | "limpar_cache") {
    if (acao === "limpar_cache" && !(await confirmar({ titulo: "Limpar o cache de todo o site?", texto: "As páginas guardadas no Cloudflare saem e o site é refeito aos poucos, o que gasta cota da hospedagem. Use quando uma mudança não aparece. Dá para fazer até 3 vezes por hora.", confirmar: "Limpar o cache" }))) return;
    setOcupado(acao);
    try {
      const supabase = await getClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch("/api/painel/operacao", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ acao }) });
      const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; detalhe?: string; erro?: string };
      const texto = corpo.detalhe ?? corpo.erro ?? "Não deu para fazer agora.";
      setFrases((f) => ({ ...f, [acao]: { ok: Boolean(r.ok && corpo.ok), texto } }));
      (r.ok && corpo.ok ? notificar.ok : notificar.erro)(texto);
      situacao.recarregar();
    } catch {
      notificar.erro("Não deu para fazer agora.");
    } finally {
      setOcupado("");
    }
  }

  const botaoDa = (acao: "ver_publicacao" | "ver_backup" | "limpar_cache", campo: keyof Ligado, rotulo: string, principal = false) => (
    <Botao variante={principal ? "principal" : "padrao"} disabled={!ligado?.[campo] || Boolean(ocupado)} onClick={() => void pedir(acao)}>
      {ocupado === acao ? "Um instante..." : rotulo}
    </Botao>
  );

  return (
    <div className="max-w-3xl space-y-8">
      <section aria-labelledby="op-publicacao" className="space-y-2">
        <h2 id="op-publicacao" className="pn-secao-titulo">Publicação e cópia do banco</h2>
        <p className="pn-ajuda">Olha a última publicação de produção (Vercel) e a última rodada da cópia semanal do banco (rotina backup.yml). Cada botão só aparece ligado quando a ligação foi feita no servidor (docs/backend-2.md).</p>
        <div className="flex flex-wrap gap-2">
          {botaoDa("ver_publicacao", "publicacao", "Ver a publicação")}
          {botaoDa("ver_backup", "backup", "Ver a cópia do banco")}
        </div>
        {ligado && !ligado.publicacao && !ligado.backup && <p className="pn-ajuda">Nenhuma das duas ligações foi feita ainda.</p>}
        <ul className="space-y-1" aria-live="polite">
          {(["ver_publicacao", "ver_backup"] as const).map((a) => frases[a] && (
            <li key={a} className={frases[a].ok ? "" : "text-oxblood"}><strong>{NOME_DA_ACAO[a]}:</strong> {frases[a].texto}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="op-cache" className="space-y-2">
        <h2 id="op-cache" className="pn-secao-titulo">Cache do site</h2>
        <p className="pn-ajuda">O Cloudflare guarda as páginas por até 4 horas. A rotina de publicação já limpa sozinha; este botão é para quando algo não aparece.{situacao.dados?.ultima_limpeza ? ` Última limpeza por aqui: ${dataHora(situacao.dados.ultima_limpeza)}.` : ""}</p>
        {botaoDa("limpar_cache", "cache", "Limpar o cache", true)}
        {frases.limpar_cache && <p role="status" className={frases.limpar_cache.ok ? "" : "text-oxblood"}>{frases.limpar_cache.texto}</p>}
      </section>

      <TokenDoInstagram estado={situacao.dados?.instagram} aoSalvar={situacao.recarregar} />

      <section aria-labelledby="op-registro" className="space-y-2">
        <h2 id="op-registro" className="pn-secao-titulo">O que foi pedido por aqui</h2>
        {situacao.erro && <p role="alert" className="text-oxblood">{situacao.erro}</p>}
        {situacao.dados && situacao.dados.registros.length === 0 && <Vazio titulo="Nada ainda" texto="Os últimos 20 pedidos desta tela aparecem aqui." />}
        <ul className="space-y-1">
          {situacao.dados?.registros.map((r, i) => (
            <li key={`${r.quando}-${i}`}>
              {dataHora(r.quando)}: {NOME_DA_ACAO[r.acao] ?? r.acao}, {NOME_DA_FASE[r.fase] ?? r.fase}.{r.detalhe ? ` ${r.detalhe}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Guarda só a DATA de vencimento do token do Instagram (nunca o token). Avisa a coordenação por e-mail em 14, 7, 3 e 1 dia. */
function TokenDoInstagram({ estado, aoSalvar }: { estado?: Situacao["instagram"]; aoSalvar: () => void }) {
  const [data, setData] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const dias = estado?.definido && typeof estado.dias === "number" ? estado.dias : null;
  // Sem hoje no cliente para recalcular: o banco já manda "dias"; o nível vem das mesmas faixas.
  const nivel = estado?.definido ? nivelDoToken(dias) : "indefinido";
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD, no mesmo dia do banco (Brasília)
  const previa = data ? diasAteVencer(data, hoje) : null;

  async function salvar() {
    setOcupado(true);
    try {
      await rpc("instagram_token_validade_salvar", { p_expira: data });
      notificar.ok("Data anotada. Você recebe um e-mail quando faltarem 14, 7, 3 e 1 dia.");
      setData("");
      aoSalvar();
    } catch (e) {
      notificar.erro(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="op-instagram" className="space-y-2">
      <h2 id="op-instagram" className="pn-secao-titulo">Token do Instagram</h2>
      <p className="pn-ajuda">O estúdio de design publica no Instagram com um token que vence. Aqui fica só a data (o token em si mora na Vercel). Ao gerar um token novo, anote a data nova.</p>
      <p role="status" className={nivel === "urgente" || nivel === "vencido" ? "text-oxblood font-semibold" : ""}>
        {estado?.definido ? `${fraseDoToken(dias)} (vence em ${estado.expira?.split("-").reverse().join("/")}).` : fraseDoToken(null)}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Vence em" type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} />
        <Botao variante="principal" disabled={!data || ocupado} onClick={() => void salvar()}>Anotar a data</Botao>
      </div>
      {previa !== null && <p className="pn-ajuda">{fraseDoToken(previa)}</p>}
    </section>
  );
}
