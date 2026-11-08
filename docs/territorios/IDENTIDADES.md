# Identidades visuais dos territórios (T20, 06/11/2026)

O que foi observado no Instagram de cada coletivo parceiro (perfil público, aberto no Chrome do Jonathan em 06/11/2026, sem login) e como isso virou o desenho de cada página. Nenhuma arte dos coletivos foi copiada além da logo (cedida pela parceria) e dos cartazes que já estavam no site com autorização. As cores estão em `lib/territorios-identidades.ts`; o desenho de cada abertura, em `components/territorios/PaginaDoColetivo.tsx`.

Regra para todas as páginas: contraste AA (texto normal ≥ 4,5:1, texto grande ≥ 3:1) entre `tinta` e `fundo`, entre `tinta` e `papel` e entre o texto do botão e a cor de destaque. O teste `npm run testar:territorios` confere isso.

## Logos

As quatro logos vieram da foto de perfil de cada coletivo no Instagram (a única versão pública, 150 × 150 px). Em 08/11/2026, com autorização do Jonathan para ampliar até Full HD, cada uma ganhou duas versões em `public/territorios/<slug>/`: `logo.webp` (1080 px, usada nos cartões) e `logo-1920.webp` (1920 px, usada na abertura grande de cada página; campo `logo.grande` em `content/territorios.json`). Crédito na página: "Logo cedida pelo coletivo".

- **NoizOcupa, Coletivo Kamikaze e Coletivo Desordem:** super-resolução de verdade com um modelo Real-ESRGAN ×4 em ONNX (rodado localmente com onnxruntime em Python; só o arquivo `.onnx` foi baixado, nenhum executável), com o resultado ajustado para 1920 px. Comparada lado a lado com a ampliação antiga, ficou mais fiel nas bordas das letras e do spray.
- **noismemo studios:** a elipse "NM" é forma chapada, então foi **redesenhada em vetor** (`logo.svg`: elipse vazada e o NM em polígono de retas) e conferida sobre a foto de perfil; o WebP de 1080 e 1920 sai desse SVG.
- **Na Atividade:** a logo (a forma vermelha em degrau, `#F80E11` sobre branco) foi redesenhada em vetor a partir da foto de perfil (`logo.svg`, `logo.webp` de 1080 px). Desde 08/11/2026 ela é a **capa** da página (`capa.webp`, 1920 × 1080, a logo centralizada no branco) e a imagem do cartão em /territorios; o resto da página do Na Atividade não mudou.
- Continua valendo: **pedir a cada coletivo o arquivo original da logo** (vetor ou PNG grande) e trocar os arquivos acima; a super-resolução melhora a nitidez, mas não recupera detalhe que a foto de 150 px não tinha.

## Vídeos (08/11/2026)

Reels autorizados pelo Jonathan, servidos do próprio site (`<video>` com `preload="metadata"`, `playsInline`, quadro parado tirado do vídeo), com legenda, data e crédito com link para o post original. Ficam no campo `videos` de `content/territorios.json`. Sem ffmpeg nesta máquina, os arquivos de mais de 10 MB ficaram como vieram (12,6 MB e 12,8 MB); comprimir quando houver ffmpeg.

- **noismemo studios** — `processo-halftrack.mp4` (reel DdmiFfLzCsG, 22/09/2026): colaboração com @xangssss, o processo criativo do upcycling do tênis Oakley Halftrack Low II em chinelo; som de @kyanmaloka e @mu540.
- **Coletivo Desordem** — `notados.mp4` (reel DcwwKbapD_w, 01/09/2026): "Fomos notados pela bruxona @amarinasena", #coletivodeteatro.
- **Coletivo Desordem** — `galpao-pescaria.mp4` (reel DbQXOI2tH6k, 26/07/2026): post do Galpão Cultural Cubatão em colaboração com o coletivo, "Venham, vai ter pescaria!".

## Redesenho das quatro páginas (08/11/2026)

`components/territorios/PaginaDoColetivo.tsx` + `styles/territorios-coletivos.css` + uma letra por coletivo em `lib/fontes-coletivos.ts` (Google Fonts via next/font, sem pré-carga). Todas seguem a mesma ordem: abertura com a logo grande, quem são, trabalho em destaque, vídeos, cartazes, agenda e links, parceria com o Instituto (com as trilhas) e crédito. O que muda é o mundo de cada um:

- **NoizOcupa** (Titan One): muro vinho com grão de papel, o nome em letra gorda arredondada com sombra escura, o lema numa tira de lambe mostarda de borda serrilhada, a logo como cartaz lambe-lambe rasgado preso com fita, a galeria como cartazes colados em ângulos diferentes.
- **Coletivo Kamikaze** (Anton): abertura amarela com retícula de xerox, o número como canhoto de ingresso, o nome em letra de cartaz de cinema, o slogan em tarja preta e rosa, a logo numa marquise de lâmpadas amarelas e rosa, fita de filme; o resto é a sala escura com os acentos girando pela paleta dos cartazes.
- **Coletivo Desordem** (Rubik Spray Paint): preto com halos e respingos de spray, as letras do nome tortas em amarelo com sombra vermelha deslocada, a bio com os símbolos ("D3$0rdeπ∆nDø a Arte¡!", decorativa: o leitor de tela lê o slogan), a logo colada torta com escorrido de tinta, os vídeos em molduras giradas.
- **noismemo studios** (Inter Tight 900): ficha técnica com fio fino, régua de selos NM, o nome enorme e apertado, a logo numa prancha com marcas de corte e cota "FIG. 01", tudo em preto e branco puro.

## NoizOcupa (@noizocupa) — Itanhaém (SP)

- **Logo:** "NOIZ" em letras gordas e arredondadas, vazadas em vinho dentro de uma placa branca, com "OCUPA" pequeno e condensado dentro do O.
- **Cores dos posts:** vinho/bordô de fundo com textura de papel, branco-creme na letra e mostarda/laranja nos títulos ("FESTA DAS CRIANÇAS", "guapurá", "CHAMADA PARA PROFISSIONAIS").
- **Letras:** display gorda e arredondada (estilo anos 70) nos títulos, sans espaçada em caixa alta nas linhas de apoio ("UNIR · ORGANIZAR · FORTALECER") e letra gótica/tag de pichação em posts como "Tudo que noiz tem é noiz".
- **Estilo:** cartaz lambe-lambe, muro, fotos com filtro quente e granulado.
- **Na página:** fundo vinho com pontilhado, placa branca da logo, títulos em letra grossa, sombras duras escuras, cartões inclinados como cartaz colado (já era assim; ganhou a logo no lugar do cartaz da festa, que foi para a galeria).

## Coletivo Kamikaze (@coletivokamikaze)

- **Logo:** boca preta com dente de ouro e brilho, sobre **amarelo puro**, e "COLETIVO KAMIKAZE" em letra de quadrinho/trash, preta.
- **Cores dos posts:** o amarelo da logo é a cor-mãe. Os cartazes variam muito: amarelo com verde-bandeira ("Defenda o cinema nacional"), rosa e azul-bebê desbotados ("Proteja os direitos trans"), vermelho, laranja e verde-escuro nos cartazes do cinema, e o neon rosa e azul do "Em cartaz" (do vídeo do anúncio).
- **Letras:** condensada pesada (cartaz de cinema), manuscrita, e a letra irregular de quadrinho da logo.
- **Estilo:** cartaz de cinema de rua, letreiro de marquise com lâmpadas, xerox, pop.
- **Na página (antes: só rosa e preto):** abertura amarela com a logo, faixa de temas em verde-bandeira, sala escura com acentos que mudam por bloco (amarelo, verde, rosa, azul) e letreiro de lâmpadas em volta da logo. O magenta ficou só como mais uma cor, não a única.

## Coletivo Desordem (@coletivodesordem) — Cubatão, Baixada Santista

- **Bio:** "D3$0rdeπ∆nDø a Arte¡!", "Cubatão - Baixada santista", "Grupo teatral em experimentação", "Ocupante do @galpaoculturalcubatao".
- **Logo:** um triângulo de "play" pintado em spray, amarelo com sombra vermelha e halo preto borrado, cercado das letras de "DESORDEM" soltas e tortas, como pichação.
- **Cores dos posts:** amarelo, vermelho e preto da logo; cartazes em creme com vermelho ("Oficina de cartazes"), verde e amarelo ("Cubatão com Lula"), verde-claro ("Integração: Arte, Ciência e Território").
- **Letras:** a própria bio troca letras por símbolos ($, π, ∆, ø, ¡): a desordem é tipográfica. Títulos condensados e pesados nos cartazes.
- **Estilo:** spray, letras desalinhadas, teatro de grupo, oficina de cartaz.
- **Na página:** fundo preto com halo de spray, títulos em amarelo com sombra vermelha deslocada, letras levemente giradas no nome (só no desenho; o leitor de tela lê o nome normal), cartaz creme e vermelho para a agenda.
- **Posts usados:** estreia de "Cumpadi Cordel" (DZ5PpLIlTXp, 22/06), apresentação no Festival Ocupacena no Teatro do Kaos (DbjqDolJSTW, 12/08), Cumpadi Cordel em Cubatão no Ocupacena (DcgxEJzCW36), oficina de confecção de cartazes no Galpão Cultural (Deh-GjwpOSW, 17/10; DeroyhWDdTm), roda "Integração: Arte, Ciência e Território" no IFSP Campus Cubatão (Deze1EjpCpB, 26/10).

## Noisme Studios (@noismemostudios)

- **Bio:** "noismemo studios", "por nós, para os nossos.", "colaboartório de pesquisa e criação", parceiro do Instituto Lúcia.
- **Logo:** "NM" em letra pesada e inclinada dentro de uma elipse preta, sobre branco, no jeito das marcas esportivas dos anos 2000.
- **Cores e letras:** monocromático (preto, branco, cinza de foto). Sans grotesca pesada, apertada, caixa alta, em blocos justificados ("PROCESSO ©RIATIVO DE HALF TRACK LOW II AO UPCICLYNG DE CHINELO."), o © no lugar do C.
- **Estilo:** estúdio, ficha técnica, foto de produto em preto e branco, upcycling, moda e funk.
- **Na página:** branco e preto puro, grade de ficha técnica com linhas finas, título enorme e apertado, elipse da logo repetida como selo, cinza só nas legendas. Por enquanto o perfil tem um único post público (colaboração com @xangssss, 22/09/2026: o processo de transformar um tênis Oakley Halftrack Low II em chinelo por upcycling). A página fica curta e honesta: **o Jonathan deve pedir ao estúdio o texto de apresentação, quem faz parte e os trabalhos.**
