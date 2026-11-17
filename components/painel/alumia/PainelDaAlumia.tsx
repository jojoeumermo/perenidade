// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Building2, FileText, Flag, KeyRound, LayoutGrid, ScrollText, ToggleRight, UserCheck, Users } from "lucide-react";
import { type ComponentType, useCallback, useMemo, useState } from "react";
import { Carimbo } from "@/components/rede/ui/Carimbo";
import { Faixa } from "@/components/rede/ui/Faixa";
import { Lampiao } from "@/components/rede/ui/Lampiao";
import type { VisaoGeral } from "@/lib/rede/painel/tipos";
import "@/styles/alumia-tokens.css";
import "@/styles/alumia-painel.css";
import { Cadastros } from "./Cadastros";
import { Comunidades } from "./Comunidades";
import { Conteudo } from "./Conteudo";
import { Denuncias } from "./Denuncias";
import { Funcoes } from "./Funcoes";
import { Geral } from "./Geral";
import { Papeis } from "./Papeis";
import { classeDasLetras, Estado, type IdDaAba, PainelCtx, useDado } from "./pecas";
import { Pessoas } from "./Pessoas";
import { Registro } from "./Registro";

const ABAS: { id: IdDaAba; nome: string; simbolo: ComponentType<{ "aria-hidden"?: boolean }> }[] = [
  { id: "geral", nome: "Visão geral", simbolo: LayoutGrid },
  { id: "cadastros", nome: "Cadastros", simbolo: UserCheck },
  { id: "pessoas", nome: "Pessoas", simbolo: Users },
  { id: "conteudo", nome: "Posts e mídias", simbolo: FileText },
  { id: "denuncias", nome: "Denúncias", simbolo: Flag },
  { id: "papeis", nome: "Papéis", simbolo: KeyRound },
  { id: "comunidades", nome: "Comunidades e organizações", simbolo: Building2 },
  { id: "funcoes", nome: "Funções e trava", simbolo: ToggleRight },
  { id: "registro", nome: "Registro", simbolo: ScrollText },
];

/** O que espera decisão em cada aba (o número ao lado do nome). */
function contas(g: VisaoGeral | null): Partial<Record<IdDaAba, { n: number; urgente?: boolean }>> {
  if (!g) return {};
  return {
    cadastros: { n: g.numeros.fila },
    denuncias: { n: g.numeros.denuncias, urgente: g.numeros.denuncias_urgentes > 0 },
    comunidades: { n: g.numeros.selos_esperando },
  };
}

/**
 * O painel de controle da Alumia: tudo o que a coordenação e o admin da Alumia fazem na rede,
 * num lugar só. Esta tela não decide nada sobre quem pode: cada função do banco confere o papel de quem chama e grava no
 * registro quem fez, o quê e por quê. Para quem não tem o painel, o banco responde "sem_permissao" a tudo e a seção nem
 * aparece no menu do painel interno.
 */
export function PainelDaAlumia() {
  const leitura = useDado<VisaoGeral>("alumia_painel_geral");
  const [aba, setAba] = useState<{ id: IdDaAba; foco: string | null; vez: number }>({ id: "geral", foco: null, vez: 0 });
  const ir = useCallback((id: IdDaAba, foco?: string) => {
    setAba((a) => ({ id, foco: foco ?? null, vez: a.vez + 1 }));
    document.getElementById("ap-area")?.scrollIntoView({ block: "start" });
  }, []);
  const geral = leitura.dados;
  const ctx = useMemo(() => (geral ? { papel: geral.papel, geral, atualizar: leitura.recarregar, ir, foco: aba.foco } : null), [geral, leitura.recarregar, ir, aba.foco]);
  const esperando = contas(geral);

  return (
    <div className={`ap ${classeDasLetras}`} data-al="2">
      <Faixa />
      <header className="ap-alto">
        <div className="ap-marca">
          <Lampiao tamanho={42} />
          <div>
            <h1 className="ap-marca-nome al-cond">Alumia · painel de controle</h1>
            <span className="ap-marca-sub">Toda ação daqui fica no registro: quem, o quê, quando e por quê.</span>
          </div>
        </div>
        {geral ? (
          <div className="ap-alto-lado">
            <button type="button" className="ap-sinal al-cond" data-ligado={geral.saude.trava} onClick={() => ir("funcoes")} title="Abrir Funções e trava">
              Trava: {geral.saude.trava ? "ligada" : "desligada"}
            </button>
            <Carimbo situacao={geral.papel === "coordenacao" ? "confirmado" : "adiado"} texto={geral.papel === "coordenacao" ? "Coordenação" : "Admin da Alumia"} tamanho="p" />
          </div>
        ) : null}
      </header>
      {!ctx ? (
        <div className="ap-area">
          <Estado leitura={leitura} />
        </div>
      ) : (
        <PainelCtx.Provider value={ctx}>
          <div className="ap-corpo">
            <nav className="ap-menu" aria-label="Partes do painel da Alumia">
              <ul className="ap-menu-lista">
                {ABAS.map(({ id, nome, simbolo: Simbolo }) => (
                  <li key={id}>
                    <button type="button" className="ap-menu-item" aria-current={aba.id === id ? "page" : undefined} onClick={() => ir(id)}>
                      <Simbolo aria-hidden />
                      <span className="ap-menu-nome">{nome}</span>
                      {esperando[id]?.n ? (
                        <span className="ap-conta" data-tom={esperando[id]?.urgente ? "urgente" : undefined}>
                          {esperando[id]?.n}
                          <span className="sr-only"> esperando</span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div id="ap-area" className="ap-area" key={`${aba.id}-${aba.vez}`}>
              {aba.id === "geral" && <Geral />}
              {aba.id === "cadastros" && <Cadastros />}
              {aba.id === "pessoas" && <Pessoas />}
              {aba.id === "conteudo" && <Conteudo />}
              {aba.id === "denuncias" && <Denuncias />}
              {aba.id === "papeis" && <Papeis />}
              {aba.id === "comunidades" && <Comunidades />}
              {aba.id === "funcoes" && <Funcoes />}
              {aba.id === "registro" && <Registro />}
            </div>
          </div>
        </PainelCtx.Provider>
      )}
    </div>
  );
}
