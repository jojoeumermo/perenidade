// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import type { BloqueioNaBorda, EstadoDaBorda } from "@/lib/rede/admin/tipos";
import { Estado, Etiqueta, falta, motivoDe, Nota, quando, Quadro, textoDoErroDaAlumia, Titulo, useJanela } from "../pecas";
import { chamarRota } from "./cliente";

const PRAZOS = [
  { id: "24", nome: "24 horas" },
  { id: "48", nome: "2 dias" },
  { id: "72", nome: "3 dias" },
  { id: "168", nome: "7 dias" },
];

/**
 * Durante um ataque: bloquear na Cloudflare, com prazo, o endereço que está atacando (visto agora, por exemplo no painel da
 * Cloudflare). O endereço é digitado aqui, vai ao servidor do site e dele direto à Cloudflare; a Alumia guarda só o número da
 * regra e a hora de vencer, e a regra sai sozinha quando vence. A chave da Cloudflare mora só no servidor.
 */
export function Ataque({ recarregarEstado }: { recarregarEstado: () => void }) {
  const { pedir, janela } = useJanela();
  const [leitura, setLeitura] = useState<{ dados: EstadoDaBorda | null; erro: string; carregando: boolean }>({ dados: null, erro: "", carregando: true });
  const ler = useCallback(() => {
    setLeitura((l) => ({ ...l, carregando: !l.dados, erro: "" }));
    chamarRota<EstadoDaBorda>("/api/alumia/admin/borda", { acao: "estado" })
      .then((dados) => setLeitura({ dados, erro: "", carregando: false }))
      .catch((erro: unknown) => setLeitura((l) => ({ dados: l.dados, erro: textoDoErroDaAlumia(erro), carregando: false })));
  }, []);
  useEffect(() => {
    const marca = window.setTimeout(ler, 0);
    return () => window.clearTimeout(marca);
  }, [ler]);
  const depois = () => {
    ler();
    recarregarEstado();
  };

  const bloquear = () =>
    pedir({
      titulo: "Bloquear na borda (Cloudflare)",
      texto: (
        <>
          <p>A Cloudflare passa a recusar tudo o que vem deste endereço (ou desta faixa) até o prazo acabar; depois a regra sai sozinha.</p>
          <p>Endereço de celular e de wi-fi de escola, ocupação ou sindicato é dividido por muita gente: prefira o prazo curto e o endereço exato.</p>
        </>
      ),
      campos: [
        { tipo: "texto", nome: "ip", rotulo: "Endereço ou faixa (IPv4 ou IPv6)", min: 3, max: 60, aviso: "Não fica guardado na Alumia: vai direto à Cloudflare." },
        { tipo: "escolha", nome: "horas", rotulo: "Por quanto tempo", opcoes: PRAZOS, valor: "24" },
        { tipo: "motivo", aviso: "Não escreva o endereço nem o nome ou o @ de uma conta: o motivo fica guardado na Alumia." },
        { tipo: "lista", rotulo: "Confira antes", itens: ["O endereço está atacando agora (eu vi, por exemplo no painel da Cloudflare).", "Sei que o bloqueio vale para todo mundo que usa esse endereço."] },
      ],
      confirmar: "Bloquear na Cloudflare",
      perigo: true,
      fazer: (v) => chamarRota("/api/alumia/admin/borda", { acao: "bloquear", ip: String(v.ip).trim(), horas: Number(v.horas), motivo: motivoDe(v) }),
      sucesso: "Bloqueado na Cloudflare. A regra sai sozinha no fim do prazo.",
      depois,
    });
  const tirar = (b: BloqueioNaBorda) =>
    pedir({
      titulo: "Tirar o bloqueio agora",
      texto: <p>A regra sai da Cloudflare agora, antes do prazo ({quando(b.vence_em)}).</p>,
      campos: [{ tipo: "motivo" }],
      confirmar: "Tirar o bloqueio",
      fazer: (v) => chamarRota("/api/alumia/admin/borda", { acao: "tirar", id: b.id, motivo: motivoDe(v) }),
      sucesso: "Bloqueio tirado.",
      depois,
    });

  const d = leitura.dados;
  return (
    <div className="ap-tela">
      <Titulo nome="Ataque: bloqueio na borda" sobre="Para a hora de um ataque: o painel manda à Cloudflare um bloqueio com prazo, de 24 horas a 7 dias, que sai sozinho. O endereço digitado aqui não fica guardado na Alumia, nem ligado a conta nenhuma.">
        <Botao variante="contorno" tamanho="p" onClick={ler}>
          Atualizar
        </Botao>
      </Titulo>
      <Estado leitura={{ ...leitura, recarregar: ler }} />
      {d && !d.configurada ? (
        <Quadro titulo="Falta configurar no servidor" tom="perigo">
          <p className="ap-sobre">
            O servidor do site ainda não tem as variáveis da Cloudflare (<code>ALUMIA_CF_TOKEN</code> e <code>ALUMIA_CF_ZONA</code>). Sem elas, o botão não faz nada. O painel não muda variável do servidor: quem cuida do
            servidor põe as duas e reinicia o site.
          </p>
        </Quadro>
      ) : null}
      {d ? (
        <>
          <Quadro titulo="Bloquear um endereço" tom="perigo">
            <p className="ap-sobre">Antes de bloquear na borda, veja se não basta fechar a porta de entrada (Beta fechado) ou banir a conta: bloqueio por endereço pega gente inocente que divide a mesma rede.</p>
            <div>
              <Botao variante="primario" disabled={!d.configurada} title={d.configurada ? undefined : "Falta configurar a Cloudflare no servidor."} onClick={bloquear}>
                Bloquear na Cloudflare…
              </Botao>
            </div>
          </Quadro>
          <Quadro titulo="Bloqueios em vigor" lado={<Etiqueta tom={d.lista?.ativos.length ? "vermelho" : undefined}>{d.lista?.ativos.length ?? 0}</Etiqueta>}>
            {!d.lista || d.lista.ativos.length === 0 ? <Nota>Nenhum bloqueio em vigor.</Nota> : null}
            <ul className="ap-lista">
              {d.lista?.ativos.map((b) => (
                <li key={b.id} className="ap-linha">
                  <span className="ap-linha-texto">
                    <span className="ap-linha-cabeca">
                      <Etiqueta tom="vermelho">sai {falta(b.vence_em)}</Etiqueta>
                      <span className="ap-miudo">
                        desde {quando(b.criado_em)}
                        {b.quem ? ` · por ${b.quem}` : ""}
                      </span>
                    </span>
                    <span className="ap-quebra">{b.motivo}</span>
                  </span>
                  <span className="ap-linha-acoes">
                    <Botao variante="contorno" tamanho="p" disabled={!d.configurada} onClick={() => tirar(b)}>
                      Tirar agora…
                    </Botao>
                  </span>
                </li>
              ))}
            </ul>
            <p className="ap-miudo">O endereço bloqueado aparece só no painel da Cloudflare. Aqui ficam o motivo, quem bloqueou e o prazo.</p>
          </Quadro>
          {d.lista && d.lista.recentes.length > 0 ? (
            <Quadro titulo="Saíram há pouco">
              <ul className="ap-lista">
                {d.lista.recentes.map((b) => (
                  <li key={b.id} className="ap-linha">
                    <span className="ap-linha-texto">
                      <span className="ap-miudo">
                        de {quando(b.criado_em)} a {quando(b.removida_em)}
                        {b.quem ? ` · por ${b.quem}` : ""}
                      </span>
                      <span className="ap-quebra">{b.motivo}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Quadro>
          ) : null}
        </>
      ) : null}
      {janela}
    </div>
  );
}
