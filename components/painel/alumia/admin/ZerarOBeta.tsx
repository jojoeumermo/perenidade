// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import type { ContaDePessoas } from "@/lib/rede/admin/tipos";
import { notificar } from "../../ui";
import { motivoDe, Nota, Quadro, textoDoErroDaAlumia, useJanela } from "../pecas";

/** O que a prévia devolve (supabase/migracoes/20261126-p5-beta.sql, public.alumia_admin_zerar_previa). */
interface PreviaDoZerar {
  id: string;
  manter_contas: boolean;
  frase: string;
  expira_em: string;
  tocaria: string[];
  previa: {
    posts: number;
    posts_das_disciplinas_ficam: number;
    stories: number;
    midias: number;
    avisos: number;
    rascunhos: number;
    contas_saem: ContaDePessoas;
  };
}

/** A espera entre a prévia e a confirmação: o banco recusa antes de 10 segundos. */
export const ESPERA_DO_ZERAR_S = 12;

const pessoas = (c: ContaDePessoas) => (c.n !== null ? `${c.n} contas` : c.algum ? "menos de 3 contas" : "nenhuma conta");

/**
 * Zerar o beta (P5, A21): a Alumia mora no mesmo banco do instituto, então "zerar" é uma rotina daqui, em dois passos. Primeiro a
 * prévia (nada sai): os números do que sai e a escolha das contas. Depois, passados alguns segundos, a confirmação com a frase e
 * o motivo. Só a coordenação com o segundo fator; tudo no registro. O chat não entra: o servidor não guarda conversa da Alumia
 * desde a R2, e as caixas anônimas servem também à conversa da equipe.
 */
export function ZerarOBeta({ recarregar }: { recarregar: () => void }) {
  const { pedir, janela } = useJanela();
  const [manterContas, setManterContas] = useState(true);
  const [previa, setPrevia] = useState<PreviaDoZerar | null>(null);
  const [lendo, setLendo] = useState(false);
  const [previaEm, setPreviaEm] = useState(0);
  const [agora, setAgora] = useState(0);
  // A contagem até poder confirmar (o segundo momento): o relógio anda só enquanto há prévia na tela.
  const falta = previa ? Math.max(0, Math.ceil((previaEm + ESPERA_DO_ZERAR_S * 1000 - agora) / 1000)) : 0;

  useEffect(() => {
    if (!previa) return;
    const id = window.setInterval(() => setAgora(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [previa]);

  async function verPrevia() {
    setLendo(true);
    try {
      const p = await rpc<PreviaDoZerar>("alumia_admin_zerar_previa", { p_manter_contas: manterContas });
      const t = Date.now();
      setPreviaEm(t);
      setAgora(t);
      setPrevia(p);
    } catch (erro) {
      notificar.erro(textoDoErroDaAlumia(erro));
    } finally {
      setLendo(false);
    }
  }

  const confirmar = () => {
    if (!previa) return;
    pedir({
      titulo: "Zerar o beta",
      texto: (
        <>
          <p>
            Saem {previa.previa.posts} posts, {previa.previa.stories} stories, {previa.previa.midias} arquivos de mídia, {previa.previa.avisos} avisos da Alumia e{" "}
            {previa.previa.rascunhos} rascunhos e agendados. {previa.manter_contas ? "As contas ficam como estão." : `${pessoas(previa.previa.contas_saem)} saem da Alumia (a conta do instituto fica).`}
          </p>
          <Nota tom="perigo">Não tem volta: o que sai do banco não volta, e os arquivos vão para a fila que apaga no depósito. Nada do instituto é tocado.</Nota>
        </>
      ),
      campos: [{ tipo: "motivo" }, { tipo: "frase", frase: previa.frase }],
      confirmar: "Zerar agora",
      perigo: true,
      fazer: (v) => rpc("alumia_admin_zerar_confirmar", { p_id: previa.id, p_frase: String(v.frase ?? "").trim(), p_motivo: motivoDe(v) }),
      sucesso: "Beta zerado. Os arquivos saem do depósito na próxima rodada da faxina.",
      depois: () => {
        setPrevia(null);
        recarregar();
      },
    });
  };

  return (
    <Quadro titulo="Zerar o beta" tom="perigo">
      <p className="ap-miudo">
        O beta não tem banco separado: a Alumia mora no mesmo banco do instituto. Zerar apaga só o que é da Alumia: posts (menos as salas das disciplinas, que são da Escola), stories,
        destaques, rascunhos, agendados, mídias e avisos da Alumia. Nada roda sozinho: primeiro a prévia, depois a confirmação com a frase.
      </p>
      <fieldset className="aa-zerar-contas">
        <legend className="ap-forte">As contas</legend>
        <label className="aa-zerar-opcao">
          <input type="radio" name="aa-zerar-contas" checked={manterContas} onChange={() => { setManterContas(true); setPrevia(null); }} />
          <span>Manter as contas: quem está dentro continua dentro, só o conteúdo sai.</span>
        </label>
        <label className="aa-zerar-opcao">
          <input type="radio" name="aa-zerar-contas" checked={!manterContas} onChange={() => { setManterContas(false); setPrevia(null); }} />
          <span>Contas saem da Alumia: o consentimento é revogado, a ficha da entrada sai e quem quiser volta pela triagem. A conta do instituto fica. A equipe fica dentro.</span>
        </label>
      </fieldset>
      {previa ? (
        <div aria-live="polite" style={{ display: "grid", gap: "0.5rem" }}>
          <ul className="ap-lista">
            <li className="ap-linha"><span className="ap-forte">Posts que saem</span><span>{previa.previa.posts}</span></li>
            <li className="ap-linha"><span className="ap-forte">Posts das salas das disciplinas (ficam)</span><span>{previa.previa.posts_das_disciplinas_ficam}</span></li>
            <li className="ap-linha"><span className="ap-forte">Stories</span><span>{previa.previa.stories}</span></li>
            <li className="ap-linha"><span className="ap-forte">Arquivos de mídia</span><span>{previa.previa.midias}</span></li>
            <li className="ap-linha"><span className="ap-forte">Avisos da Alumia</span><span>{previa.previa.avisos}</span></li>
            <li className="ap-linha"><span className="ap-forte">Rascunhos e agendados</span><span>{previa.previa.rascunhos}</span></li>
            <li className="ap-linha"><span className="ap-forte">Contas que saem</span><span>{previa.manter_contas ? "nenhuma (manter)" : pessoas(previa.previa.contas_saem)}</span></li>
          </ul>
          {previa.tocaria.length > 0 ? (
            <Nota tom="perigo">Uma tabela de fora da Alumia está ligada a um post ({previa.tocaria.join(", ")}): o banco não deixa zerar até isso ser revisto.</Nota>
          ) : null}
          <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
            <Botao variante="primario" tamanho="p" disabled={falta > 0 || previa.tocaria.length > 0} onClick={confirmar}>
              {falta > 0 ? `Confirmar em ${falta} s` : "Zerar o beta…"}
            </Botao>
            <Botao variante="fantasma" tamanho="p" onClick={() => setPrevia(null)}>
              Desistir
            </Botao>
          </div>
        </div>
      ) : (
        <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
          <Botao variante="contorno" tamanho="p" disabled={lendo} onClick={() => void verPrevia()}>
            {lendo ? "Contando…" : "Ver o que sai (nada é apagado)"}
          </Botao>
        </div>
      )}
      <p className="ap-miudo">
        As conversas não entram: desde a R2 o servidor não guarda conversa da Alumia (as do beta saíram com a troca do chat), e o que sobra são caixas anônimas que a conversa da
        equipe também usa. Cada pessoa apaga as conversas no próprio aparelho.
      </p>
      {janela}
    </Quadro>
  );
}
