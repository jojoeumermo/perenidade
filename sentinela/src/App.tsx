// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// A casca: menu lateral (no celular, abas embaixo), tema claro/escuro, sessão, avisos no desktop.
import { useEffect, useRef, useState } from "react";
import { avisarMudanca, guardarTema, modoDemo, sair, supabase, temaGuardado, temServico, useEu, type Eu } from "./lib/backend.ts";
import { notificar } from "./lib/nativo.ts";
import { Alertas } from "./telas/Alertas.tsx";
import { Ameacas } from "./telas/Ameacas.tsx";
import { Configuracao } from "./telas/Configuracao.tsx";
import { Entrar } from "./telas/Entrar.tsx";
import { Equipe } from "./telas/Equipe.tsx";
import { Historico } from "./telas/Historico.tsx";
import { Incidentes } from "./telas/Incidentes.tsx";
import { Integridade } from "./telas/Integridade.tsx";
import { Plataforma } from "./telas/Plataforma.tsx";
import { VisaoGeral } from "./telas/VisaoGeral.tsx";

const telas = [
  { id: "visao", nome: "Visão geral", grupo: "Vigiar", icone: "M4 20V9l8-5 8 5v11M9 20v-6h6v6" },
  { id: "ameacas", nome: "Ameaças", grupo: "Vigiar", icone: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 8v4M12 15v.01" },
  { id: "integridade", nome: "Integridade", grupo: "Vigiar", icone: "M5 13l4 4L19 7M4 4h16v16H4z" },
  { id: "plataforma", nome: "Plataforma", grupo: "Vigiar", icone: "M4 6h16v4H4zM4 14h16v4H4zM8 8h.01M8 16h.01" },
  { id: "alertas", nome: "Alertas", grupo: "Responder", icone: "M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3zM10 20a2 2 0 0 0 4 0" },
  { id: "incidentes", nome: "Incidentes", grupo: "Responder", icone: "M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5" },
  { id: "historico", nome: "Histórico", grupo: "Responder", icone: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" },
  { id: "equipe", nome: "Equipe", grupo: "Cuidar", icone: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M18 8v6M15 11h6" },
  { id: "configuracao", nome: "Configuração", grupo: "Cuidar", icone: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h5l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z" },
];
const celular = ["visao", "ameacas", "alertas", "incidentes", "equipe"];

function Icone({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function usarTema() {
  const [tema, setTema] = useState(temaGuardado());
  useEffect(() => {
    if (tema === "light" || tema === "dark") document.documentElement.setAttribute("data-theme", tema);
    else document.documentElement.removeAttribute("data-theme");
  }, [tema]);
  const alternar = () => {
    const atual = document.documentElement.getAttribute("data-theme") ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const proximo = atual === "dark" ? "light" : "dark";
    guardarTema(proximo);
    setTema(proximo);
  };
  return alternar;
}

export default function App() {
  const estado = useEu();
  const alternarTema = usarTema();
  const [tela, setTela] = useState(() => window.location.hash.replace("#", "") || "visao");
  const ir = (id: string) => {
    setTela(id);
    window.location.hash = id;
  };
  useEffect(() => {
    const ouvir = () => setTela(window.location.hash.replace("#", "") || "visao");
    window.addEventListener("hashchange", ouvir);
    return () => window.removeEventListener("hashchange", ouvir);
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator && !("__TAURI_INTERNALS__" in window) && import.meta.env.PROD) navigator.serviceWorker.register("/sw.js").catch(() => null);
  }, []);

  if (estado.status === "carregando") return <p className="mono p-6 text-xs text-ink-soft">Carregando…</p>;
  if (estado.status === "fora" || !estado.eu.segundo_fator_na_sessao || !estado.eu.ativo) return <Entrar eu={estado.status === "dentro" ? estado.eu : null} recarregar={estado.recarregar} />;
  return <Painel eu={estado.eu} tela={tela} ir={ir} alternarTema={alternarTema} recarregarEu={estado.recarregar} />;
}

function Painel({ eu, tela, ir, alternarTema, recarregarEu }: { eu: Eu; tela: string; ir: (t: string) => void; alternarTema: () => void; recarregarEu: () => void }) {
  const abertosAntes = useRef<number | null>(null);
  // Avisos no desktop: quando o número de alertas abertos sobe, a pessoa é avisada (sem detalhes).
  useEffect(() => {
    if (abertosAntes.current !== null && eu.alertas_abertos > abertosAntes.current && eu.avisos?.desktop) void notificar("Sentinela Lúcia", `${eu.alertas_abertos - abertosAntes.current} alerta(s) novo(s). Abra o painel para ver.`);
    abertosAntes.current = eu.alertas_abertos;
  }, [eu.alertas_abertos, eu.avisos?.desktop]);
  // Recarrega a conta (e com ela a contagem de alertas) a cada minuto e escuta o coletor avisar que coletou.
  useEffect(() => {
    const relogio = setInterval(recarregarEu, 60_000);
    if (modoDemo() || !temServico()) return () => clearInterval(relogio);
    const canal = supabase().channel("sentinela").on("broadcast", { event: "coleta" }, () => { avisarMudanca(); recarregarEu(); }).subscribe();
    return () => {
      clearInterval(relogio);
      void supabase().removeChannel(canal);
    };
  }, [recarregarEu]);

  const atual = telas.find((t) => t.id === tela) ?? telas[0];
  return (
    <div className="flex min-h-full">
      <aside className="hidden w-56 shrink-0 flex-col bg-[#17130e] text-[#d9cdb0] md:flex">
        <div className="flex items-center gap-2 border-b border-[#3a3226] px-3 py-4">
          <img src="/icone-192.png" alt="" width={36} height={36} className="h-9 w-9" />
          <div><p className="font-mono text-[0.6rem] uppercase tracking-widest text-[#8f8468]">Instituto Lúcia</p><p className="font-serif text-lg font-semibold leading-none text-white">Sentinela</p></div>
        </div>
        <nav aria-label="Seções" className="flex-1 py-2">
          {["Vigiar", "Responder", "Cuidar"].map((g) => (
            <div key={g}>
              <p className="menu-grupo">{g}</p>
              {telas.filter((t) => t.grupo === g).map((t) => (
                <button key={t.id} type="button" className={`menu-item ${tela === t.id ? "menu-item-ativo" : ""}`} aria-current={tela === t.id ? "page" : undefined} onClick={() => ir(t.id)}>
                  <Icone d={t.icone} />
                  <span className="flex-1">{t.nome}</span>
                  {t.id === "alertas" && eu.alertas_abertos > 0 && <span className="bg-[#c21f16] px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-white">{eu.alertas_abertos}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-[#3a3226] px-3 py-3 font-sans text-xs">
          <p className="truncate text-white">{eu.nome || eu.email}</p>
          <p className="text-[#8f8468]">{eu.papel}{modoDemo() ? " · demonstração" : ""}</p>
          <div className="mt-2 flex gap-3">
            <button type="button" className="underline" onClick={alternarTema}>tema</button>
            <button type="button" className="underline" onClick={() => void sair()}>sair</button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="barra-celular flex items-center justify-between px-4 py-3 md:hidden">
          <div className="flex items-center gap-2"><img src="/icone-192.png" alt="" width={28} height={28} className="h-7 w-7" /><span className="font-serif text-lg font-semibold">Sentinela</span></div>
          <div className="flex gap-3 font-sans text-xs"><button type="button" onClick={alternarTema}>tema</button><button type="button" onClick={() => void sair()}>sair</button></div>
        </header>
        <main id="conteudo" className="flex-1 px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">
          {modoDemo() && <p className="mb-4 border-l-4 border-gold bg-parchment-deep px-3 py-2 font-sans text-xs">Modo de demonstração: dados fictícios, nenhum serviço é chamado. Para ligar ao seu serviço, saia e escolha "Trocar o serviço".</p>}
          <div key={tela} className="surge">
            {atual.id === "visao" && <VisaoGeral eu={eu} ir={ir} />}
            {atual.id === "ameacas" && <Ameacas eu={eu} />}
            {atual.id === "integridade" && <Integridade />}
            {atual.id === "plataforma" && <Plataforma />}
            {atual.id === "alertas" && <Alertas eu={eu} ir={ir} />}
            {atual.id === "incidentes" && <Incidentes eu={eu} />}
            {atual.id === "historico" && <Historico />}
            {atual.id === "equipe" && <Equipe eu={eu} recarregarEu={recarregarEu} />}
            {atual.id === "configuracao" && <Configuracao eu={eu} />}
          </div>
        </main>
        <nav aria-label="Seções" className="fixed inset-x-0 bottom-0 z-20 flex border-t-2 border-ink bg-parchment pb-[var(--recuo-baixo)] md:hidden">
          {telas.filter((t) => celular.includes(t.id)).map((t) => (
            <button key={t.id} type="button" className={`flex flex-1 flex-col items-center gap-0.5 py-2 font-sans text-[0.65rem] ${tela === t.id ? "font-semibold text-oxblood" : "text-ink-soft"}`} aria-current={tela === t.id ? "page" : undefined} onClick={() => ir(t.id)}>
              <Icone d={t.icone} className="h-5 w-5" />
              {t.nome}
            </button>
          ))}
          <select aria-label="Mais seções" className="w-12 bg-transparent font-sans text-[0.65rem] text-ink-soft" value={celular.includes(tela) ? "" : tela} onChange={(e) => e.target.value && ir(e.target.value)}>
            <option value="">mais</option>
            {telas.filter((t) => !celular.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </nav>
      </div>
    </div>
  );
}
