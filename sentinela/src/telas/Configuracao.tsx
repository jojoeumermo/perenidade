// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { useEffect, useState } from "react";
import { Aviso, Cartao, Carregando, Titulo } from "../componentes/ui.tsx";
import { avisarMudanca, dono, ligacao, rpc, salvarLigacao, textoDoErro, useDados, type Eu } from "../lib/backend.ts";

interface Config {
  site: { url: string; dominio: string; paginas: string[]; terceiros_permitidos: string[]; app_url?: string };
  plataformas: { cloudflare_zona: string; vercel_projeto: string; vercel_equipe?: string; github_repositorio: string; supabase_site_url: string; supabase_site_ref: string; supabase_site_anon?: string };
  retencao: { eventos_dias: number; verificacoes_dias: number; agregados_dias: number };
}

export function Configuracao({ eu }: { eu: Eu }) {
  const { dados, erro } = useDados<Config>("configuracoes_ver", {}, 0);
  const [c, setC] = useState<Config | null>(null);
  const [aviso, setAviso] = useState("");
  const [ok, setOk] = useState("");
  const [lig, setLig] = useState(ligacao());
  useEffect(() => {
    if (dados && !c) setC(dados);
  }, [dados, c]);
  if (!c) return <Carregando erro={erro} />;
  const salvar = async (chave: keyof Config) => {
    setAviso("");
    setOk("");
    try {
      await rpc("configuracoes_salvar", { p_chave: chave, p: c[chave] });
      setOk("Guardado. O coletor usa na próxima passada.");
      avisarMudanca();
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  };
  const so = !dono(eu);
  const lista = (v: string[]) => v.join("\n");
  const deLista = (t: string) => t.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  return (
    <div>
      <Titulo sub="O que o coletor vigia. Nada secreto cabe aqui: os tokens das plataformas ficam só nos segredos do Worker (wrangler secret put).">Configuração</Titulo>
      <Aviso texto={aviso} />
      <Aviso texto={ok} ok />
      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao titulo="O site">
          <form className="space-y-2 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void salvar("site"); }}>
            <label className="block">Endereço<input className="campo" value={c.site.url} disabled={so} onChange={(e) => setC({ ...c, site: { ...c.site, url: e.target.value } })} /></label>
            <label className="block">Domínio (DNS, certificados, parecidos)<input className="campo" value={c.site.dominio} disabled={so} onChange={(e) => setC({ ...c, site: { ...c.site, dominio: e.target.value } })} /></label>
            <label className="block">Páginas vigiadas (uma por linha; a impressão de cada uma é comparada)<textarea className="campo mono text-xs" rows={6} value={lista(c.site.paginas)} disabled={so} onChange={(e) => setC({ ...c, site: { ...c.site, paginas: deLista(e.target.value) } })} /></label>
            <label className="block">Domínios de terceiros permitidos (os que o site carrega de propósito)<textarea className="campo mono text-xs" rows={4} value={lista(c.site.terceiros_permitidos)} disabled={so} onChange={(e) => setC({ ...c, site: { ...c.site, terceiros_permitidos: deLista(e.target.value) } })} /></label>
            <label className="block">Endereço do app publicado (para os links dos e-mails)<input className="campo" value={c.site.app_url ?? ""} disabled={so} onChange={(e) => setC({ ...c, site: { ...c.site, app_url: e.target.value } })} placeholder="https://sentinela.exemplo.vercel.app" /></label>
            {!so && <button type="submit" className="botao">Guardar</button>}
          </form>
        </Cartao>
        <Cartao titulo="As plataformas (só identificadores; os tokens ficam no Worker)">
          <form className="space-y-2 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void salvar("plataformas"); }}>
            {([["cloudflare_zona", "Zone ID da Cloudflare"], ["vercel_projeto", "ID do projeto na Vercel (prj_…)"], ["vercel_equipe", "ID da equipe na Vercel (team_…, se houver)"], ["github_repositorio", "Repositório no GitHub (dono/repo)"], ["supabase_site_url", "Endereço do Supabase DO SITE"], ["supabase_site_ref", "Ref do projeto do site (20 letras)"], ["supabase_site_anon", "Chave anon do site (pública; só para medir a saúde)"]] as const).map(([k, n]) => (
              <label key={k} className="block">{n}<input className="campo mono text-xs" value={c.plataformas[k] ?? ""} disabled={so} onChange={(e) => setC({ ...c, plataformas: { ...c.plataformas, [k]: e.target.value } })} /></label>
            ))}
            {!so && <button type="submit" className="botao">Guardar</button>}
          </form>
        </Cartao>
        <Cartao titulo="Retenção (dias)">
          <form className="grid gap-2 font-sans text-sm sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void salvar("retencao"); }}>
            {([["eventos_dias", "Eventos"], ["verificacoes_dias", "Verificações"], ["agregados_dias", "Agregados e alertas"]] as const).map(([k, n]) => <label key={k} className="block">{n}<input type="number" className="campo" min={7} max={1000} value={c.retencao[k]} disabled={so} onChange={(e) => setC({ ...c, retencao: { ...c.retencao, [k]: Number(e.target.value) } })} /></label>)}
            {!so && <div className="sm:col-span-3"><button type="submit" className="botao">Guardar</button></div>}
          </form>
          <p className="mt-2 font-sans text-xs text-ink-soft">O plano gratuito do Supabase tem 500 MB. Com 90 dias de eventos e 400 de agregados o Sentinela fica bem abaixo disso.</p>
        </Cartao>
        <Cartao titulo="Este aparelho: a que serviço o app fala">
          <form className="space-y-2 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); salvarLigacao(lig); setOk("Ligação guardada neste aparelho. Recarregue o app."); }}>
            <label className="block">Supabase do Sentinela<input className="campo" value={lig.url} onChange={(e) => setLig({ ...lig, url: e.target.value })} /></label>
            <label className="block">Chave anon do Sentinela<input className="campo mono text-xs" value={lig.anon} onChange={(e) => setLig({ ...lig, anon: e.target.value })} /></label>
            <label className="block">Coletor (Worker)<input className="campo" value={lig.worker} onChange={(e) => setLig({ ...lig, worker: e.target.value })} /></label>
            <button type="submit" className="botao-claro">Guardar neste aparelho</button>
          </form>
        </Cartao>
      </div>
    </div>
  );
}
