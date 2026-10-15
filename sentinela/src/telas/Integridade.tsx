// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { useEffect, useState } from "react";
import { Abas, Cartao, Carregando, NoAr, Tabela, Titulo } from "../componentes/ui.tsx";
import { rpc, useDados } from "../lib/backend.ts";
import { dataHora, faz } from "../lib/formato.ts";

interface Dados {
  paginas: { alvo: string; hash: string | null; em: string; status: number; ms: number; versoes_7d: number; mudou_em: string | null }[];
  mudancas: { id: number; em: string; tipo: string; caminho: string; detalhes: Record<string, unknown> }[];
  dns: { nome: string; tipo: string; valores: string[]; em: string }[];
  dns_mudancas: { id: number; em: string; tipo: string; detalhes: { nome?: string; tipo?: string; de?: string[]; para?: string[] } }[];
  certificados: { crt_id: number; emissor: string; nome_comum: string; nomes: string[]; nao_antes: string; nao_depois: string; visto_em: string; conhecido: boolean }[];
  terceiros: { id: number; pagina: string; tipo: string; host: string; url: string; primeiro_em: string; visto_em: string; permitido: boolean }[];
  dominios: { dominio: string; resolve: boolean; registros: { A?: string[]; MX?: string[]; NS?: string[] }; primeiro_em: string; visto_em: string; mudou_em: string | null }[];
  cabecalhos: Record<string, string> | null;
  nota: number | null;
}

export function Integridade() {
  const [aba, setAba] = useState<"paginas" | "dns" | "certificados" | "terceiros" | "dominios" | "cabecalhos">("paginas");
  const { dados, erro } = useDados<Dados>("integridade_ver");
  useEffect(() => {
    void rpc("tela_vista", { p_tela: "integridade" }).catch(() => null);
  }, []);
  if (!dados) return <Carregando erro={erro} />;
  const d = dados;
  const nomeAlvo = (a: string) => (a === "site" ? "/" : a.replace("pagina:", ""));
  return (
    <div>
      <Titulo sub="O site continua sendo o site? Conteúdo, DNS, certificados, scripts de terceiros e domínios parecidos.">Integridade</Titulo>
      <Abas
        opcoes={[{ id: "paginas", nome: "Páginas" }, { id: "dns", nome: "DNS" }, { id: "certificados", nome: "Certificados", conta: d.certificados.filter((c) => !c.conhecido).length }, { id: "terceiros", nome: "Terceiros", conta: d.terceiros.filter((t) => !t.permitido).length }, { id: "dominios", nome: "Domínios parecidos", conta: d.dominios.filter((x) => x.resolve).length }, { id: "cabecalhos", nome: `Cabeçalhos${d.nota !== null ? ` · ${d.nota}` : ""}` }]}
        atual={aba}
        escolher={setAba}
      />
      {aba === "paginas" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Cartao titulo="Páginas vigiadas (impressão do conteúdo)" className="xl:col-span-2">
            <Tabela linhas={d.paginas} chave={(p) => p.alvo} colunas={[
              { nome: "Página", valor: (p) => <span className="mono">{nomeAlvo(p.alvo)}</span> },
              { nome: "Estado", valor: (p) => <><NoAr valor={p.status >= 200 && p.status < 400} /> <span className="mono text-xs">{p.status} · {p.ms} ms</span></> },
              { nome: "Impressão", valor: (p) => <span className="mono text-xs" title={p.hash ?? ""}>{p.hash?.slice(0, 12) ?? "—"}</span> },
              { nome: "Versões (7 d)", valor: (p) => <span className="mono">{p.versoes_7d}</span> },
              { nome: "Mudou", valor: (p) => <span className="mono text-xs">{p.mudou_em ? faz(p.mudou_em) : "—"}</span> },
            ]} />
            <p className="mt-2 font-sans text-xs text-ink-soft">A impressão ignora o que muda a cada deploy (nomes dos pacotes do Next). Mudança sem deploy correspondente vira alerta.</p>
          </Cartao>
          <Cartao titulo="Mudanças de conteúdo">
            {d.mudancas.length === 0 ? <p className="font-sans text-sm text-ink-soft">Nenhuma mudança registrada.</p> : (
              <ul className="divide-y divide-rule font-sans text-sm">{d.mudancas.map((m) => <li key={m.id} className="py-2"><span className="mono text-xs text-ink-soft">{dataHora(m.em)}</span><br /><span className="mono">{m.caminho}</span> · {m.tipo === "mudou_sem_deploy" ? <strong className="text-oxblood">sem deploy</strong> : "com deploy"}</li>)}</ul>
            )}
          </Cartao>
        </div>
      )}
      {aba === "dns" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Cartao titulo="Registros atuais" className="xl:col-span-2">
            <Tabela linhas={d.dns} chave={(r) => `${r.nome}|${r.tipo}`} colunas={[
              { nome: "Nome", valor: (r) => <span className="mono text-xs">{r.nome}</span> },
              { nome: "Tipo", valor: (r) => <span className="mono">{r.tipo}</span> },
              { nome: "Valores", valor: (r) => (r.valores.length ? <span className="mono break-all text-xs">{r.valores.join(" · ")}</span> : <span className="text-oxblood">(nenhum)</span>) },
              { nome: "Lido", valor: (r) => <span className="mono text-xs">{faz(r.em)}</span> },
            ]} vazio="O coletor ainda não leu o DNS (roda a cada 6 horas)." />
          </Cartao>
          <Cartao titulo="Mudanças">
            {d.dns_mudancas.length === 0 ? <p className="font-sans text-sm text-ink-soft">Nenhuma mudança desde a primeira leitura.</p> : (
              <ul className="divide-y divide-rule font-sans text-xs">{d.dns_mudancas.map((m) => <li key={m.id} className="py-2"><span className="mono text-ink-soft">{dataHora(m.em)}</span><br /><span className="mono">{m.detalhes.tipo} {m.detalhes.nome}</span>: {(m.detalhes.de ?? []).join(", ") || "(vazio)"} → <strong>{(m.detalhes.para ?? []).join(", ") || "(vazio)"}</strong></li>)}</ul>
            )}
          </Cartao>
        </div>
      )}
      {aba === "certificados" && (
        <Cartao titulo="Certificados emitidos para o domínio (CT logs, crt.sh)">
          <Tabela linhas={d.certificados} chave={(c) => c.crt_id} colunas={[
            { nome: "Emissor", valor: (c) => <span className={c.conhecido ? "" : "font-semibold text-oxblood"}>{c.emissor}{c.conhecido ? "" : " (desconhecido)"}</span> },
            { nome: "Nomes", valor: (c) => <span className="mono break-all text-xs">{c.nomes.join(", ")}</span> },
            { nome: "Válido de", valor: (c) => <span className="mono text-xs">{dataHora(c.nao_antes).slice(0, 10)}</span> },
            { nome: "até", valor: (c) => <span className="mono text-xs">{dataHora(c.nao_depois).slice(0, 10)}</span> },
            { nome: "CT", valor: (c) => <span className="mono text-xs">{c.crt_id}</span> },
          ]} vazio="Nenhum certificado lido ainda (o coletor consulta os CT logs a cada 6 horas)." />
        </Cartao>
      )}
      {aba === "terceiros" && (
        <Cartao titulo="Domínios de fora que as páginas carregam">
          <Tabela linhas={d.terceiros} chave={(t) => t.id} colunas={[
            { nome: "Domínio", valor: (t) => <span className={`mono ${t.permitido ? "" : "font-semibold text-oxblood"}`}>{t.host}</span> },
            { nome: "Tipo", valor: (t) => t.tipo },
            { nome: "Página", valor: (t) => <span className="mono text-xs">{t.pagina}</span> },
            { nome: "Lista", valor: (t) => (t.permitido ? <span className="text-ok">permitido</span> : <span className="text-oxblood">fora da lista</span>) },
            { nome: "Visto", valor: (t) => <span className="mono text-xs">desde {dataHora(t.primeiro_em).slice(0, 10)} · {faz(t.visto_em)}</span> },
          ]} vazio="As páginas não carregam nada de fora. Como deve ser." />
        </Cartao>
      )}
      {aba === "dominios" && (
        <Cartao titulo="Domínios parecidos com o do instituto">
          <Tabela linhas={d.dominios} chave={(x) => x.dominio} colunas={[
            { nome: "Domínio", valor: (x) => <span className={`mono ${x.resolve ? "font-semibold" : "text-ink-soft"}`}>{x.dominio}</span> },
            { nome: "Resolve", valor: (x) => (x.resolve ? <span className="text-oxblood">sim</span> : "não") },
            { nome: "A", valor: (x) => <span className="mono text-xs">{(x.registros.A ?? []).join(", ")}</span> },
            { nome: "E-mail (MX)", valor: (x) => <span className="mono text-xs">{(x.registros.MX ?? []).length ? "sim" : "—"}</span> },
            { nome: "Mudou", valor: (x) => <span className="mono text-xs">{x.mudou_em ? faz(x.mudou_em) : "—"}</span> },
          ]} vazio="Nenhum domínio parecido conferido ainda." />
          <p className="mt-2 font-sans text-xs text-ink-soft">Um domínio parecido que passa a resolver (e sobretudo a receber e-mail) é candidato a golpe em nome do instituto. Documente e, se preciso, denuncie ao registro.</p>
        </Cartao>
      )}
      {aba === "cabecalhos" && (
        <Cartao titulo={`Cabeçalhos de segurança da página inicial${d.nota !== null ? ` · nota ${d.nota}` : ""}`}>
          {d.cabecalhos ? (
            <dl className="font-sans text-xs">
              {Object.entries(d.cabecalhos).sort().map(([k, v]) => <div key={k} className="grid gap-1 border-b border-rule py-1.5 sm:grid-cols-[14rem_1fr]"><dt className="mono text-gold">{k}</dt><dd className="mono break-all">{v}</dd></div>)}
            </dl>
          ) : <p className="font-sans text-sm text-ink-soft">Sem leitura ainda.</p>}
        </Cartao>
      )}
    </div>
  );
}
