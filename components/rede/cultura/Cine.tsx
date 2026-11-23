// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 40: o cineclube da comunidade. A sessão é um encontro da comunidade (interno.rede_encontros) em lugar público, marcado só pela
// moderação; o diário de filmes guarda o que a roda conversou, sem dizer quem escreveu. Ninguém conta quem viu: sem ranking, sem
// "vou", sem número de presentes.
import { useId, useState } from "react";
import { confirmar } from "@/components/perguntar";
import { cultura } from "@/lib/rede/cultura/cliente";
import { LOCAIS, anoOk, localPublico, type Local } from "@/lib/rede/cultura/regras";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { CampoDeQuando } from "../ui/CampoDeQuando";
import { EstadoDaAlumia } from "../ui/Estado";
import { Mensagem, diaEHora, fraseDoErro, useAcao, useLeitura, type PropsDaParte } from "./comum";

export default function Cine({ t, lang, comunidade }: PropsDaParte) {
  const campo = useId();
  const slug = comunidade ?? "";
  const leitura = useLeitura(slug ? `cine:${slug}` : null, () => cultura.cine(slug));
  const acao = useAcao(t, leitura.recarregar);
  const [quando, setQuando] = useState("");
  const [tipo, setTipo] = useState<Local>("biblioteca");
  const [lugar, setLugar] = useState("");
  const [filme, setFilme] = useState("");
  const [ano, setAno] = useState("");
  const [sinopse, setSinopse] = useState("");
  const [nFilme, setNFilme] = useState("");
  const [nAno, setNAno] = useState("");
  const [nota, setNota] = useState("");
  const [sessao, setSessao] = useState("");
  const c = leitura.dado;

  if (leitura.erro) {
    return (
      <EstadoDaAlumia erro texto={fraseDoErro(t, leitura.erro)}>
        <Botao variante="contorno" onClick={leitura.recarregar}>{t.tentar}</Botao>
      </EstadoDaAlumia>
    );
  }
  if (!c) return <p role="status" className="cu-miudo">{t.carregando}</p>;

  const marcar = () => {
    if (!localPublico(lugar)) return acao.avisar(t.cine.marcar.localRuim);
    if (!anoOk(ano)) return acao.avisar(t.cine.marcar.anoRuim);
    const data = new Date(quando);
    if (!Number.isFinite(data.getTime())) return acao.avisar(t.erros.invalido);
    void acao.fazer(async () => {
      await cultura.marcarSessao({ comunidade: slug, quando: data.toISOString(), local_tipo: tipo, local_texto: lugar.trim(), filme: filme.trim(), ano: ano.trim(), sinopse: sinopse.trim() });
      setQuando("");
      setLugar("");
      setFilme("");
      setAno("");
      setSinopse("");
      return t.cine.marcar.feita;
    });
  };

  const anotar = () => {
    if (!anoOk(nAno)) return acao.avisar(t.cine.marcar.anoRuim);
    void acao.fazer(async () => {
      await cultura.anotar(slug, nFilme.trim(), nAno.trim(), nota.trim(), sessao || null);
      setNFilme("");
      setNAno("");
      setNota("");
      setSessao("");
      return t.cine.anotar.feita;
    });
  };

  return (
    <div className="cu-colunas">
      <div className="cu-bloco">
        <h2 className="cu-subtitulo al-cond">{t.cine.titulo}</h2>
        <p className="cu-miudo">{t.cine.ajuda}</p>
        {!c.posso && <p className="cu-miudo" role="note">{t.comunidade.soLer}</p>}
        <Mensagem mensagem={acao.mensagem} />

        <h3 className="cu-form-titulo">{t.cine.sessoes}</h3>
        {c.sessoes.length === 0 ? (
          <p className="cu-miudo">{t.cine.semSessoes}</p>
        ) : (
          <ul className="cu-lista">
            {c.sessoes.map((s) => (
              <li key={s.id} className="cu-item">
                <p className="cu-etiqueta al-cond">{diaEHora(lang, s.quando)}</p>
                <strong className="cu-item-titulo">{s.filme}{s.ano ? ` (${s.ano})` : ""}</strong>
                <p className="cu-miudo">{preencher(t.cine.onde, { local: [t.locais[s.local_tipo], s.local_texto].filter(Boolean).join(" · ") })}</p>
                {s.sinopse && <p className="cu-texto">{s.sinopse}</p>}
                {c.modero && (
                  <div className="cu-acoes">
                    <Botao
                      variante="fantasma"
                      tamanho="p"
                      disabled={acao.ocupado}
                      onClick={() =>
                        void acao.fazer(async () => {
                          if (!(await confirmar(t.cine.perguntaDesmarcar, { perigo: true, sim: t.cine.desmarcar }))) return null;
                          await cultura.desmarcarSessao(s.id);
                          return t.cine.desmarcada;
                        })
                      }
                    >
                      {t.cine.desmarcar}
                    </Botao>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <h3 className="cu-form-titulo">{t.cine.diario}</h3>
        {c.diario.length === 0 ? (
          <p className="cu-miudo">{t.cine.semDiario}</p>
        ) : (
          <ul className="cu-lista">
            {c.diario.map((d) => (
              <li key={d.id} className="cu-item">
                <strong className="cu-item-titulo">{d.filme}{d.ano ? ` (${d.ano})` : ""}</strong>
                {d.nota && <p className="cu-texto">{d.nota}</p>}
                {(d.minha || c.modero) && (
                  <div className="cu-acoes">
                    <Botao
                      variante="fantasma"
                      tamanho="p"
                      disabled={acao.ocupado}
                      onClick={() =>
                        void acao.fazer(async () => {
                          if (!(await confirmar(t.cine.perguntaTirarNota, { sim: t.cine.tirarNota }))) return null;
                          await cultura.tirarNota(d.id);
                          return t.cine.notaTirada;
                        })
                      }
                    >
                      {t.cine.tirarNota}
                    </Botao>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cu-bloco cu-lado">
        {c.modero && (
          <form
            className="cu-form"
            aria-labelledby={`${campo}-marcar`}
            onSubmit={(e) => {
              e.preventDefault();
              marcar();
            }}
          >
            <h3 id={`${campo}-marcar`} className="cu-form-titulo">{t.cine.marcar.titulo}</h3>
            <p className="cu-miudo">{t.cine.marcar.ajuda}</p>
            <div className="cu-campo">
              <span id={`${campo}-quando`}>{t.cine.marcar.quando}</span>
              <CampoDeQuando id={`${campo}-quando-campo`} valor={quando} aoMudar={setQuando} lang={lang} vazio={t.cine.marcar.quando} aria-label={t.cine.marcar.quando} />
            </div>
            <label className="cu-campo">
              <span>{t.cine.marcar.local}</span>
              <select className="al2-campo" value={tipo} onChange={(e) => setTipo(e.target.value as Local)}>
                {LOCAIS.map((l) => <option key={l} value={l}>{t.locais[l]}</option>)}
              </select>
            </label>
            <label className="cu-campo">
              <span>{t.cine.marcar.texto}</span>
              <input className="al2-campo" value={lugar} onChange={(e) => setLugar(e.target.value)} maxLength={140} required={tipo === "outro"} />
            </label>
            <div className="cu-duas">
              <label className="cu-campo">
                <span>{t.cine.marcar.filme}</span>
                <input className="al2-campo" value={filme} onChange={(e) => setFilme(e.target.value)} maxLength={120} required />
              </label>
              <label className="cu-campo">
                <span>{t.cine.marcar.ano}</span>
                <input className="al2-campo" value={ano} onChange={(e) => setAno(e.target.value)} inputMode="numeric" maxLength={4} />
              </label>
            </div>
            <label className="cu-campo">
              <span>{t.cine.marcar.sinopse}</span>
              <textarea className="al2-campo" value={sinopse} onChange={(e) => setSinopse(e.target.value)} maxLength={500} rows={2} />
            </label>
            <Botao type="submit" disabled={acao.ocupado || !quando}>{t.cine.marcar.marcar}</Botao>
          </form>
        )}

        {c.posso && (
          <form
            className="cu-form"
            aria-labelledby={`${campo}-anotar`}
            onSubmit={(e) => {
              e.preventDefault();
              anotar();
            }}
          >
            <h3 id={`${campo}-anotar`} className="cu-form-titulo">{t.cine.anotar.titulo}</h3>
            <div className="cu-duas">
              <label className="cu-campo">
                <span>{t.cine.anotar.filme}</span>
                <input className="al2-campo" value={nFilme} onChange={(e) => setNFilme(e.target.value)} maxLength={120} required />
              </label>
              <label className="cu-campo">
                <span>{t.cine.anotar.ano}</span>
                <input className="al2-campo" value={nAno} onChange={(e) => setNAno(e.target.value)} inputMode="numeric" maxLength={4} />
              </label>
            </div>
            <label className="cu-campo">
              <span>{t.cine.anotar.nota}</span>
              <textarea className="al2-campo" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} rows={3} />
            </label>
            {c.sessoes.length > 0 && (
              <label className="cu-campo">
                <span>{t.cine.anotar.sessao}</span>
                <select className="al2-campo" value={sessao} onChange={(e) => setSessao(e.target.value)}>
                  <option value="">{t.cine.anotar.nenhuma}</option>
                  {c.sessoes.map((s) => <option key={s.id} value={s.id}>{s.filme} · {diaEHora(lang, s.quando)}</option>)}
                </select>
              </label>
            )}
            <Botao type="submit" disabled={acao.ocupado}>{t.cine.anotar.anotar}</Botao>
          </form>
        )}
      </div>
    </div>
  );
}
