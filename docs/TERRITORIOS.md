# Territórios: NoizOcupa e Coletivo Kamikaze (Etapa 6, B1/B21)

Páginas novas em `/territorios/noizocupa` e `/territorios/coletivo-kamikaze`, mais a faixa de temas em todos os territórios.

## O que existe

- Dados em `content/territorios.json` (campos novos opcionais: `visual`, `slogan`, `anuncio`, `agenda`; tipos em `lib/territorios.ts`).
- Página: `components/territorios/PaginaDoColetivo.tsx`, escolhida em `app/[lang]/territorios/[slug]/page.tsx` quando o território tem `visual`. O Na Atividade segue com a página dele, sem mudança.
- Cores de cada identidade: `lib/territorios-identidades.ts`.
- Faixa de temas (marquee): `components/territorios/Letreiro.tsx` (reexportado por `components/Territorios.tsx`). Aparece no Na Atividade, nos dois novos e, com os temas de todos, na lista `/territorios`.
- Vídeo: `components/territorios/PlayerDoAnuncio.tsx`; leitura do arquivo local em `lib/territorios-video.ts`.
- Textos de interface: chaves novas em `territorios` nos 6 idiomas (`anuncio*`, `agenda*`, `letreiro*`). O conteúdo dos coletivos (JSON) está só em português; nos outros idiomas aparece o aviso de "sem tradução" (rascunho).

## Para o Jonathan: colocar o vídeo

1. Peça aos coletivos o arquivo original do vídeo (não baixe do Instagram).
2. Salve como `public/territorios/noizocupa/anuncio.mp4` e `public/territorios/coletivo-kamikaze/anuncio.mp4` (H.264/AAC, de preferência até 20 MB).
3. Refaça o build. Se o arquivo existe, a página toca o `<video>` local (nada de fora, `preload="none"`). Se não existe, aparece o cartão "Carregar o vídeo do Instagram".
4. Pendente de acessibilidade: o vídeo local precisa de legenda (`<track kind="captions">` com arquivo .vtt) e, se tiver fala, transcrição. Combinar com os coletivos.

## Privacidade

- Nada de terceiros carrega sozinho. O quadro do Instagram (`instagram.com/p/<código>/embed/`) só é criado depois do clique, com aviso de que abre conteúdo da Meta. A CSP (`next.config.ts`) ganhou `https://www.instagram.com` só em `frame-src`.
- Nenhuma contagem, nenhum rastreio, nenhum script externo. Não mostramos número de seguidores nem curtidas.
- O link "Abrir o post no Instagram" fica sempre visível.

## Faixa de temas (marquee acessível)

- O leitor de tela lê uma lista escondida, uma vez só; as cópias que giram são `aria-hidden`.
- Pausa ao passar o mouse, ao focar e pelo botão de pausa (`aria-pressed`), WCAG 2.2.2.
- Com `prefers-reduced-motion` ou no modo leve (`data-light`), a faixa não anda: os temas quebram de linha e o botão some.

## Fontes e o que conferir

- Texto do NoizOcupa: legenda do post do anúncio (instagram.com/p/DfQT6U0uJ2G/) e perfil (instagram.com/noizocupa): coletivo de Itanhaém (SP), "A cultura acontece onde a vida acontece", educação popular gratuita e acessível, Festa das Crianças em 21 de novembro, 13h, Escola de Samba Unidos do Guapurá, apoio por mensagem direta. **Conferir data, ano e endereço com o coletivo antes de divulgar.** A página usa só texto: nenhuma foto de criança.
- Texto do Kamikaze: perfil (instagram.com/coletivokamikaze): lema "Sonhando sem coleira"; temas audiovisual periférico, olhares negros e LGBTQIAPN+, cultura de favela "para os nossos". A biografia veio cortada ("Núcleo de...") e cidade e pessoas não aparecem no que é público: **o Jonathan deve pedir ao coletivo o texto de apresentação, a cidade e os nomes**.
- **Identidade visual:** o Instagram bloqueou a leitura visual dos anúncios (do NoizOcupa veio só a legenda; do Kamikaze, nada do post). As cores e letras foram criadas de forma coerente com o que é público, sem copiar arte: NoizOcupa = amarelo de cartaz, azul-noite, laranja, letra grossa, adesivos inclinados; Kamikaze = sala de cinema escura, magenta, fita de filme e marcação de tempo. **Conferir com o anúncio de cada coletivo e ajustar em `lib/territorios-identidades.ts` e nas classes de `PaginaDoColetivo.tsx`.**
- Grafia: "NoizOcupa" (N e O maiúsculos, junto). O nome aparece sem `uppercase` no CSS para não virar "NOIZOCUPA".

## Lei (conferida em planalto.gov.br)

- Lei 9.610/1998, art. 29, caput: a utilização da obra depende de autorização prévia e expressa do autor. A liberação dos coletivos para vídeos e imagens foi informada pelo Jonathan; guardar o registro por escrito. O crédito aparece na página e o vídeo do Instagram não é baixado nem copiado.
- Imagem de pessoas no vídeo (Código Civil, art. 20; dados sensíveis na LGPD, Lei 13.709/2018, art. 5º, II e art. 11; artigos citados de memória, não reconferidos nesta etapa): a autorização é do coletivo, mas confirmar com ele que quem aparece autorizou.
- ECA (Lei 8.069/1990): nenhuma imagem de criança é publicada nesta página.

## Teste

`npm run testar:territorios` confere os dados, os 6 idiomas, a CSP e os contratos do player e da faixa.
