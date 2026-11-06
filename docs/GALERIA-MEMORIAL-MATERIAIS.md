# Galeria, Memorial e Materiais para imprimir (Etapa 6: B36, B37, B38)

Teste: `npm run testar:galeria-memorial-materiais`.

## Regra de direito autoral usada

Lei 9.610/1998 (conferida em planalto.gov.br): art. 41, 70 anos contados de 1º de janeiro do ano seguinte à morte do autor; art. 43, obra anônima ou pseudônima, 70 anos desde 1º de janeiro do ano seguinte à primeira publicação; art. 44, obra fotográfica, 70 anos desde 1º de janeiro do ano seguinte à divulgação; art. 45, depois disso a obra cai em domínio público.

Por isso entrou só o que cumpre uma destas condições, além de a licença constar no Wikimedia Commons (conferida pela API do Commons, campo de licença):

- autor com morte confirmada em 1955 ou antes (Wikidata): por exemplo Maliutin 1932, Moor 1946, Deni 1946, Steinlen 1923, Posada 1913, Hy Mayer 1954, Alfred Stiller 1954;
- obra anônima publicada em 1955 ou antes;
- foto de 1955 ou antes;
- licença livre explícita de quem detém os direitos (CC0, CC BY), como já se fazia no memorial.

Ficaram de fora, por falha nessa regra: Sokolov-Skalia (morreu em 1961), Blanche Ames (1969), Ralph Chaplin (1961), Arteche (1964), cartazes de autor com morte não confirmada (Wila, Bayona, Bondi, Mukharski, Arlington Gregg), o Apsit repetido (já estava na galeria) e uma caricatura de rosto duplo de 1920 que podia remeter a estereótipo. Fotos de 1956 em diante só entram com licença livre explícita; fotos "domínio público" de autor desconhecido dos anos 1960 em diante (Edson Luís, Stuart Angel, Lolita Lebrón) não entraram.

## B36 Galeria

De 98 para 150 peças em `content/galeria.json` (52 novas, imagens em `public/imagens/galeria`, 1000 px de largura no máximo, WebP). Cada peça tem título, autor ("Autor não creditado" quando anônima), ano, lugar, texto e link do arquivo no Commons. O design não foi tocado. Cobertura: cartazes soviéticos de 1918 a 1931 e janelas da guerra, guerra civil espanhola, sufrágio feminino nos EUA, cartazes do KPD da República de Weimar, folhas volantes de Posada, Steinlen, cartazes do Projeto Federal de Arte dos EUA. O cartaz de Hirsch (1919) foi cortado para tirar a etiqueta do museu.

## B37 Memorial

- Tiradentes removido (arquivo e foto); o link `#tiradentes` da linha do tempo foi tirado. O Tiradentes continua na galeria como pintura histórica (Pedro Américo), pois o pedido só tirava do memorial.
- Duas pessoas novas fecham a grade de 5 colunas (109 - 1 + 2 = 110): José do Patrocínio (foto de domínio público, cerca de 1900) e Dom Hélder Câmara (foto de Hans Peters/Anefo, Nationaal Archief, CC BY-SA 3.0 NL). A fonte da biografia vai no fim do texto (verbetes da Wikipédia em português); a morte de Patrocínio aparece como "janeiro de 1905" porque o verbete traz dois dias diferentes.
- Fotos novas (11): Antônio Conselheiro (ilustração de 1897, não há retrato livre em vida; a única foto conhecida é do corpo e não foi usada), Gregório Bezerra (1932, Arquivo Público de SP), Eduardo Mondlane (1953), Sophie Scholl (1941, foto de Hans Scholl), Mártires de Chicago (August Spies, 1886), Dina Teixeira, Osvaldão, João Bosco Burnier (CC0, Memórias da Ditadura), Helenira Resende, Honestino Guimarães (CC BY 4.0, Comissão da Verdade de SP), Miguel Enríquez (CC BY 3.0 CL, Biblioteca do Congresso Nacional do Chile).
- Ainda sem foto livre (32, seguem com a vela): Ângelo Kretã, Os 43 de Ayotzinapa, Bartolina Sisa, Camilo Torres, Chicão Xukuru, Chris Hani, Dorothy Stang, Edson Luís, Eldorado dos Carajás, Ellacuría e companheiros, Expedito Ribeiro de Souza, Ezequiel Ramin, Frei Caneca, Frei Tito, Galdino, Irmãs Mirabal, Josimo, Ken Saro-Wiwa, Lolita Lebrón, Lucio Cabañas, Mãe Bernadete, Mamá Tingó, Manoel Congo, Marçal de Souza, Mário Alves, Moa do Katendê, Paulo Paulino, Santiago Maldonado, Sepé Tiaraju, Stuart Angel, Tereza de Benguela, Zé Cláudio e Maria. Os candidatos encontrados (Camilo Torres, Frei Tito, Mário Alves, Lucio Cabañas, Mamá Tingó) eram reenvios de fotos antigas com licença posta por quem subiu o arquivo, sem origem verificável, então ficaram de fora. Vale pedir a familiares, comissões da verdade e arquivos públicos.

## T05 Memorial: mais retratos e "De onde vem a imagem"

Pedido (novembro de 2026): pôr foto em todas as homenagens possíveis e, ao abrir a homenagem, mostrar de onde veio a imagem, evitando problema jurídico (Lei 9.610/98, direitos autorais; CC art. 20, direito de imagem).

- Ordem de preferência das fontes: Wikimedia Commons (domínio público, CC0, CC BY, CC BY-SA), Agência Brasil (CC BY 3.0 BR), fotos oficiais de governos com licença aberta declarada, Flickr com CC. Foto sem licença aberta não foi baixada.
- Fotos novas (17, de 95 no total): Bartolina Sisa (monumento na Bolívia), Edson Luís (registro estudantil, Arquivo Nacional), Frei Caneca (desenho do séc. XIX, Biblioteca Nacional), Frei Tito (Comissão da Verdade de SP), Galdino (escultura da praça em Brasília, Agência Brasília), irmãs Mirabal (recorte de foto das três, domínio público), Lolita Lebrón (AP, 1954, domínio público nos EUA), Lucio Cabañas (retrato desenhado, CC BY-SA), Mãe Bernadete (Agecom, Governo da Bahia, CC BY 2.0), Ellacuría (monumento em Portugalete, CC0), Eldorado dos Carajás (cruz no local, Agência Brasil), Stuart Angel (domínio público no Brasil, foto anterior a 1983), Sepé Tiaraju (estátua em São Miguel das Missões), Dorothy Stang (mural), Os 43 de Ayotzinapa (carteira-memorial), Chris Hani (monumento em Boksburg), Ken Saro-Wiwa (ônibus-memorial em Londres).
- Quando não existe retrato livre feito em vida, o Memorial usa monumento, escultura ou mural em lugar público. Isso só foi feito em países onde a lei permite fotografar obras permanentes em lugar público (no Brasil, Lei 9.610/98, art. 48). Nenhuma foto mostra a pessoa em situação de violência.
- Campos novos na ficha (opcionais, `lib/content.ts`): `foto_autor`, `foto_licenca` e `foto_licenca_url`. Todas as 95 fotos já têm os três (a licença e a URL vêm do próprio Commons). Ao abrir a homenagem, o bloco "De onde vem a imagem" mostra autor, licença (com link para o texto da licença CC), fonte (link para o arquivo original) e a descrição completa do crédito. Rótulos em `memorial.image` nos seis idiomas.
- Descartadas por risco jurídico: Ezequiel Ramin (estátua na Itália, país sem liberdade de panorama), Santiago Maldonado (cartaz de protesto feito a partir de foto de terceiros), Mário Alves (foto antiga de autor desconhecido com licença posta por quem subiu, ainda em revisão no Commons), Camilo Torres (a foto de família tem licença sem origem verificável; o busto achado é de outro Camilo Torres, o prócer do séc. XIX).
- Seguem com a vela (15): Ângelo Kretã, Camilo Torres, Chicão Xukuru, Expedito Ribeiro de Souza, Ezequiel Ramin, Padre Josimo, Mamá Tingó, Manoel Congo, Marçal de Souza, Mário Alves, Moa do Katendê, Paulo Paulino Guajajara, Santiago Maldonado, Tereza de Benguela, Zé Cláudio e Maria. Para eles não achamos imagem com licença aberta e origem clara (Tereza de Benguela e Manoel Congo: só ilustrações de exposições ou capas sem licença para a obra; Mamá Tingó e Moa: só fotos de estação ou de cortejo, sem a pessoa). Vale pedir a familiares, à CPT, ao Cimi, às comissões da verdade e à Agência Brasil.

## B38 Materiais para imprimir

`components/governanca/KitDeDivulgacao.tsx`: a letra de cartaz do site (`--font-cartaz`, condensada e pesada) em todos os títulos; moldura construtivista própria (cunha vermelha e preta no canto e barra de listras na base, vetor, baixa tinta só em preto) nas peças inteiras, e sem moldura nas folhas de recortar; faixa de raios vermelhos no alto da página. Cores só vermelho, preto e creme; nada dos adinkras do Instagram e nenhuma obra copiada. Duas peças novas (kit de 19 para 21, sem lacuna na grade de 3 colunas): "Leia. Copie. Passe adiante." (cartaz A3 da biblioteca livre) e "Uma hora por semana é nossa" (quadro da semana A4 para escrever à mão). O Guia de fontes não foi tocado.
