// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BadgeCheck, Building2, FileText, Flag, Globe, GraduationCap, HeartPulse, KeyRound, MessageSquareWarning, Rocket, ScrollText, ShieldAlert, Siren, ToggleRight, UserCheck, Users } from "lucide-react";
import { type ComponentType, useCallback, useMemo, useState } from "react";
import { Carimbo } from "@/components/rede/ui/Carimbo";
import { Faixa } from "@/components/rede/ui/Faixa";
import { Lampiao } from "@/components/rede/ui/Lampiao";
import type { EstadoDoAdmin } from "@/lib/rede/admin/tipos";
import type { VisaoGeral } from "@/lib/rede/painel/tipos";
import "@/styles/alumia-tokens.css";
import "@/styles/alumia-painel.css";
import "./admin.css";
import { Cadastros } from "../Cadastros";
import { Comunidades } from "../Comunidades";
import { Conteudo } from "../Conteudo";
import { Denuncias } from "../Denuncias";
import { Geral } from "../Geral";
import { Papeis } from "../Papeis";
import { classeDasLetras, Estado, type IdDaAba, PainelCtx, TemaDaAlumiaCtx, useDado, useTemaDaAlumia } from "../pecas";
import { Pessoas } from "../Pessoas";
import { Registro } from "../Registro";
import { SeloDasPessoas } from "../SeloDasPessoas";
import { ApagarPost } from "./ApagarPost";
import { Ataque } from "./Ataque";
import { Beta, situacaoDoBeta } from "./Beta";
import { PainelUnicoCtx } from "./cliente";
import { EducadoresDaEscola, Emergencia } from "./Emergencia";
import { Fediverso } from "./Fediverso";
import { Recursos } from "./Recursos";
import { ErrosDaTela, Relatos } from "./Relatos";

type IdDoAdmin = "beta" | "emergencia" | "recursos" | "cadastros" | "pessoas" | "conteudo" | "denuncias" | "comunidades" | "fediverso" | "ataque" | "saude" | "relatos" | "papeis" | "registro" | "escola" | "selo-pessoas";

const ABAS: { id: IdDoAdmin; nome: string; simbolo: ComponentType<{ "aria-hidden"?: boolean }> }[] = [
  { id: "beta", nome: "Beta fechado", simbolo: Rocket },
  { id: "emergencia", nome: "Emergência: só leitura e aviso geral", simbolo: Siren },
  { id: "recursos", nome: "Recursos", simbolo: ToggleRight },
  { id: "cadastros", nome: "Entrada e convites", simbolo: UserCheck },
  { id: "pessoas", nome: "Contas: suspender e banir", simbolo: Users },
  { id: "conteudo", nome: "Posts e mídias", simbolo: FileText },
  { id: "denuncias", nome: "Moderação e denúncias", simbolo: Flag },
  { id: "comunidades", nome: "Comunidades, organizações e selos", simbolo: Building2 },
  { id: "fediverso", nome: "Fediverso: servidores", simbolo: Globe },
  { id: "ataque", nome: "Ataque: bloqueio na borda", simbolo: ShieldAlert },
  { id: "saude", nome: "Saúde e números", simbolo: HeartPulse },
  { id: "relatos", nome: "Relatos do beta", simbolo: MessageSquareWarning },
  { id: "papeis", nome: "Papéis", simbolo: KeyRound },
  { id: "registro", nome: "Registro", simbolo: ScrollText },
  { id: "escola", nome: "Escola: educadores", simbolo: GraduationCap },
  // Prompt 4, item 3: o selo das pessoas e os nomes reservados (o interruptor "alumia-p4-selo-contagens" fica em Recursos).
  { id: "selo-pessoas", nome: "Selo das pessoas e nomes reservados", simbolo: BadgeCheck },
];

/** As abas do painel de controle (reaproveitadas aqui) apontam umas para as outras pelo nome antigo: cada uma tem o seu lugar no painel único. */
const DO_PAINEL_DE_CONTROLE: Record<IdDaAba, IdDoAdmin> = {
  geral: "saude",
  cadastros: "cadastros",
  pessoas: "pessoas",
  conteudo: "conteudo",
  denuncias: "denuncias",
  papeis: "papeis",
  comunidades: "comunidades",
  funcoes: "recursos",
  registro: "registro",
};

interface EuNoAdmin {
  pode: boolean;
  falta_segundo_fator?: boolean;
}

/**
 * O painel único de admin da Alumia (decisão da coordenação de 17/11): tudo da Alumia num lugar só, com plenos poderes e com o
 * registro de quem fez o quê. Só a coordenação, com o código do aplicativo autenticador nesta sessão; quem decide é o banco, em
 * cada função (interno.alumia_admin_exige). O que já existia no painel de controle é reaproveitado aqui, não copiado.
 */
export function PainelUnico() {
  const tema = useTemaDaAlumia();
  const eu = useDado<EuNoAdmin>("alumia_admin_eu");
  const pode = eu.dados?.pode === true;
  const geral = useDado<VisaoGeral>(pode ? "alumia_painel_geral" : null);
  const estado = useDado<EstadoDoAdmin>(pode ? "alumia_admin_estado" : null);
  const [aba, setAba] = useState<{ id: IdDoAdmin; foco: string | null; vez: number }>({ id: "beta", foco: null, vez: 0 });
  const irAqui = useCallback((id: IdDoAdmin, foco?: string) => {
    setAba((a) => ({ id, foco: foco ?? null, vez: a.vez + 1 }));
    document.getElementById("aa-area")?.scrollIntoView({ block: "start" });
  }, []);
  const recarregarGeral = geral.recarregar;
  const recarregarEstado = estado.recarregar;
  const atualizar = useCallback(() => {
    recarregarGeral();
    recarregarEstado();
  }, [recarregarGeral, recarregarEstado]);
  const ctx = useMemo(
    () => (geral.dados ? { papel: geral.dados.papel, geral: geral.dados, atualizar, ir: (id: IdDaAba, foco?: string) => irAqui(DO_PAINEL_DE_CONTROLE[id], foco), foco: aba.foco } : null),
    [geral.dados, atualizar, irAqui, aba.foco],
  );

  if (!pode) {
    return (
      <div className={`ap ${classeDasLetras}`} data-al="2" data-al-tema={tema}>
        <Faixa />
        <div className="ap-area">
          {eu.dados ? (
            <div className="ap-estado" role="alert">
              <p>
                {eu.dados.falta_segundo_fator
                  ? "O painel de admin da Alumia pede o código do aplicativo autenticador nesta sessão. Saia e entre de novo com o código."
                  : "O painel de admin da Alumia é só da coordenação."}
              </p>
            </div>
          ) : (
            <Estado leitura={eu} />
          )}
        </div>
      </div>
    );
  }

  const e = estado.dados;
  const situacao = e ? situacaoDoBeta(e) : null;
  const esperando: Partial<Record<IdDoAdmin, { n: number; urgente?: boolean }>> = {
    cadastros: { n: geral.dados?.numeros.fila ?? 0 },
    denuncias: { n: geral.dados?.numeros.denuncias ?? 0, urgente: (geral.dados?.numeros.denuncias_urgentes ?? 0) > 0 },
    comunidades: { n: geral.dados?.numeros.selos_esperando ?? 0 },
    ataque: { n: e?.borda_ativos ?? 0, urgente: (e?.borda_ativos ?? 0) > 0 },
  };

  return (
    <PainelUnicoCtx.Provider value={true}>
      <TemaDaAlumiaCtx.Provider value={tema}>
      <div className={`ap aa ${classeDasLetras}`} data-al="2" data-al-tema={tema}>
        <Faixa />
        <header className="ap-alto">
          <div className="ap-marca">
            <Lampiao tamanho={42} />
            <div>
              <h1 className="ap-marca-nome al-cond">Alumia · painel de admin</h1>
              <span className="ap-marca-sub">Plenos poderes sobre a Alumia, só da coordenação. Toda ação fica no registro: quem, o quê, quando e por quê.</span>
            </div>
          </div>
          <div className="ap-alto-lado">
            {situacao ? (
              <button type="button" className="aa-sinal al-cond" data-tom={situacao.tom} onClick={() => irAqui("beta")} title="Abrir o estado do beta fechado">
                {situacao.titulo}
              </button>
            ) : null}
            <Carimbo situacao="confirmado" texto="Coordenação" tamanho="p" />
          </div>
        </header>
        {situacao?.tom === "perigo" ? (
          <p className="aa-faixa-perigo" role="alert">
            {situacao.texto}
          </p>
        ) : null}
        {!ctx || !e ? (
          <div className="ap-area">
            <Estado leitura={!e ? estado : geral} />
          </div>
        ) : (
          <PainelCtx.Provider value={ctx}>
            <div className="ap-corpo">
              <nav className="ap-menu" aria-label="Partes do painel de admin da Alumia">
                <ul className="ap-menu-lista">
                  {ABAS.map(({ id, nome, simbolo: Simbolo }) => (
                    <li key={id}>
                      <button type="button" className="ap-menu-item" aria-current={aba.id === id ? "page" : undefined} onClick={() => irAqui(id)}>
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
              <div id="aa-area" className="ap-area" key={`${aba.id}-${aba.vez}`}>
                {aba.id === "beta" && <Beta estado={e} recarregar={atualizar} irPara={irAqui} />}
                {aba.id === "recursos" && <Recursos estado={e} recarregar={atualizar} irPara={irAqui} />}
                {aba.id === "cadastros" && <Cadastros />}
                {aba.id === "pessoas" && <Pessoas />}
                {aba.id === "conteudo" && (
                  <div className="ap-tela">
                    <ApagarPost />
                    <Conteudo />
                  </div>
                )}
                {aba.id === "denuncias" && <Denuncias />}
                {aba.id === "comunidades" && <Comunidades />}
                {aba.id === "fediverso" && <Fediverso recarregarEstado={atualizar} />}
                {aba.id === "ataque" && <Ataque recarregarEstado={atualizar} />}
                {aba.id === "saude" && (
                  <div className="ap-tela">
                    <Geral />
                    <ErrosDaTela />
                  </div>
                )}
                {aba.id === "relatos" && <Relatos />}
                {aba.id === "papeis" && <Papeis />}
                {aba.id === "registro" && <Registro />}
                {aba.id === "emergencia" && <Emergencia irPara={irAqui} />}
                {aba.id === "escola" && <EducadoresDaEscola />}
                {aba.id === "selo-pessoas" && <SeloDasPessoas />}
              </div>
            </div>
          </PainelCtx.Provider>
        )}
      </div>
      </TemaDaAlumiaCtx.Provider>
    </PainelUnicoCtx.Provider>
  );
}
