// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useLista } from "../comum";
import { Area, Botao, Campo, confirmar, Dialogo, Esqueleto, Vazio } from "../ui";
import { duracaoEmTexto, erroDaFaixa, erroDoCanalDaRadio, segundosDoTexto } from "./regras";
import { useControle } from "./usarControle";

interface Faixa {
  id: string;
  titulo: string;
  artista: string;
  url: string;
  duracao: number;
  ordem: number;
}
interface Canal {
  id: string;
  nome: string;
  descricao: string;
  ordem: number;
  faixas: Faixa[];
}
interface Estado {
  no_ar: boolean;
  canais?: Canal[];
}

type EdicaoDeCanal = { id: string | null; nome: string; descricao: string; ordem: string };
type EdicaoDeFaixa = { id: string | null; canal: string; titulo: string; artista: string; url: string; duracao: string; ordem: string };

/**
 * Canais e faixas da Rádio Lúcia (public.radio_canal_salvar e radio_faixa_salvar; coordenação, vice e jornalismo). A Rádio
 * pelo YouTube (no ar, fora do ar) continua em RadioNoAr; aqui ficam os canais de áudio e as faixas que tocam no tocador do
 * site. Só vale áudio de licença livre ou do próprio instituto, com o crédito no campo "Artista e crédito".
 * O endereço precisa ser https (o navegador não toca áudio http dentro de uma página https).
 */
export function RadioCanais() {
  const lista = useLista<Estado>("radio_estado", {}, { quieta: true });
  const { executar, ocupado } = useControle(lista.recarregar);
  const [canal, setCanal] = useState<EdicaoDeCanal | null>(null);
  const [faixa, setFaixa] = useState<EdicaoDeFaixa | null>(null);
  if (!lista.dados) {
    return lista.erro ? (
      <p role="alert" className="pn-erro">
        {lista.erro}
      </p>
    ) : (
      <Esqueleto />
    );
  }
  const canais = lista.dados.canais ?? [];

  async function salvarCanal() {
    if (!canal || erroDoCanalDaRadio(canal.nome)) return;
    const ordem = Number.parseInt(canal.ordem, 10);
    const r = await executar("radio_canal_salvar", { p_id: canal.id, p_nome: canal.nome.trim(), p_descricao: canal.descricao.trim(), p_ordem: Number.isFinite(ordem) ? ordem : 0 }, "Canal guardado.");
    if (r) setCanal(null);
  }
  async function salvarFaixa() {
    if (!faixa || erroDaFaixa(faixa.titulo, faixa.url)) return;
    const duracao = segundosDoTexto(faixa.duracao);
    if (duracao === null) return;
    const ordem = Number.parseInt(faixa.ordem, 10);
    const r = await executar(
      "radio_faixa_salvar",
      { p_id: faixa.id, p_canal: faixa.canal, p_titulo: faixa.titulo.trim(), p_artista: faixa.artista.trim(), p_url: faixa.url.trim(), p_duracao: duracao, p_ordem: Number.isFinite(ordem) ? ordem : 0 },
      "Faixa guardada.",
    );
    if (r) setFaixa(null);
  }
  async function removerCanal(c: Canal) {
    const certo = await confirmar({
      titulo: `Remover o canal "${c.nome}"?`,
      texto: c.faixas.length ? `As ${c.faixas.length} faixas dele também saem da rádio. Não dá para desfazer.` : "Não dá para desfazer.",
      confirmar: "Remover canal",
      perigo: true,
    });
    if (certo) await executar("radio_canal_remover", { p_id: c.id }, "Canal removido.");
  }
  async function removerFaixa(f: Faixa) {
    const certo = await confirmar({ titulo: `Remover a faixa "${f.titulo}"?`, texto: "Ela sai do tocador da rádio. Não dá para desfazer.", confirmar: "Remover faixa", perigo: true });
    if (certo) await executar("radio_faixa_remover", { p_id: f.id }, "Faixa removida.");
  }

  const erroCanal = canal ? erroDoCanalDaRadio(canal.nome) : "";
  const erroFaixa = faixa ? erroDaFaixa(faixa.titulo, faixa.url) : "";
  const duracaoInvalida = faixa ? segundosDoTexto(faixa.duracao) === null : false;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="pn-barra-ferramentas">
        <p className="pn-ajuda" style={{ flex: 1 }}>
          Canais de áudio da Rádio Lúcia e as faixas de cada um. Use só áudio de licença livre ou do próprio instituto e ponha o crédito em &ldquo;Artista e crédito&rdquo;. O endereço precisa ser https.
        </p>
        <Botao variante="principal" onClick={() => setCanal({ id: null, nome: "", descricao: "", ordem: String(canais.length + 1) })}>
          Novo canal
        </Botao>
      </div>

      {canais.length === 0 ? (
        <Vazio titulo="Nenhum canal ainda" texto="Crie o primeiro canal (por exemplo, Música livre ou Programas) e depois acrescente as faixas." />
      ) : (
        canais.map((c) => (
          <section key={c.id} className="pn-cartao" aria-labelledby={`canal-${c.id}`} style={{ display: "grid", gap: "0.7rem" }}>
            <div className="pn-barra-ferramentas">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 id={`canal-${c.id}`} className="pn-secao-titulo">
                  {c.nome}
                </h3>
                {c.descricao && <p className="pn-ajuda">{c.descricao}</p>}
              </div>
              <Botao pequeno onClick={() => setCanal({ id: c.id, nome: c.nome, descricao: c.descricao, ordem: String(c.ordem) })}>
                Editar canal
              </Botao>
              <Botao pequeno perigo disabled={ocupado} onClick={() => void removerCanal(c)}>
                Remover
              </Botao>
            </div>
            {c.faixas.length === 0 ? (
              <p className="pn-ajuda">Canal sem faixas.</p>
            ) : (
              <ul className="pn-fila-lista" aria-label={`Faixas de ${c.nome}`}>
                {c.faixas.map((f) => (
                  <li key={f.id} className="pn-barra-ferramentas" style={{ padding: "0.35rem 0" }}>
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                      <strong>{f.titulo}</strong>
                      {f.artista ? ` · ${f.artista}` : ""} <span className="pn-ajuda">{f.duracao ? duracaoEmTexto(f.duracao) : ""}</span>
                    </span>
                    <Botao pequeno variante="discreto" onClick={() => setFaixa({ id: f.id, canal: c.id, titulo: f.titulo, artista: f.artista, url: f.url, duracao: f.duracao ? duracaoEmTexto(f.duracao) : "", ordem: String(f.ordem) })}>
                      Editar
                    </Botao>
                    <Botao pequeno variante="discreto" perigo disabled={ocupado} onClick={() => void removerFaixa(f)}>
                      Remover
                    </Botao>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <Botao pequeno onClick={() => setFaixa({ id: null, canal: c.id, titulo: "", artista: "", url: "", duracao: "", ordem: String(c.faixas.length + 1) })}>
                Nova faixa neste canal
              </Botao>
            </div>
          </section>
        ))
      )}

      <Dialogo aberto={Boolean(canal)} aoMudar={(a) => !a && setCanal(null)} titulo={canal?.id ? "Editar canal" : "Novo canal"}>
        {canal && (
          <form
            style={{ display: "grid", gap: "0.8rem" }}
            onSubmit={(e) => {
              e.preventDefault();
              void salvarCanal();
            }}
          >
            <Campo rotulo="Nome do canal" value={canal.nome} maxLength={60} onChange={(e) => setCanal({ ...canal, nome: e.target.value })} erro={canal.nome && erroCanal ? erroCanal : ""} required />
            <Area rotulo="Descrição" value={canal.descricao} maxLength={300} rows={3} onChange={(e) => setCanal({ ...canal, descricao: e.target.value })} ajuda="Até 300 letras." />
            <Campo rotulo="Posição na lista" inputMode="numeric" value={canal.ordem} onChange={(e) => setCanal({ ...canal, ordem: e.target.value.replace(/\D/g, "") })} />
            <div className="pn-dialogo-acoes">
              <Botao onClick={() => setCanal(null)}>Cancelar</Botao>
              <Botao type="submit" variante="principal" disabled={ocupado || Boolean(erroCanal)}>
                Guardar canal
              </Botao>
            </div>
          </form>
        )}
      </Dialogo>

      <Dialogo aberto={Boolean(faixa)} aoMudar={(a) => !a && setFaixa(null)} titulo={faixa?.id ? "Editar faixa" : "Nova faixa"} largo>
        {faixa && (
          <form
            style={{ display: "grid", gap: "0.8rem" }}
            onSubmit={(e) => {
              e.preventDefault();
              void salvarFaixa();
            }}
          >
            <Campo rotulo="Título" value={faixa.titulo} maxLength={160} onChange={(e) => setFaixa({ ...faixa, titulo: e.target.value })} required />
            <Campo rotulo="Artista e crédito" value={faixa.artista} maxLength={120} onChange={(e) => setFaixa({ ...faixa, artista: e.target.value })} ajuda="Quem fez, com a licença se houver (por exemplo, CC BY 4.0)." />
            <Campo
              rotulo="Endereço do áudio"
              type="url"
              inputMode="url"
              value={faixa.url}
              maxLength={500}
              onChange={(e) => setFaixa({ ...faixa, url: e.target.value })}
              placeholder="https://…"
              erro={faixa.url && erroFaixa && !erroFaixa.startsWith("O título") ? erroFaixa : ""}
              required
            />
            <Campo rotulo="Duração" value={faixa.duracao} onChange={(e) => setFaixa({ ...faixa, duracao: e.target.value })} placeholder="3:25" erro={duracaoInvalida ? "Use minutos e segundos, como 3:25." : ""} ajuda="Opcional." />
            <Campo rotulo="Posição no canal" inputMode="numeric" value={faixa.ordem} onChange={(e) => setFaixa({ ...faixa, ordem: e.target.value.replace(/\D/g, "") })} />
            <div className="pn-dialogo-acoes">
              <Botao onClick={() => setFaixa(null)}>Cancelar</Botao>
              <Botao type="submit" variante="principal" disabled={ocupado || Boolean(erroFaixa) || duracaoInvalida}>
                Guardar faixa
              </Botao>
            </div>
          </form>
        )}
      </Dialogo>
    </div>
  );
}
