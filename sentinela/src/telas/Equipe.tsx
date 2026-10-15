// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
import { useState } from "react";
import { Abas, Aviso, Cartao, Carregando, Confirmar, Tabela, Titulo } from "../componentes/ui.tsx";
import { avisarMudanca, dono, modoDemo, rpc, supabase, textoDoErro, useDados, type Eu } from "../lib/backend.ts";
import { dataHora, faz, nomePapel } from "../lib/formato.ts";

interface Pessoa {
  id: string; nome: string; email: string; papel: string; ativo: boolean; criado_em: string; visto_em: string; segundo_fator: boolean | null;
}
interface Convite {
  id: string; email: string; papel: string; criado_em: string; expira_em: string; usado: boolean; revogado: boolean; vale: boolean;
}
interface Registro {
  id: number; quem: string | null; nome: string; acao: string; alvo: string; detalhes: Record<string, unknown>; criado_em: string;
}

export function Equipe({ eu, recarregarEu }: { eu: Eu; recarregarEu: () => void }) {
  const [aba, setAba] = useState<"pessoas" | "convites" | "eu" | "registro">("pessoas");
  const equipe = useDados<Pessoa[]>("equipe_listar", {}, 0);
  const [aviso, setAviso] = useState("");
  const [ok, setOk] = useState("");
  async function agir(fn: string, args: Record<string, unknown>, sucesso = "Feito.") {
    setAviso("");
    setOk("");
    try {
      const r = await rpc(fn, args);
      setOk(sucesso);
      avisarMudanca();
      equipe.recarregar();
      return r;
    } catch (e) {
      setAviso(textoDoErro(e));
      return null;
    }
  }
  return (
    <div>
      <Titulo sub="Até cinco pessoas: dono, analistas e leitores. Toda conta exige o aplicativo autenticador. Quem viu e fez o quê fica no registro.">Equipe e segurança</Titulo>
      <Abas opcoes={[{ id: "pessoas", nome: "Pessoas" }, ...(dono(eu) ? [{ id: "convites" as const, nome: "Convites" }] : []), { id: "eu", nome: "Minha conta" }, ...(dono(eu) ? [{ id: "registro" as const, nome: "Registro de atividades" }] : [])]} atual={aba} escolher={setAba} />
      <Aviso texto={aviso} />
      <Aviso texto={ok} ok />
      {aba === "pessoas" && (
        <Cartao>
          {!equipe.dados ? <Carregando erro={equipe.erro} /> : (
            <Tabela linhas={equipe.dados} chave={(p) => p.id} colunas={[
              { nome: "Nome", valor: (p) => <span className={p.ativo ? "" : "text-ink-soft line-through"}>{p.nome || <span className="text-ink-soft">(sem nome)</span>}{p.id === eu.id ? " (você)" : ""}</span> },
              { nome: "E-mail", valor: (p) => <span className="mono text-xs">{p.email || "—"}</span> },
              { nome: "Papel", valor: (p) => (dono(eu) && p.id !== eu.id ? <select className="campo !mt-0 !w-auto !py-1 text-xs" value={p.papel} onChange={(e) => void agir("papel_mudar", { p_usuario: p.id, p_papel: e.target.value })}><option value="dono">Dono</option><option value="analista">Analista</option><option value="leitor">Leitor</option></select> : nomePapel[p.papel]) },
              { nome: "2.º fator", valor: (p) => (p.segundo_fator === null ? "—" : p.segundo_fator ? <span className="text-ok">cadastrado</span> : <span className="text-oxblood">falta</span>) },
              { nome: "Visto", valor: (p) => <span className="mono text-xs">{faz(p.visto_em)}</span> },
              { nome: "", valor: (p) => (dono(eu) && p.id !== eu.id ? (p.ativo ? <Confirmar texto="Desativar" classe="botao-claro !py-1 !text-xs" onConfirmar={() => void agir("conta_ativar", { p_usuario: p.id, p_ativa: false })} /> : <button type="button" className="botao-claro !py-1 !text-xs" onClick={() => void agir("conta_ativar", { p_usuario: p.id, p_ativa: true })}>Reativar</button>) : null) },
            ]} />
          )}
          <p className="mt-3 font-sans text-xs text-ink-soft">Dono: convida, muda papéis, configura e lê o registro. Analista: trata alertas, abre incidentes e propõe bloqueios. Leitor: só lê. Bloqueio na Cloudflare exige duas pessoas.</p>
        </Cartao>
      )}
      {aba === "convites" && dono(eu) && <Convites agir={agir} />}
      {aba === "eu" && <MinhaConta eu={eu} agir={agir} recarregarEu={recarregarEu} />}
      {aba === "registro" && dono(eu) && <RegistroDeAtividades />}
    </div>
  );
}

function Convites({ agir }: { agir: (fn: string, args: Record<string, unknown>, sucesso?: string) => Promise<unknown> }) {
  const convites = useDados<Convite[]>("convites_listar", {}, 0);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("leitor");
  const [codigo, setCodigo] = useState("");
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Cartao titulo="Convidar">
        <form className="space-y-2 font-sans text-sm" onSubmit={async (e) => { e.preventDefault(); const r = (await agir("convite_criar", { p_email: email, p_papel: papel }, "Convite criado e e-mail posto na fila.")) as { codigo?: string } | null; if (r?.codigo) { setCodigo(r.codigo); setEmail(""); convites.recarregar(); } }}>
          <label className="block">E-mail<input type="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="block">Papel<select className="campo" value={papel} onChange={(e) => setPapel(e.target.value)}><option value="leitor">Leitor</option><option value="analista">Analista</option><option value="dono">Dono</option></select></label>
          <button type="submit" className="botao" disabled={!email.includes("@")}>Convidar</button>
        </form>
        {codigo && <div className="mt-3 border-t border-rule pt-3 font-sans text-xs"><p>O e-mail sai pelo coletor em até 5 minutos. Se preferir passar à mão, este é o código (aparece uma vez só):</p><pre className="mono mt-1 break-all whitespace-pre-wrap border border-rule bg-parchment p-2">{codigo}</pre></div>}
        <p className="mt-3 font-sans text-xs text-ink-soft">Vale 7 dias, só para esse e-mail, um uso. O banco guarda só o selo do código.</p>
      </Cartao>
      <Cartao titulo="Convites" className="xl:col-span-2">
        {!convites.dados ? <Carregando erro={convites.erro} /> : (
          <Tabela linhas={convites.dados} chave={(c) => c.id} colunas={[
            { nome: "E-mail", valor: (c) => <span className="mono text-xs">{c.email}</span> },
            { nome: "Papel", valor: (c) => nomePapel[c.papel] },
            { nome: "Criado", valor: (c) => <span className="mono text-xs">{dataHora(c.criado_em)}</span> },
            { nome: "Situação", valor: (c) => (c.usado ? <span className="text-ok">aceito</span> : c.revogado ? <span className="text-ink-soft">revogado</span> : c.vale ? <span>vale até {dataHora(c.expira_em)}</span> : <span className="text-ink-soft">expirou</span>) },
            { nome: "", valor: (c) => (c.vale ? <button type="button" className="botao-claro !py-1 !text-xs" onClick={async () => { await agir("convite_revogar", { p_id: c.id }, "Convite revogado."); convites.recarregar(); }}>Revogar</button> : null) },
          ]} vazio="Nenhum convite ainda." />
        )}
      </Cartao>
    </div>
  );
}

function MinhaConta({ eu, agir, recarregarEu }: { eu: Eu; agir: (fn: string, args: Record<string, unknown>, sucesso?: string) => Promise<unknown>; recarregarEu: () => void }) {
  const [nome, setNome] = useState(eu.nome);
  const [avisos, setAvisos] = useState(eu.avisos ?? { email: true, desktop: true, minimo: "media" });
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [aviso, setAviso] = useState("");
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Cartao titulo="Nome">
        <form className="space-y-2 font-sans text-sm" onSubmit={async (e) => { e.preventDefault(); await agir("perfil_salvar", { p_nome: nome }, "Nome guardado."); recarregarEu(); }}>
          <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} minLength={2} maxLength={80} required aria-label="Nome" />
          <p className="text-xs text-ink-soft">{eu.email} · {nomePapel[eu.papel]}</p>
          <button type="submit" className="botao" disabled={nome.length < 2}>Guardar</button>
        </form>
      </Cartao>
      <Cartao titulo="Meus avisos">
        <form className="space-y-2 font-sans text-sm" onSubmit={async (e) => { e.preventDefault(); await agir("avisos_configurar", { p: avisos }, "Avisos guardados."); recarregarEu(); }}>
          <label className="flex items-center gap-2"><input type="checkbox" checked={avisos.email} onChange={(e) => setAvisos({ ...avisos, email: e.target.checked })} />Por e-mail (sem detalhes: só tipo, gravidade e hora)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={avisos.desktop} onChange={(e) => setAvisos({ ...avisos, desktop: e.target.checked })} />No desktop, com o app aberto</label>
          <label className="block">A partir da gravidade<select className="campo" value={avisos.minimo} onChange={(e) => setAvisos({ ...avisos, minimo: e.target.value })}><option value="baixa">baixa</option><option value="media">média</option><option value="alta">alta</option><option value="critica">crítica</option></select></label>
          <button type="submit" className="botao">Guardar</button>
        </form>
      </Cartao>
      <Cartao titulo="Senha">
        <form className="space-y-2 font-sans text-sm" onSubmit={async (e) => { e.preventDefault(); setAviso(""); if (modoDemo()) return setAviso("Na demonstração não há senha."); const { error } = await supabase().auth.updateUser({ password: senha }); setAviso(error ? "Não deu certo. Entre de novo e tente outra vez." : "Senha trocada."); setSenha(""); setSenha2(""); }}>
          <label className="block">Nova senha (mínimo 12)<input type="password" className="campo" autoComplete="new-password" minLength={12} value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
          <label className="block">Repita<input type="password" className="campo" autoComplete="new-password" minLength={12} value={senha2} onChange={(e) => setSenha2(e.target.value)} /></label>
          <button type="submit" className="botao" disabled={senha.length < 12 || senha !== senha2}>Trocar</button>
          <Aviso texto={aviso} ok={aviso === "Senha trocada."} />
        </form>
      </Cartao>
    </div>
  );
}

function RegistroDeAtividades() {
  const [pagina, setPagina] = useState(0);
  const [filtro, setFiltro] = useState("");
  const { dados, erro } = useDados<Registro[]>("auditoria_listar", { p_pagina: pagina, p_acao: filtro || null }, 0);
  return (
    <Cartao titulo="Registro de atividades: quem viu e fez o quê">
      <div className="mb-3 flex flex-wrap gap-2 font-sans text-xs">
        {[["", "tudo"], ["viu:", "leituras"], ["alerta_", "alertas"], ["incidente_", "incidentes"], ["acao_", "ações"], ["convite_", "convites"], ["exportou:", "exportações"], ["configuracao_", "configuração"]].map(([v, n]) => <button key={v} type="button" className={`border px-2 py-1 ${filtro === v ? "border-ink bg-ink text-parchment" : "border-rule"}`} onClick={() => { setFiltro(v); setPagina(0); }}>{n}</button>)}
      </div>
      {!dados ? <Carregando erro={erro} /> : (
        <Tabela linhas={dados} chave={(r) => r.id} colunas={[
          { nome: "Quando", valor: (r) => <span className="mono text-xs">{dataHora(r.criado_em)}</span> },
          { nome: "Quem", valor: (r) => r.nome || <span className="text-ink-soft">—</span> },
          { nome: "Ação", valor: (r) => <span className="mono text-xs">{r.acao}</span> },
          { nome: "Alvo", valor: (r) => <span className="mono break-all text-xs">{r.alvo}</span> },
          { nome: "Detalhes", valor: (r) => (Object.keys(r.detalhes ?? {}).length ? <span className="mono break-all text-xs text-ink-soft">{JSON.stringify(r.detalhes).slice(0, 120)}</span> : null) },
        ]} vazio="Nada registrado ainda." />
      )}
      <div className="mt-3 flex gap-2 font-sans text-xs">
        <button type="button" className="botao-claro !py-1 !text-xs" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>← mais novos</button>
        <button type="button" className="botao-claro !py-1 !text-xs" disabled={(dados?.length ?? 0) < 100} onClick={() => setPagina(pagina + 1)}>mais antigos →</button>
      </div>
      <p className="mt-3 font-sans text-xs text-ink-soft">O registro não pode ser editado nem apagado por ninguém, nem pelo dono do banco; as linhas saem sozinhas depois de 400 dias.</p>
    </Cartao>
  );
}
