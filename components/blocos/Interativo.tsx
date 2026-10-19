// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { Interativo as Tipo } from "@/lib/interativos";

// Cada bloco interativo baixa o próprio código só quando aparece na aula: aula sem blocos não carrega nada a mais.
// O next/dynamic só aceita as opções escritas em cada chamada.
const espera = () => <p className="no-print my-6 font-sans text-sm text-ink-soft">…</p>;
const GraficoDeFuncao = dynamic(() => import("./Graficos").then((m) => m.GraficoDeFuncao), { ssr: false, loading: espera });
const CalculadoraDeVariaveis = dynamic(() => import("./Graficos").then((m) => m.CalculadoraDeVariaveis), { ssr: false, loading: espera });
const GraficoDeDados = dynamic(() => import("./Graficos").then((m) => m.GraficoDeDados), { ssr: false, loading: espera });
const Teste = dynamic(() => import("./Jogos").then((m) => m.Teste), { ssr: false, loading: espera });
const Cartoes = dynamic(() => import("./Jogos").then((m) => m.Cartoes), { ssr: false, loading: espera });
const Memoria = dynamic(() => import("./Jogos").then((m) => m.Memoria), { ssr: false, loading: espera });
const Forca = dynamic(() => import("./Jogos").then((m) => m.Forca), { ssr: false, loading: espera });
const CacaPalavras = dynamic(() => import("./Jogos").then((m) => m.CacaPalavras), { ssr: false, loading: espera });
const Pronuncia = dynamic(() => import("./Midia").then((m) => m.Pronuncia), { ssr: false, loading: espera });
const Diagrama = dynamic(() => import("./Midia").then((m) => m.Diagrama), { ssr: false, loading: espera });
const LinhaDoTempo = dynamic(() => import("./Midia").then((m) => m.LinhaDoTempo), { ssr: false, loading: espera });
const Desenho = dynamic(() => import("./Midia").then((m) => m.Desenho), { ssr: false, loading: espera });
const Ferramenta = dynamic(() => import("./Midia").then((m) => m.Ferramenta), { ssr: false, loading: espera });
const Musica = dynamic(() => import("./Midia").then((m) => m.Musica), { ssr: false, loading: espera });
const Simulacao = dynamic(() => import("./Ciencia").then((m) => m.Simulacao), { ssr: false, loading: espera });
const Molecula = dynamic(() => import("./Ciencia").then((m) => m.Molecula), { ssr: false, loading: espera });
const Geometria = dynamic(() => import("./Ciencia").then((m) => m.Geometria), { ssr: false, loading: espera });
const Mapa = dynamic(() => import("./Mapa").then((m) => m.Mapa), { ssr: false, loading: espera });
const Programacao = dynamic(() => import("./Programar").then((m) => m.Programacao), { ssr: false, loading: espera });
const Rodar = dynamic(() => import("./Programar").then((m) => m.Rodar), { ssr: false, loading: espera });
const Cena = dynamic(() => import("./Montar").then((m) => m.Cena), { ssr: false, loading: espera });
const Arrastar = dynamic(() => import("./Montar").then((m) => m.Arrastar), { ssr: false, loading: espera });
const Frase = dynamic(() => import("./Montar").then((m) => m.Frase), { ssr: false, loading: espera });

const COMPONENTES: Record<Tipo, React.ComponentType<{ spec: string }>> = {
  grafico: GraficoDeFuncao,
  geometria: Geometria,
  simulacao: Simulacao,
  molecula: Molecula,
  mapa: Mapa,
  programacao: Programacao,
  rodar: Rodar,
  cena: Cena,
  arrastar: Arrastar,
  frase: Frase,
  musica: Musica,
  calculadora: CalculadoraDeVariaveis,
  dados: GraficoDeDados,
  teste: Teste,
  cartoes: Cartoes,
  memoria: Memoria,
  forca: Forca,
  cacapalavras: CacaPalavras,
  pronuncia: Pronuncia,
  diagrama: Diagrama,
  linhadotempo: LinhaDoTempo,
  desenho: Desenho,
  ferramenta: Ferramenta,
};

/** Se o bloco quebrar (dado mal escrito, navegador antigo), a aula continua e mostra o conteúdo em texto. */
class Reserva extends Component<{ spec: string; children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  render() {
    return this.state.erro ? <pre className="my-6 whitespace-pre-wrap font-sans text-sm">{this.props.spec}</pre> : this.props.children;
  }
}

export function Interativo({ tipo, spec }: { tipo: Tipo; spec: string }) {
  const Bloco = COMPONENTES[tipo];
  return (
    <Reserva spec={spec}>
      <Bloco spec={spec} />
    </Reserva>
  );
}
