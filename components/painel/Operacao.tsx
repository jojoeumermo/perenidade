// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { DatabaseBackup, Eraser, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { getClient, rpc } from "@/lib/backend";
import { diasAteVencer, fraseDoToken, nivelDoToken } from "@/lib/operacao";
import { dataHora, textoDoErro, useLista } from "./comum";
import { Botao, Campo, Cartao, confirmar, Esqueleto, Faixa, ItemDeLista, Lista, notificar, Selo, type TomDoSelo, Vazio } from "./ui";

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
const TOM_DA_FASE: Record<string, TomDoSelo> = { pedida: "info", ok: "ok", falhou: "erro" };
const SIMBOLO_DA_ACAO = { limpar_cache: Eraser, ver_publicacao: Rocket, ver_backup: DatabaseBackup } as const;

/**
 * Operação do site (Etapa 8, backend-2; molde Configuração): o estado da última publicação, da última cópia do banco, a limpeza do
 * cache e o aviso de vencimento do token do Instagram. Só coordenação e vice. Os tokens dos serviços ficam no servidor
 * (app/api/painel/operacao); aqui só chega uma frase curta. Cada assunto num cartão; a resposta de cada pedido, numa faixa.
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
    <Botao variante={principal ? "principal" : "padrao"} simbolo={SIMBOLO_DA_ACAO[acao]} disabled={!ligado?.[campo] || Boolean(ocupado)} carregando={ocupado === acao} onClick={() => void pedir(acao)}>
      {ocupado === acao ? "Um instante..." : rotulo}
    </Botao>
  );

  return (
    <div className="pn-tela" style={{ maxWidth: "48rem" }}>
      <Cartao titulo="Publicação e cópia do banco" sobre="Olha a última publicação de produção (Vercel) e a última rodada da cópia semanal do banco (rotina backup.yml). Cada botão só aparece ligado quando a ligação foi feita no servidor (docs/backend-2.md).">
        <div className="pn-secao">
          <div className="flex flex-wrap gap-2">
            {botaoDa("ver_publicacao", "publicacao", "Ver a publicação")}
            {botaoDa("ver_backup", "backup", "Ver a cópia do banco")}
          </div>
          {ligado && !ligado.publicacao && !ligado.backup && <p className="pn-ajuda">Nenhuma das duas ligações foi feita ainda.</p>}
          <div className="pn-secao" aria-live="polite">
            {(["ver_publicacao", "ver_backup"] as const).map(
              (a) =>
                frases[a] && (
                  <Faixa key={a} tom={frases[a].ok ? "ok" : "erro"} titulo={`${NOME_DA_ACAO[a]}:`}>
                    {frases[a].texto}
                  </Faixa>
                ),
            )}
          </div>
        </div>
      </Cartao>

      <Cartao titulo="Cache do site" sobre={`O Cloudflare guarda as páginas por até 4 horas. A rotina de publicação já limpa sozinha; este botão é para quando algo não aparece.${situacao.dados?.ultima_limpeza ? ` Última limpeza por aqui: ${dataHora(situacao.dados.ultima_limpeza)}.` : ""}`}>
        <div className="pn-secao">
          <div>{botaoDa("limpar_cache", "cache", "Limpar o cache", true)}</div>
          {frases.limpar_cache && <Faixa tom={frases.limpar_cache.ok ? "ok" : "erro"}>{frases.limpar_cache.texto}</Faixa>}
        </div>
      </Cartao>

      <TokenDoInstagram estado={situacao.dados?.instagram} aoSalvar={situacao.recarregar} />

      <Cartao titulo="O que foi pedido por aqui">
        {situacao.erro && (
          <Faixa
            tom="erro"
            acao={
              <Botao pequeno onClick={situacao.recarregar}>
                Tentar de novo
              </Botao>
            }
          >
            {situacao.erro}
          </Faixa>
        )}
        {!situacao.dados && !situacao.erro && <Esqueleto linhas={3} />}
        {situacao.dados && situacao.dados.registros.length === 0 && <Vazio titulo="Nada ainda" texto="Os últimos 20 pedidos desta tela aparecem aqui." />}
        {situacao.dados && situacao.dados.registros.length > 0 && (
          <Lista rotulo="O que foi pedido por aqui" plana>
            {situacao.dados.registros.map((r, i) => (
              <ItemDeLista
                key={`${r.quando}-${i}`}
                simbolo={SIMBOLO_DA_ACAO[r.acao as keyof typeof SIMBOLO_DA_ACAO]}
                titulo={NOME_DA_ACAO[r.acao] ?? r.acao}
                meta={`${dataHora(r.quando)}${r.detalhe ? ` · ${r.detalhe}` : ""}`}
                selo={<Selo tom={TOM_DA_FASE[r.fase] ?? "neutro"}>{NOME_DA_FASE[r.fase] ?? r.fase}</Selo>}
              />
            ))}
          </Lista>
        )}
      </Cartao>
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
  const urgente = nivel === "urgente" || nivel === "vencido";

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
    <Cartao titulo="Token do Instagram" sobre="O estúdio de design publica no Instagram com um token que vence. Aqui fica só a data (o token em si mora na Vercel). Ao gerar um token novo, anote a data nova.">
      <div className="pn-secao">
        <Faixa tom={urgente ? "aviso" : estado?.definido ? "ok" : "info"}>{estado?.definido ? `${fraseDoToken(dias)} (vence em ${estado.expira?.split("-").reverse().join("/")}).` : fraseDoToken(null)}</Faixa>
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Vence em" type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} />
          <Botao disabled={!data} carregando={ocupado} onClick={() => void salvar()}>
            Anotar a data
          </Botao>
        </div>
        {previa !== null && <p className="pn-ajuda">{fraseDoToken(previa)}</p>}
      </div>
    </Cartao>
  );
}
