// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O diretório das organizações com selo (por tipo, cidade escrita e busca) e o mapa "Onde há lampião aceso" (só estados e cidades
// escritas de núcleos com chama plena que escolheram aparecer), com "Acenda o primeiro aqui". Sem contagem de pessoas: o diretório
// mostra quantos núcleos a organização tem (núcleo não é pessoa); o mapa não mostra número nenhum. Sem GPS.
import { useCallback, useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { clienteOrgB1 } from "@/lib/rede/cliente-org-b1";
import type { EstadoNoMapa, OrgNoDiretorio } from "@/lib/rede/org/b1";
import { preencher } from "@/lib/rede/preencher";
import { fraseDoErro, useTextosDaOrgB1 } from "@/lib/rede/textos-org-b1";
import { TIPOS_DE_ORG } from "@/lib/rede/tipos-org";
import { Mosaico } from "../../mosaico/Mosaico";
import { Botao } from "../../ui/Botao";
import "./b1.css";

export function DiretorioDasOrganizacoes({ lang, tipos }: { lang: string; tipos: Record<string, string> }) {
  const t = useTextosDaOrgB1(lang);
  const id = useId();
  const [filtro, setFiltro] = useState({ tipo: "", cidade: "", busca: "" });
  const [itens, setItens] = useState<OrgNoDiretorio[] | null>(null);
  const [depois, setDepois] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const buscar = useCallback(async (f: typeof filtro, cursor: string | null) => {
    setOcupado(true);
    try {
      const r = await clienteOrgB1().diretorio({ ...f, depois: cursor });
      setItens((x) => (cursor && x ? [...x, ...r.itens] : r.itens));
      setDepois(r.depois);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha");
    } finally {
      setOcupado(false);
    }
  }, []);
  useEffect(() => {
    let vivo = true;
    clienteOrgB1()
      .diretorio({})
      .then((r) => {
        if (!vivo) return;
        setItens(r.itens);
        setDepois(r.depois);
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "falha"));
    return () => {
      vivo = false;
    };
  }, []);

  if (!t) return null;
  const td = t.diretorio;
  return (
    <section className="b1-diretorio" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="al-cond b1-titulo-grande">{td.titulo}</h2>
      <p className="al-perfil-nota">{td.ajuda}</p>
      <form className="b1-filtros" role="search" onSubmit={(e) => { e.preventDefault(); void buscar(filtro, null); }}>
        <label><span>{td.busca}</span><input className="al-entrada" type="search" maxLength={60} value={filtro.busca} onChange={(e) => setFiltro({ ...filtro, busca: e.target.value })} /></label>
        <label><span>{td.cidade}</span><input className="al-entrada" maxLength={60} value={filtro.cidade} onChange={(e) => setFiltro({ ...filtro, cidade: e.target.value })} /></label>
        <label><span>{td.tipo}</span>
          <select className="al-entrada" value={filtro.tipo} onChange={(e) => { const f = { ...filtro, tipo: e.target.value }; setFiltro(f); void buscar(f, null); }}>
            <option value="">{td.todos}</option>
            {TIPOS_DE_ORG.map((x) => <option key={x} value={x}>{tipos[x] ?? x}</option>)}
          </select>
        </label>
        <Botao type="submit" disabled={ocupado}>{td.buscar}</Botao>
      </form>
      <p className="sr-only" role="status">{itens ? preencher(td.achadas, { n: itens.length }) : ""}</p>
      {erro ? <p className="al-perfil-erro" role="alert">{fraseDoErro(t, new Error(erro))}</p> : null}
      {itens && itens.length === 0 ? <p className="al-painel-vazio">{td.vazio}</p> : null}
      <ul className="b1-orgs" aria-busy={ocupado}>
        {(itens ?? []).map((o, i) => (
          <li key={o.handle} style={{ ["--i" as string]: i % 12 }}>
            <Link href={`/${lang}/alumia/u/${o.handle}`} className="b1-org-cartao" aria-label={preencher(td.ver, { nome: o.codinome })}>
              <Mosaico palavra={o.palavra} semente={o.handle} proporcao={0.9} rotulo={o.palavra} className="b1-org-capa" />
              <span className="b1-org-info">
                <strong>{o.codinome}</strong>
                <small>@{o.handle}</small>
                <small>{tipos[o.tipo] ?? o.tipo}{o.cidade ? ` · ${o.cidade}` : ""} · {o.nucleos === 0 ? td.semNucleo : o.nucleos === 1 ? td.umNucleo : preencher(td.nucleos, { n: o.nucleos })}</small>
                {o.bio ? <span className="b1-org-bio">{o.bio}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {depois ? <Botao variante="contorno" disabled={ocupado} onClick={() => void buscar(filtro, depois)}>{td.mais}</Botao> : null}
    </section>
  );
}

export function MapaDosLampioes({ lang, aoAcender }: { lang: string; aoAcender?: string }) {
  const t = useTextosDaOrgB1(lang);
  const id = useId();
  const [mapa, setMapa] = useState<EstadoNoMapa[] | null>(null);
  useEffect(() => {
    clienteOrgB1().mapa().then(setMapa).catch(() => setMapa([]));
  }, []);
  if (!t || !mapa) return null;
  const tm = t.mapa;
  return (
    <section className="b1-mapa" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="al-cond b1-titulo-grande">{tm.titulo}</h2>
      <p className="al-perfil-nota">{tm.ajuda}</p>
      {mapa.length === 0 ? <p className="al-painel-vazio">{tm.vazio}</p> : (
        <ul className="b1-ufs">
          {mapa.map((e, i) => (
            <li key={e.uf} style={{ ["--i" as string]: i }}>
              <span className="b1-uf al-cond" aria-hidden>{e.uf}</span>
              <span className="sr-only">{e.uf}: </span>
              <span className="b1-uf-cidades">{e.cidades.join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="b1-acenda">
        <strong>{tm.acenda}</strong>
        <span className="al-perfil-nota">{tm.acendaAjuda}</span>
        {aoAcender ? <Link href={aoAcender} className="al-botao al-botao-dourado al-botao-m">{tm.acenda}</Link> : null}
      </div>
    </section>
  );
}
