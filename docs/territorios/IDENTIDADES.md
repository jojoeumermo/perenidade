# Identidades visuais dos territórios (T20, 06/11/2026)

O que foi observado no Instagram de cada coletivo parceiro (perfil público, aberto no Chrome do Jonathan em 06/11/2026, sem login) e como isso virou o desenho de cada página. Nenhuma arte dos coletivos foi copiada além da logo (cedida pela parceria) e dos cartazes que já estavam no site com autorização. As cores estão em `lib/territorios-identidades.ts`; o desenho de cada abertura, em `components/territorios/PaginaDoColetivo.tsx`.

Regra para todas as páginas: contraste AA (texto normal ≥ 4,5:1, texto grande ≥ 3:1) entre `tinta` e `fundo`, entre `tinta` e `papel` e entre o texto do botão e a cor de destaque. O teste `npm run testar:territorios` confere isso.

## Logos

As quatro logos são a foto de perfil de cada coletivo no Instagram (a única versão pública, 150 × 150 px, ampliada para 480 × 480 em WebP). Crédito na página: "Logo cedida pelo coletivo". **Pedir a cada coletivo o arquivo original da logo (vetor ou PNG grande) e trocar em `public/territorios/<slug>/logo.webp`**: a ampliação de 150 px fica um pouco borrada.

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
