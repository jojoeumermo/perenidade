// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { Linha } from "../componentes/graficos.tsx";
import { Cartao, Carregando, Estado, NoAr, Tabela, Titulo } from "../componentes/ui.tsx";
import { useDados } from "../lib/backend.ts";
import { abrirFora } from "../lib/nativo.ts";
import { dataHora, faz } from "../lib/formato.ts";

interface Dados {
  deploys: { id: string; estado: string; ambiente: string; url: string; ramo: string; commit: string; mensagem: string; autor: string; criado_em: string; pronto_em: string | null }[];
  github: { id: string; tipo: string; gravidade: string; titulo: string; pacote: string; estado: string; url: string; criado_em: string }[];
  supabase: { alvo: string; no_ar: boolean; ms: number; em: string; status: number; erro: string }[];
  supabase_historico: { em: string; ms: number; no_ar: boolean }[];
  csp: { id: number; documento: string; diretiva: string; bloqueado: string; vezes: number; ultimo_em: string }[];
  emails: { pendentes: number; falhos: number; enviados_7d: number };
}

export function Plataforma() {
  const { dados, erro } = useDados<Dados>("plataforma_ver");
  if (!dados) return <Carregando erro={erro} />;
  const d = dados;
  const nomeAlvo: Record<string, string> = { supabase: "Entrada (auth)", "supabase:rest": "API (rest)", "supabase:storage": "Arquivos (storage)" };
  return (
    <div>
      <Titulo sub="Vercel, GitHub e o Supabase do site: o chão em que o site está de pé.">Plataforma</Titulo>
      <div className="grid gap-4 xl:grid-cols-3">
        <Cartao titulo="Deploys na Vercel" className="xl:col-span-2">
          <Tabela linhas={d.deploys} chave={(x) => x.id} colunas={[
            { nome: "Quando", valor: (x) => <span className="mono text-xs">{dataHora(x.criado_em)}</span> },
            { nome: "Estado", valor: (x) => <span className={`mono text-xs ${/ERROR|CANCELED/.test(x.estado) ? "font-semibold text-oxblood" : x.estado === "READY" ? "text-ok" : ""}`}>{x.estado}</span> },
            { nome: "Ambiente", valor: (x) => x.ambiente },
            { nome: "Ramo", valor: (x) => <span className={`mono text-xs ${x.ambiente === "production" && x.ramo && !["master", "main"].includes(x.ramo) ? "font-semibold text-oxblood" : ""}`}>{x.ramo || "—"}</span> },
            { nome: "Commit", valor: (x) => <span className="break-words"><span className="mono text-xs">{x.commit}</span> {x.mensagem}</span> },
            { nome: "Autor", valor: (x) => x.autor },
          ]} vazio="Nenhum deploy lido (o coletor precisa do token da Vercel e do projeto)." />
        </Cartao>
        <div className="space-y-4">
          <Cartao titulo="Supabase do site">
            <ul className="space-y-1 font-sans text-sm">
              {d.supabase.map((s) => <li key={s.alvo} className="flex items-center justify-between gap-2"><span>{nomeAlvo[s.alvo] ?? s.alvo}</span><span className="flex items-center gap-2"><NoAr valor={s.no_ar} /><span className="mono text-xs text-ink-soft">{s.ms} ms</span></span></li>)}
              {d.supabase.length === 0 && <li className="text-ink-soft">Sem leitura: configure o endereço do Supabase do site em Configuração.</li>}
            </ul>
            <div className="mt-3"><Linha dados={d.supabase_historico} chave="ms" nome="tempo de resposta" altura={110} /></div>
          </Cartao>
          <Cartao titulo="E-mails do Sentinela">
            <p className="font-sans text-sm"><span className="mono">{d.emails.enviados_7d}</span> enviados em 7 dias · <span className="mono">{d.emails.pendentes}</span> na fila · <span className={`mono ${d.emails.falhos ? "text-oxblood" : ""}`}>{d.emails.falhos}</span> falhos</p>
          </Cartao>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Cartao titulo="Alertas do GitHub (Dependabot, segredos, análise de código, rotinas)">
          <Tabela linhas={d.github} chave={(g) => g.id} colunas={[
            { nome: "Tipo", valor: (g) => g.tipo },
            { nome: "Grav.", valor: (g) => <span className={`mono text-xs ${/critical|high/.test(g.gravidade) ? "font-semibold text-oxblood" : ""}`}>{g.gravidade || "—"}</span> },
            { nome: "O quê", valor: (g) => (g.url ? <button type="button" className="text-left underline" onClick={() => void abrirFora(g.url)}>{g.titulo}</button> : g.titulo) },
            { nome: "Pacote", valor: (g) => <span className="mono text-xs">{g.pacote}</span> },
            { nome: "Estado", valor: (g) => <Estado valor={g.estado === "open" ? "aberto" : g.estado} /> },
            { nome: "Desde", valor: (g) => <span className="mono text-xs">{faz(g.criado_em)}</span> },
          ]} vazio="Nenhum alerta aberto no GitHub (ou o coletor ainda não tem o token)." />
        </Cartao>
        <Cartao titulo="Violações da política de segurança do conteúdo (CSP) relatadas pelos navegadores">
          <Tabela linhas={d.csp} chave={(c) => c.id} colunas={[
            { nome: "Página", valor: (c) => <span className="mono break-all text-xs">{c.documento.replace(/^https?:\/\/[^/]+/, "")}</span> },
            { nome: "Diretiva", valor: (c) => <span className="mono text-xs">{c.diretiva}</span> },
            { nome: "Bloqueado", valor: (c) => <span className="mono break-all text-xs">{c.bloqueado}</span> },
            { nome: "Vezes", valor: (c) => <span className="mono">{c.vezes}</span> },
            { nome: "Último", valor: (c) => <span className="mono text-xs">{faz(c.ultimo_em)}</span> },
          ]} vazio="Nenhum relato. Para receber, ponha o endereço do coletor (/csp) na variável CSP_REPORT_URL do site." />
        </Cartao>
      </div>
    </div>
  );
}
