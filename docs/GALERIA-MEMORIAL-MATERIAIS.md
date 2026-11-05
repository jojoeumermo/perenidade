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

## B38 Materiais para imprimir

`components/governanca/KitDeDivulgacao.tsx`: a letra de cartaz do site (`--font-cartaz`, condensada e pesada) em todos os títulos; moldura construtivista própria (cunha vermelha e preta no canto e barra de listras na base, vetor, baixa tinta só em preto) nas peças inteiras, e sem moldura nas folhas de recortar; faixa de raios vermelhos no alto da página. Cores só vermelho, preto e creme; nada dos adinkras do Instagram e nenhuma obra copiada. Duas peças novas (kit de 19 para 21, sem lacuna na grade de 3 colunas): "Leia. Copie. Passe adiante." (cartaz A3 da biblioteca livre) e "Uma hora por semana é nossa" (quadro da semana A4 para escrever à mão). O Guia de fontes não foi tocado.
