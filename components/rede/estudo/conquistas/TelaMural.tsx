// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O mural de aprovados (/alumia/aprovados, frente 11E): quem passou e quis contar. A pessoa se inscreve por vontade própria, com o
// nome do perfil (com link) ou com um codinome só para o mural (sem link), curso, instituição e recado opcionais, e sai quando
// quiser. A ordem é só a de chegada; não há contagem nem destaque. A mediação tira inscrição abusiva (o banco confere o papel).
import "./conquistas.css";
import { useCallback, useEffect, useId, useState } from "react";
import { EsqueletoDaLinha } from "../../Esqueletos";
import { Confirmar, Torradas, useTorrada } from "../../conversa/base3";
import type { PropsDaTelaDoPacote } from "../../registro";
import { Botao } from "../../ui/Botao";
import Link from "@/components/Link";
import { enderecos, handleOk } from "@/lib/rede/tipos";
import { conquistas, type CamposDaInscricao } from "./cliente";
import { LIMITES_DO_MURAL, mesDoMural, type Inscricao, type MinhaInscricao } from "./regras";
import { mesEscrito, por, textoDoErro, type TextosDasConquistas } from "./textos";
import { useTextosDasConquistas } from "./usarTextos";

export default function TelaMural({ lang, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDasConquistas(lang);
  const [itens, setItens] = useState<Inscricao[] | null>(null);
  const [proximo, setProximo] = useState<string | null>(null);
  const [minha, setMinha] = useState<MinhaInscricao | null>(null);
  const [erro, setErro] = useState("");
  const [rodada, setRodada] = useState(0);
  const [editando, setEditando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [tirando, setTirando] = useState<Inscricao | null>(null);
  const torradas = useTorrada();
  const avisar = torradas.mostrar;

  useEffect(() => {
    if (!t) return;
    let vivo = true;
    Promise.all([conquistas.mural(null, 30), conquistas.minhaInscricao()])
      .then(([pagina, eu]) => {
        if (!vivo) return;
        setItens(pagina.itens);
        setProximo(pagina.proximo);
        setMinha(eu);
        setErro("");
      })
      .catch((e) => vivo && setErro(textoDoErro(t.erros, e)));
    return () => {
      vivo = false;
    };
  }, [t, rodada]);

  const recarregar = useCallback(() => setRodada((n) => n + 1), []);
  const aoErro = useCallback((e: unknown) => t && avisar({ texto: textoDoErro(t.erros, e), erro: true }), [t, avisar]);

  async function mais() {
    if (!proximo || !t) return;
    try {
      const r = await conquistas.mural(proximo, 30);
      setItens((l) => [...(l ?? []), ...r.itens.filter((n) => !(l ?? []).some((x) => x.id === n.id))]);
      setProximo(r.proximo);
    } catch (e) {
      aoErro(e);
    }
  }

  if (!t) return <EsqueletoDaLinha rotulo="" quantos={3} />;
  if (!itens && !erro) return <EsqueletoDaLinha rotulo={t.carregando} quantos={3} />;
  if (!itens) {
    return (
      <div className="cq cq-vazio-tela" role="alert">
        <p>{erro}</p>
        <Botao variante="contorno" onClick={recarregar}>{t.tentar}</Botao>
      </div>
    );
  }
  const cuida = Boolean(situacao.cuida || situacao.equipe);

  return (
    <div className="cq">
      <header className="cq-alto">
        <p className="cq-carimbo al-cond">{t.mural.carimbo}</p>
        <h1 className="cq-titulo al-cond">{t.mural.titulo}</h1>
        <p className="cq-lead">{t.mural.lead}</p>
        {situacao.logado && !editando && (
          <div className="cq-alto-acoes">
            <Botao variante="primario" onClick={() => setEditando(true)}>{minha ? t.mural.editar : t.mural.entrar}</Botao>
            {minha && <Botao variante="contorno" onClick={() => setSaindo(true)}>{t.mural.sair}</Botao>}
          </div>
        )}
      </header>

      {editando && (
        <Formulario
          t={t}
          minha={minha}
          aoCancelar={() => setEditando(false)}
          aoSalvar={async (campos) => {
            try {
              await conquistas.entrar(campos);
              avisar({ texto: t.ok.salvo });
              setEditando(false);
              recarregar();
            } catch (e) {
              aoErro(e);
            }
          }}
        />
      )}

      {itens.length === 0 ? (
        <p className="cq-vazio">{t.mural.vazio}</p>
      ) : (
        <ul className="cq-mural">
          {itens.map((i, n) => (
            <li key={i.id} className="cq-inscricao" data-n={n % 5} data-minha={i.minha ? "sim" : undefined}>
              <h2 className="cq-inscricao-nome al-cond">{i.nome}</h2>
              {i.curso && <p className="cq-inscricao-curso">{i.curso}</p>}
              {i.instituicao && <p className="cq-inscricao-inst">{i.instituicao}</p>}
              {i.recado && <p className="cq-inscricao-recado">{i.recado}</p>}
              <p className="cq-inscricao-pe">
                {i.minha && <span className="cq-voce">{t.mural.voce}</span>}
                <span>{por(t.mural.mes, { mes: mesEscrito(lang, mesDoMural(i.mes), i.mes) })}</span>
                {i.handle && handleOk(i.handle) && <Link href={enderecos.perfil(lang, i.handle)}>{t.mural.verPerfil}</Link>}
                {cuida && !i.minha && (
                  <button type="button" className="cq-link cq-link-perigo" onClick={() => setTirando(i)}>{t.mural.tirar}</button>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {proximo && (
        <p className="cq-acoes">
          <Botao variante="contorno" onClick={() => void mais()}>{t.mural.mais}</Botao>
        </p>
      )}

      <Confirmar
        aberto={saindo}
        titulo={t.mural.sairTitulo}
        texto={t.mural.sairTexto}
        sim={t.mural.sairSim}
        nao={t.tela.nao}
        aoFechar={() => setSaindo(false)}
        aoSim={() => {
          conquistas
            .sair()
            .then(() => (avisar({ texto: t.ok.saiu }), recarregar()))
            .catch(aoErro);
        }}
      />
      {tirando && (
        <Tirar
          t={t}
          inscricao={tirando}
          aoFechar={() => setTirando(null)}
          aoTirar={async (motivo) => {
            try {
              await conquistas.tirar(tirando.id, motivo);
              avisar({ texto: t.ok.tirada });
              setTirando(null);
              recarregar();
            } catch (e) {
              aoErro(e);
            }
          }}
        />
      )}
      <Torradas estado={torradas} />
    </div>
  );
}

function Formulario({ t, minha, aoCancelar, aoSalvar }: { t: TextosDasConquistas; minha: MinhaInscricao | null; aoCancelar: () => void; aoSalvar: (c: CamposDaInscricao) => Promise<void> }) {
  const id = useId();
  const [como, setComo] = useState<"perfil" | "codinome">(minha?.como ?? "codinome");
  const [codinome, setCodinome] = useState(minha?.codinome ?? "");
  const [curso, setCurso] = useState(minha?.curso ?? "");
  const [instituicao, setInstituicao] = useState(minha?.instituicao ?? "");
  const [recado, setRecado] = useState(minha?.recado ?? "");
  const [enviando, setEnviando] = useState(false);
  const f = t.mural.form;
  return (
    <section className="cq-secao" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="cq-subtitulo al-cond">{f.titulo}</h2>
      <form
        className="cq-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setEnviando(true);
          await aoSalvar({ como, codinome: como === "codinome" ? codinome : undefined, curso, instituicao, recado });
          setEnviando(false);
        }}
      >
        <fieldset className="cq-campo">
          <legend>{f.como}</legend>
          <label className="cq-opcao">
            <input type="radio" name={`${id}-como`} value="codinome" checked={como === "codinome"} onChange={() => setComo("codinome")} />
            {f.codinome}
          </label>
          <label className="cq-opcao">
            <input type="radio" name={`${id}-como`} value="perfil" checked={como === "perfil"} onChange={() => setComo("perfil")} />
            {f.perfil}
          </label>
        </fieldset>
        {como === "codinome" && (
          <div className="cq-campo">
            <label htmlFor={`${id}-cod`}>{f.codinomeCampo}</label>
            <input id={`${id}-cod`} value={codinome} onChange={(e) => setCodinome(e.target.value)} required minLength={LIMITES_DO_MURAL.codinome[0]} maxLength={LIMITES_DO_MURAL.codinome[1]} autoComplete="off" />
          </div>
        )}
        <div className="cq-form-linha">
          <div className="cq-campo">
            <label htmlFor={`${id}-curso`}>{f.curso}</label>
            <input id={`${id}-curso`} value={curso} onChange={(e) => setCurso(e.target.value)} maxLength={LIMITES_DO_MURAL.curso[1]} autoComplete="off" aria-describedby={`${id}-curso-d`} />
            <span id={`${id}-curso-d`} className="cq-dica">{f.cursoDica}</span>
          </div>
          <div className="cq-campo">
            <label htmlFor={`${id}-inst`}>{f.instituicao}</label>
            <input id={`${id}-inst`} value={instituicao} onChange={(e) => setInstituicao(e.target.value)} maxLength={LIMITES_DO_MURAL.instituicao[1]} autoComplete="off" />
          </div>
        </div>
        <div className="cq-campo">
          <label htmlFor={`${id}-recado`}>{f.recado}</label>
          <textarea id={`${id}-recado`} value={recado} onChange={(e) => setRecado(e.target.value)} maxLength={LIMITES_DO_MURAL.recado[1]} aria-describedby={`${id}-recado-d`} />
          <span id={`${id}-recado-d`} className="cq-dica">{f.recadoDica}</span>
        </div>
        <div className="cq-acoes" style={{ marginTop: 0 }}>
          <Botao type="submit" variante="primario" disabled={enviando}>{f.salvar}</Botao>
          <Botao variante="contorno" onClick={aoCancelar}>{f.cancelar}</Botao>
        </div>
      </form>
    </section>
  );
}

function Tirar({ t, inscricao, aoFechar, aoTirar }: { t: TextosDasConquistas; inscricao: Inscricao; aoFechar: () => void; aoTirar: (motivo: string) => Promise<void> }) {
  const id = useId();
  const [motivo, setMotivo] = useState("");
  return (
    <section className="cq-secao" aria-labelledby={`${id}-t`} role="dialog" onKeyDown={(e) => { if (e.key === "Escape") aoFechar(); }}>
      <h2 id={`${id}-t`} className="cq-subtitulo al-cond">{t.mural.tirarTitulo}</h2>
      <p className="cq-nota">{inscricao.nome}</p>
      <form
        className="cq-form"
        onSubmit={(e) => {
          e.preventDefault();
          void aoTirar(motivo);
        }}
      >
        <div className="cq-campo">
          <label htmlFor={`${id}-m`}>{t.mural.tirarMotivo}</label>
          <textarea id={`${id}-m`} value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={3} maxLength={300} />
        </div>
        <div className="cq-acoes" style={{ marginTop: 0 }}>
          <Botao type="submit" variante="primario">{t.mural.tirarSim}</Botao>
          <Botao variante="contorno" onClick={aoFechar}>{t.mural.form.cancelar}</Botao>
        </div>
      </form>
    </section>
  );
}
