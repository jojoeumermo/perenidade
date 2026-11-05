// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { textoDoErro, useLista } from "./comum";
import { Area, Botao, Campo, Marca, notificar } from "./ui";

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
 */
export function SaudeRegras() {
  const ajustes = useLista<Ajustes>("saude_regras_ajustes_ver", {}, { quieta: true });
  if (ajustes.erro) return <p role="alert" className="text-oxblood">{ajustes.erro}</p>;
  if (!ajustes.dados) return null;
  return <Formulario dados={ajustes.dados} recarregar={ajustes.recarregar} />;
}

function Formulario({ dados, recarregar }: { dados: Ajustes; recarregar: () => void }) {
  const [grupos, setGrupos] = useState<Grupo[]>(dados.grupos);
  const [pausadas, setPausadas] = useState<string[]>(() => dados.categorias.filter((c) => c.pausada).map((c) => c.id));
  const [ocupado, setOcupado] = useState(false);

  const mudar = (i: number, parte: Partial<Grupo>) => setGrupos((g) => g.map((x, j) => (j === i ? { ...x, ...parte } : x)));

  async function salvar() {
    setOcupado(true);
    try {
      await rpc("saude_regras_ajustes_salvar", { p_grupos: limparGrupos(grupos), p_pausadas: pausadas });
      notificar.ok("Regras guardadas.");
      recarregar();
    } catch (e) {
      notificar.erro(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="saude-regras" className="max-w-3xl space-y-4">
      <h2 id="saude-regras" className="pn-secao-titulo">Regras do mural (só coordenação)</h2>
      <p className="pn-ajuda">
        O arquivo de regras (versão do termo {dados.termo_versao}) tem {dados.grupos_do_arquivo} grupos de termos bloqueados e o limite de {dados.sobre_maximo} caracteres no texto do perfil.
        Aqui você só pode acrescentar termos e pausar categorias, nunca afrouxar.
      </p>
      <fieldset className="space-y-1">
        <legend className="font-semibold">Categorias</legend>
        {dados.categorias.map((c) => (
          <Marca
            key={c.id}
            rotulo={`Pausar ${c.id} (${c.conselho})${c.ligada_no_arquivo ? "" : " — já desligada no arquivo"}`}
            checked={pausadas.includes(c.id)}
            onChange={(e) => setPausadas((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))}
          />
        ))}
      </fieldset>
      <div className="space-y-4">
        {grupos.map((g, i) => (
          <div key={i} className="space-y-2 rounded-md border border-rule p-3">
            <Campo rotulo="Nome do grupo" value={g.grupo} maxLength={40} onChange={(e) => mudar(i, { grupo: e.target.value })} />
            <Area rotulo="Termos (um por linha)" rows={3} value={g.termos.join("\n")} onChange={(e) => mudar(i, { termos: e.target.value.split("\n") })} ajuda="De 2 a 60 caracteres cada, até 30 termos." />
            <Campo rotulo="Motivo mostrado a quem escreveu" value={g.motivo} maxLength={200} onChange={(e) => mudar(i, { motivo: e.target.value })} />
            <Campo rotulo="Sugestão (opcional)" value={g.sugestao} maxLength={200} onChange={(e) => mudar(i, { sugestao: e.target.value })} />
            <Botao variante="discreto" perigo onClick={() => setGrupos((x) => x.filter((_, j) => j !== i))}>Tirar este grupo</Botao>
          </div>
        ))}
        <Botao disabled={grupos.length >= 30} onClick={() => setGrupos((x) => [...x, { grupo: "", termos: [""], motivo: "", sugestao: "" }])}>Acrescentar um grupo de termos</Botao>
      </div>
      <Botao variante="principal" disabled={ocupado} onClick={() => void salvar()}>Guardar as regras</Botao>
    </section>
  );
}

/** Tira linhas vazias e espaços antes de enviar (a tela guarda o texto cru enquanto se digita). */
export function limparGrupos(grupos: Grupo[]): Grupo[] {
  return grupos.map((g) => ({ ...g, grupo: g.grupo.trim(), termos: g.termos.map((t) => t.trim()).filter(Boolean), motivo: g.motivo.trim(), sugestao: g.sugestao.trim() }));
}
