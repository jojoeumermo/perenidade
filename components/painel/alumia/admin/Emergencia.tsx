// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import { notificar } from "../../ui";
import { Campo, Estado, Etiqueta, motivoDe, Nota, Quadro, quando, textoDoErroDaAlumia, Titulo, useDado, useJanela } from "../pecas";

interface Topo {
  avisos: { id: string; texto: string; link: string | null; desde: string }[];
  so_leitura: { ligado: boolean; desde: string | null };
}

/**
 * Prompt 5, D1: os poderes de emergência da coordenação, num lugar só. O modo só leitura (um clique para ligar; desligar pede o
 * motivo) e o aviso geral no alto da Alumia (o mesmo aviso fixado da aba "Posts e mídias", que aparece no alto de toda página).
 * Quem decide é o banco (public.alumia_modo_so_leitura pede a coordenação com o segundo fator); tudo vai para o registro.
 */
export function Emergencia({ irPara }: { irPara: (aba: "conteudo" | "registro") => void }) {
  const topo = useDado<Topo>("alumia_topo");
  const { pedir, janela } = useJanela();
  const [ligando, setLigando] = useState(false);
  const ligado = topo.dados?.so_leitura.ligado === true;

  async function ligar() {
    setLigando(true);
    try {
      await rpc("alumia_modo_so_leitura", { p_ligar: true, p_motivo: "" });
      notificar.ok("Modo só leitura ligado. Ninguém publica nem muda nada até você desligar.");
      topo.recarregar();
    } catch (erro) {
      notificar.erro(textoDoErroDaAlumia(erro));
    } finally {
      setLigando(false);
    }
  }
  const desligar = () =>
    pedir({
      titulo: "Desligar o modo só leitura",
      texto: <p>A rede volta ao normal na hora: as pessoas voltam a publicar, comentar, reagir e seguir.</p>,
      campos: [{ tipo: "motivo" }],
      confirmar: "Desligar",
      fazer: (v) => rpc("alumia_modo_so_leitura", { p_ligar: false, p_motivo: motivoDe(v) }),
      sucesso: "Modo só leitura desligado.",
      depois: topo.recarregar,
    });

  return (
    <div className="ap-tela">
      <Titulo nome="Emergência" sobre="Os poderes para uma hora difícil: a rede em só leitura e o aviso geral no alto da Alumia. Toda mudança fica no registro." />
      {!topo.dados ? (
        <Estado leitura={topo} />
      ) : (
        <>
          <Quadro titulo="Modo só leitura" tom={ligado ? "perigo" : undefined}>
            <div className="ap-chave">
              <div className="ap-linha-texto">
                <span className="ap-linha-cabeca">
                  <span className="ap-forte">
                    <span className="ap-luz" data-ligado={ligado} aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                    A rede inteira
                  </span>
                  <Etiqueta tom={ligado ? "papel" : undefined}>{ligado ? "só leitura" : "normal"}</Etiqueta>
                </span>
                <span className="ap-miudo">
                  {ligado
                    ? `Ligado${topo.dados.so_leitura.desde ? ` em ${quando(topo.dados.so_leitura.desde)}` : ""}. Todo mundo lê; ninguém publica, comenta, reage, segue nem muda o perfil da rede. Uma faixa no alto da Alumia avisa.`
                    : "Para um ataque ou uma crise: liga na hora, num clique. Todo mundo continua lendo; ninguém publica, comenta, reage, segue nem muda nada na rede até você desligar."}
                </span>
              </div>
              <div className="ap-chave-lado">
                {ligado ? (
                  <Botao variante="claro" tamanho="p" onClick={desligar}>
                    Desligar…
                  </Botao>
                ) : (
                  <Botao variante="primario" tamanho="p" disabled={ligando} onClick={() => void ligar()}>
                    {ligando ? "Ligando…" : "Pôr em só leitura agora"}
                  </Botao>
                )}
              </div>
            </div>
            <Nota>
              Continua valendo, de propósito: apagar o que é seu, bloquear, silenciar, denunciar, sair de todos os aparelhos e as conversas cifradas (a cifra e o
              ritmo das conversas não mudam). A coordenação, a mediação e o admin da Alumia, com o código do autenticador, continuam moderando e podem publicar
              um aviso.
            </Nota>
          </Quadro>

          <Quadro titulo="Aviso geral no alto da Alumia">
            {topo.dados.avisos.length ? (
              <ul className="ap-lista">
                {topo.dados.avisos.map((a) => (
                  <li key={a.id} className="ap-miudo">
                    <span className="ap-forte">{a.texto}</span> · desde {quando(a.desde)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ap-miudo">Nenhum aviso no alto agora.</p>
            )}
            <p className="ap-miudo">
              O aviso aparece no alto de toda página da Alumia, para todo mundo que entra, com prazo de 1 a 30 dias (no máximo 3 de cada vez). Ninguém
              vê quem escreveu, e nada registra quem leu.
            </p>
            <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
              <Botao variante="claro" tamanho="p" onClick={() => irPara("conteudo")}>
                Escrever ou tirar um aviso
              </Botao>
              <Botao variante="fantasma" tamanho="p" onClick={() => irPara("registro")}>
                Ver o registro
              </Botao>
            </div>
          </Quadro>
        </>
      )}
      {janela}
    </div>
  );
}

interface Educadores {
  regra: "lista" | "militantes";
  educadores: { id: string; nome: string; desde: string }[];
}

interface Achada {
  id: string;
  nome: string;
  educador: boolean;
}

/**
 * Prompt 5, D1: a coordenação escolhe quem são os educadores da Escola (só eles, a coordenação e a vice marcam aula ao vivo da
 * Escola e dão aula junto). Enquanto ninguém for escolhido, vale a regra de antes: quem é militante da Frente. Para escolher, a
 * coordenação acha a pessoa pelo @ exato, uma por vez (auditoria do P5: nenhuma lista de militantes ligada ao @ da Alumia).
 */
export function EducadoresDaEscola() {
  const lista = useDado<Educadores>("alumia_escola_educadores");
  const { pedir, janela } = useJanela();
  const [arroba, setArroba] = useState("");
  const [achada, setAchada] = useState<Achada | null>(null);
  const [buscando, setBuscando] = useState(false);
  async function achar() {
    setBuscando(true);
    setAchada(null);
    try {
      setAchada(await rpc<Achada>("alumia_escola_educador_achar", { p_handle: arroba }));
    } catch (erro) {
      notificar.erro(textoDoErroDaAlumia(erro));
    } finally {
      setBuscando(false);
    }
  }
  const mudar = (id: string, nome: string, dar: boolean) =>
    pedir({
      titulo: dar ? `Fazer de ${nome} educador(a) da Escola` : `Tirar ${nome} dos educadores da Escola`,
      texto: dar ? (
        <p>Passa a marcar aula ao vivo da Escola e a dar aula junto.{lista.dados?.regra === "militantes" ? " Com a primeira pessoa escolhida, só quem está na lista (e a coordenação e a vice) marca aula da Escola." : ""}</p>
      ) : (
        <p>Deixa de marcar aula ao vivo da Escola. As aulas que já marcou continuam.{lista.dados?.educadores.length === 1 ? " A lista fica vazia: volta a regra de antes (quem é militante da Frente)." : ""}</p>
      ),
      campos: [{ tipo: "motivo" }],
      confirmar: dar ? "Escolher" : "Tirar",
      perigo: !dar,
      fazer: (v) => rpc("alumia_escola_educador", { p_usuario: id, p_dar: dar, p_motivo: motivoDe(v) }),
      sucesso: dar ? "Escolhido. Fica no registro." : "Tirado. Fica no registro.",
      depois: () => {
        setAchada(null);
        setArroba("");
        lista.recarregar();
      },
    });

  return (
    <div className="ap-tela">
      <Titulo nome="Escola: educadores" sobre="Quem dá aula na Escola Revolucionária. Só os educadores, a coordenação e a vice marcam aula ao vivo da Escola e dão aula junto. Os nomes são os codinomes." />
      {!lista.dados ? (
        <Estado leitura={lista} />
      ) : (
        <>
          <Nota>
            {lista.dados.regra === "lista"
              ? "Vale a lista: só quem está nela (e a coordenação e a vice) marca aula ao vivo da Escola."
              : "Ninguém foi escolhido ainda: vale a regra de antes, e todo militante da Frente marca aula ao vivo da Escola. Escolha a primeira pessoa para passar a valer a lista."}
          </Nota>
          <Quadro titulo="Educadores da Escola">
            {lista.dados.educadores.length ? (
              <ul className="ap-lista">
                {lista.dados.educadores.map((e) => (
                  <li key={e.id} className="ap-chave">
                    <span className="ap-linha-texto">
                      <span className="ap-forte">{e.nome}</span>
                      <span className="ap-miudo">desde {quando(e.desde)}</span>
                    </span>
                    <span className="ap-chave-lado">
                      <Botao variante="contorno" tamanho="p" onClick={() => mudar(e.id, e.nome, false)}>
                        Tirar…
                      </Botao>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ap-miudo">Nenhum educador escolhido.</p>
            )}
          </Quadro>
          <Quadro titulo="Escolher pelo @">
            <form
              className="ap-filtros"
              onSubmit={(e) => {
                e.preventDefault();
                if (arroba.trim()) void achar();
              }}
            >
              <Campo rotulo="O @ exato da pessoa na Alumia" largo>
                <input className="ap-entrada" value={arroba} onChange={(e) => setArroba(e.target.value)} placeholder="@codinome" autoComplete="off" spellCheck={false} />
              </Campo>
              <Botao type="submit" variante="claro" disabled={!arroba.trim() || buscando}>
                {buscando ? "Procurando…" : "Procurar"}
              </Botao>
            </form>
            {achada && (
              <div className="ap-chave">
                <span className="ap-forte">{achada.nome}</span>
                <span className="ap-chave-lado">
                  {achada.educador ? (
                    <span className="ap-miudo">já é educador(a)</span>
                  ) : (
                    <Botao variante="claro" tamanho="p" onClick={() => mudar(achada.id, achada.nome, true)}>
                      Escolher…
                    </Botao>
                  )}
                </span>
              </div>
            )}
            <p className="ap-miudo">Uma pessoa de cada vez, pelo @ inteiro. O painel não mostra lista de quem está na Frente.</p>
          </Quadro>
        </>
      )}
      {janela}
    </div>
  );
}
