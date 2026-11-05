// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { rpc } from "@/lib/backend";
import { textoDoErro, useLista } from "./comum";
import { MoldeConfiguracao } from "./moldes";
import { Area, Botao, CabecalhoDeSecao, Campo, Cartao, Esqueleto, Faixa, Marca, notificar } from "./ui";

interface Grupo {
  grupo: string;
  termos: string[];
  motivo: string;
  sugestao: string;
}
interface Ajustes {
  termo_versao: string;
  sobre_maximo: number;
  grupos_do_arquivo: number;
  categorias: { id: string; conselho: string; ligada_no_arquivo: boolean; pausada: boolean }[];
  grupos: Grupo[];
}

/**
 * Regras do Mural de Saúde, no banco (Etapa 8, backend-2). A coordenação só APERTA: acrescenta termos ao filtro de texto e
 * pausa uma categoria. O arquivo content/saude/regras.json continua mandando: nada aqui tira um termo dele nem liga uma
 * categoria que ele deixa desligada. Termos novos valem para todo texto salvo daqui em diante (o que já está publicado só é
 * conferido de novo quando alguém edita); pausar uma categoria tira os perfis dela da vitrine na hora e os devolve ao despausar.
 * No molde Configuração: dois grupos (categorias e termos) e o rodapé que guarda tudo de uma vez.
 */
export function SaudeRegras() {
  const ajustes = useLista<Ajustes>("saude_regras_ajustes_ver", {}, { quieta: true });
  if (ajustes.erro) {
    return (
      <Faixa tom="erro" acao={<Botao pequeno onClick={ajustes.recarregar}>Tentar de novo</Botao>}>
        {ajustes.erro}
      </Faixa>
    );
  }
  if (!ajustes.dados) return <Esqueleto forma="cartoes" linhas={2} />;
  return <Formulario dados={ajustes.dados} recarregar={ajustes.recarregar} />;
}

const pausadasDe = (dados: Ajustes) => dados.categorias.filter((c) => c.pausada).map((c) => c.id);

function Formulario({ dados, recarregar }: { dados: Ajustes; recarregar: () => void }) {
  const [grupos, setGrupos] = useState<Grupo[]>(dados.grupos);
  const [pausadas, setPausadas] = useState<string[]>(() => pausadasDe(dados));
  const [ocupado, setOcupado] = useState(false);
  // Se houve mudança desde a última leitura: o rodapé do molde diz e só deixa guardar (ou descartar) quando há.
  const [mexeu, setMexeu] = useState(false);

  const mudar = (i: number, parte: Partial<Grupo>) => {
    setMexeu(true);
    setGrupos((g) => g.map((x, j) => (j === i ? { ...x, ...parte } : x)));
  };

  async function salvar() {
    setOcupado(true);
    try {
      await rpc("saude_regras_ajustes_salvar", { p_grupos: limparGrupos(grupos), p_pausadas: pausadas });
      notificar.ok("Regras guardadas.");
      setMexeu(false);
      recarregar();
    } catch (e) {
      notificar.erro(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="saude-regras" className="pn-secao max-w-3xl">
      <CabecalhoDeSecao
        id="saude-regras"
        titulo="Regras do mural (só coordenação)"
        sobre={
          <>
            O arquivo de regras (versão do termo {dados.termo_versao}) tem {dados.grupos_do_arquivo} grupos de termos bloqueados e o limite de {dados.sobre_maximo} caracteres no texto do perfil.
            Aqui você só pode acrescentar termos e pausar categorias, nunca afrouxar.
          </>
        }
      />
      <MoldeConfiguracao
        sujo={mexeu}
        salvando={ocupado}
        aoSalvar={() => void salvar()}
        aoDescartar={() => {
          setGrupos(dados.grupos);
          setPausadas(pausadasDe(dados));
          setMexeu(false);
        }}
        rotuloSalvar="Guardar as regras"
        grupos={[
          {
            id: "categorias",
            titulo: "Categorias",
            campos: (
              <fieldset className="space-y-1">
                <legend className="sr-only">Categorias</legend>
                {dados.categorias.map((c) => (
                  <Marca
                    key={c.id}
                    rotulo={`Pausar ${c.id} (${c.conselho})${c.ligada_no_arquivo ? "" : " — já desligada no arquivo"}`}
                    checked={pausadas.includes(c.id)}
                    onChange={(e) => {
                      setMexeu(true);
                      setPausadas((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)));
                    }}
                  />
                ))}
              </fieldset>
            ),
          },
          {
            id: "termos",
            titulo: "Termos (um por linha)",
            campos: (
              <div className="pn-secao">
                {grupos.map((g, i) => (
                  <Cartao key={i} as="div" variante="plano">
                    <div className="pn-secao">
                      <Campo rotulo="Nome do grupo" value={g.grupo} maxLength={40} onChange={(e) => mudar(i, { grupo: e.target.value })} />
                      <Area rotulo="Termos (um por linha)" rows={3} value={g.termos.join("\n")} onChange={(e) => mudar(i, { termos: e.target.value.split("\n") })} ajuda="De 2 a 60 caracteres cada, até 30 termos." />
                      <Campo rotulo="Motivo mostrado a quem escreveu" value={g.motivo} maxLength={200} onChange={(e) => mudar(i, { motivo: e.target.value })} />
                      <Campo rotulo="Sugestão (opcional)" value={g.sugestao} maxLength={200} onChange={(e) => mudar(i, { sugestao: e.target.value })} />
                      <div>
                        <Botao
                          variante="discreto"
                          perigo
                          simbolo={Trash2}
                          onClick={() => {
                            setMexeu(true);
                            setGrupos((x) => x.filter((_, j) => j !== i));
                          }}
                        >
                          Tirar este grupo
                        </Botao>
                      </div>
                    </div>
                  </Cartao>
                ))}
                <div>
                  <Botao
                    simbolo={Plus}
                    disabled={grupos.length >= 30}
                    onClick={() => {
                      setMexeu(true);
                      setGrupos((x) => [...x, { grupo: "", termos: [""], motivo: "", sugestao: "" }]);
                    }}
                  >
                    Acrescentar um grupo de termos
                  </Botao>
                </div>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}

/** Tira linhas vazias e espaços antes de enviar (a tela guarda o texto cru enquanto se digita). */
export function limparGrupos(grupos: Grupo[]): Grupo[] {
  return grupos.map((g) => ({ ...g, grupo: g.grupo.trim(), termos: g.termos.map((t) => t.trim()).filter(Boolean), motivo: g.motivo.trim(), sugestao: g.sugestao.trim() }));
}
