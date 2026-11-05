# Laboratórios externos (Etapa 5)

Página: `/pt/laboratorios/externos` (também aparecem em Segurança e Simulações). Dados em `content/labs-externos/catalogo.json`;
componente `components/labs/LabsExternos.tsx`; teste `npm run testar:labs-externos`. Tudo conferido em 04/11/2026.

Regras: nada de fora carrega antes de a pessoa clicar em "Abrir"; sem rastreio; crédito e licença à vista em cada cartão. Os quadros de
fora usam `sandbox` e `referrerPolicy="no-referrer"`; os hosts liberados no `frame-src` (next.config.ts) são só
`brunolemos.github.io`, `netlogoweb.org` e `www.geogebra.org`.

| Nome | Licença | Forma | Crédito |
|---|---|---|---|
| LOOPY (v1.1) | CC0 1.0 | Cópia em `public/labs/loopy/` (1,7 MB), interface traduzida para o português | Nicky Case; tradução Instituto Lúcia |
| Parable of the Polygons | CC0 1.0 | Cópia em `public/labs/polygons/` (0,5 MB), em inglês | Vi Hart e Nicky Case |
| The Evolution of Trust (pt-BR) | CC0 1.0 (original e fork do Bruno Lemos, conferido pela API do GitHub) | Sob demanda, quadro de `brunolemos.github.io/trust/` | Nicky Case; tradução Bruno Lemos |
| Complexity Explorables | CC BY 2.0 Alemanha (página "about") | Só link | Dirk Brockmann e colaboradores |
| NetLogo Web: Segregation, Wolf Sheep Predation, Fire, Virus, Traffic Basic, Climate Change | CC BY-NC-SA 3.0 (conferido no texto de cada modelo); NetLogo GPL | Sob demanda, quadro de `netlogoweb.org`, sem cópia | Wilensky, U. (1997, 1998, 2007), CCL, Northwestern |
| GeoGebra | GeoGebra Non-Commercial License | Sob demanda, quadro de `geogebra.org/classic` | "Made with GeoGebra®" |
| Chrome Music Lab | Apache-2.0 (8 experimentos no GitHub); o resto sem código | Só link | Google Creative Lab |
| Gráfico "Quanto se vive" (Brasil e mundo, 1950 a 2023) | OWID CC BY 4.0; ONU WPP 2024 CC BY 3.0 IGO | Gráfico próprio em SVG, dados em `content/labs-externos/owid-expectativa-vida.json` | Our World in Data; UN WPP (2024), com processamento do OWID |
| CyberChef v11.5.0 | Apache-2.0 | Só link (release de 79,3 MB, acima de 15 MB) | GCHQ |
| earth.nullschool.net | MIT (código); dados GFS e Natural Earth | Só link | Cameron Beccario |
| GeaCron | Não conferida | Só link | GeaCron |
| CircuitVerse | MIT | Só link (o site proíbe quadro: X-Frame-Options) | Projeto CircuitVerse |
| oimo.io | Não informada | Só link | shr (saharan) |

## O que saiu ou mudou e por quê

- **Anatomy Atelier:** saiu. `anatomyatelier.com` está estacionado (à venda) e o plano já dizia "sem licença". Se o Jonathan souber o endereço atual,
  pedir licença ao autor antes de qualquer uso.
- **CyberChef self-host:** não. O zip estável tem 79,3 MB; passa do limite de 15 MB, então só link. Quem quiser baixa o zip oficial.
- **Chrome Music Lab:** o experimento "Ondas sonoras" (Apache-2.0) foi copiado e testado com a política de segurança do site e falhou:
  usa `new Function` (cwise/ndarray), exigindo `unsafe-eval`. Removido; fica só link. "Harmonics" depende do Tone.js hospedado pelo Google.
  Os outros experimentos do repositório (acordes, arpejos, piano roll, espectrograma, soundspinner) precisam de build e não foram feitos.
  O repositório está arquivado desde abril de 2026.
- **The Evolution of Trust:** hospedar cópia não vale: o original traz um efeito sonoro CC BY-NC (Owdeo). A tradução oficial listada no README do projeto
  (Português do Brasil, Bruno Lemos) é aberta sob demanda.
- **LOOPY traduzido:** menus, botões, rótulos, diálogos de link/incorporar e o crédito. Ficaram em inglês as páginas "como usar" e "exemplos"
  (imagens) e as dicas de teclas. Removidos do menu os links de apoio (Patreon, livro) do autor, mantendo o crédito a ele.
- **NetLogo:** a biblioteca de modelos não tem licença única; cada modelo traz a sua. Os seis escolhidos são CC BY-NC-SA 3.0 (uso não comercial
  e compartilhamento pela mesma licença). Por isso não são copiados nem alterados: o quadro abre o modelo do próprio netlogoweb.org. O
  "exportar em HTML" do plano não foi feito pelo mesmo motivo (seria cópia derivada sob NC-SA).
- **GeoGebra:** a página de licença não trata de incorporação; o site do GeoGebra carrega medição de audiência própria (Google Analytics, gerenciador
  de etiquetas, aviso de cookies). Por isso só abre por clique, com aviso. **Pendência para o Jonathan:** confirmar por escrito com
  office@geogebra.org o uso incorporado, educacional e sem fins comerciais.
- **Inventados/inexistentes:** nenhum dos itens do plano deixou de existir, exceto o Anatomy Atelier (domínio estacionado).

## Pendências

1. Tradução de Parable of the Polygons para o português (o projeto tem `translator/`); hoje em inglês.
2. Teste real dos quadros de NetLogo Web e GeoGebra dentro do site em produção (frame-src foi liberado; o endereço `netlogoweb.org/launch#<modelo>` segue o
   formato do próprio site, mas não foi aberto no navegador aqui).
3. Chrome Music Lab: compilar os experimentos que não usam `unsafe-eval` (ou aceitar só o link).
4. Textos de descrição em es/fr/ru/zh: só interface traduzida (rascunho); descrições aparecem em inglês.
5. Mais dados do Our World in Data (cada gráfico com a série conferida e a licença da fonte original).
