// Banco de dados expandido: Complete a Música, Stop Express, Trivia Mata-Mata e Leitura Labial

// Complete a Música
window.MUSICAS_DATA = [
  {
    intro: "Evidências (Chitãozinho e Xororó): E nessa loucura de dizer que não te quero...",
    answer: "Vou negando as aparências",
    accepted: ["vou negando as aparencias", "disfarcando as evidencias"]
  },
  {
    intro: "Anna Júlia (Los Hermanos): Quem te vê passar assim por mim...",
    answer: "Não sabe o que é sofrer",
    accepted: ["nao sabe o que e sofrer", "nao sabe o que e"]
  },
  {
    intro: "Pais e Filhos (Legião Urbana): É preciso amar as pessoas como se...",
    answer: "Não houvesse amanhã",
    accepted: ["nao houvesse amanha", "como se nao houvesse amanha"]
  },
  {
    intro: "O Sol (Vitor Kley): Ô Sol vê se não esquece e me...",
    answer: "Ilumina",
    accepted: ["ilumina", "me ilumina"]
  },
  {
    intro: "Garota de Ipanema: Olha que coisa mais linda, mais cheia...",
    answer: "De graça",
    accepted: ["de graca", "mais cheia de graca"]
  },
  {
    intro: "Metamorfose Ambulante (Raul Seixas): Eu prefiro ser essa metamorfose...",
    answer: "Ambulante",
    accepted: ["ambulante"]
  },
  {
    intro: "Ai Se Eu Te Pego (Michel Teló): Nossa, nossa, assim você me...",
    answer: "Mata",
    accepted: ["mata"]
  },
  {
    intro: "Malandragem (Cássia Eller): Quem sabe eu ainda sou uma...",
    answer: "Garotinha",
    accepted: ["garotinha"]
  },
  {
    intro: "Trem-Bala (Ana Vilela): Não é sobre ter todas as pessoas do mundo...",
    answer: "Pra si",
    accepted: ["pra si", "para si"]
  },
  {
    intro: "Pelados em Santos (Mamonas Assassinas): Mina, seus cabelo é daora, seu corpão...",
    answer: "Violão",
    accepted: ["violao"]
  },
  {
    intro: "Tempo Perdido (Legião Urbana): Todos os dias quando acordo, não tenho mais o tempo que...",
    answer: "Passou",
    accepted: ["passou"]
  },
  {
    intro: "Não Quero Dinheiro (Tim Maia): Vou pedir pro céu, você aqui comigo, eu só quero...",
    answer: "Amar você",
    accepted: ["amar voce", "amar", "amar vc"]
  },
  {
    intro: "Exagerado (Cazuza): Amor da minha vida, daqui até a...",
    answer: "Eternidade",
    accepted: ["eternidade"]
  },
  {
    intro: "Como Nossos Pais (Elis Regina): Viver é melhor que...",
    answer: "Sonhar",
    accepted: ["sonhar"]
  },
  {
    intro: "Céu Azul (Charlie Brown Jr): Tão natural quanto a...",
    answer: "Luz do dia",
    accepted: ["luz do dia"]
  },
  {
    intro: "Pro Dia Nascer Feliz (Barão Vermelho): Todo dia a insônia me convence que...",
    answer: "O sou eu",
    accepted: ["o sou eu", "sou eu", "valeu"]
  },
  {
    intro: "Festa no Apê (Latino): Hoje é festa lá no meu apê, pode aparecer, vai rolar...",
    answer: "Bunda-lê-lê",
    accepted: ["bunda le le", "bundalele", "bundalêlê"]
  },
  {
    intro: "Show das Poderosas (Anitta): Prepara que agora é a hora do show das...",
    answer: "Poderosas",
    accepted: ["poderosas"]
  },
  {
    intro: "Sorte Grande (Ivete Sangalo): A minha sorte grande foi você...",
    answer: "Cair do céu",
    accepted: ["cair do ceu", "cair"]
  },
  {
    intro: "Hear Me Now (Alok): If you hear me now, please don't let me...",
    answer: "Down",
    accepted: ["down", "let me down"]
  },
  {
    intro: "Fogo e Paixão (Wando): Você é luz, é raio, estrela e...",
    answer: "Luar",
    accepted: ["luar"]
  },
  {
    intro: "Robocop Gay (Mamonas Assassinas): Um tanto quanto másculo, com...",
    answer: "Manto de veludo",
    accepted: ["manto de veludo", "veludo"]
  },
  {
    intro: "Esperando na Janela (Gilberto Gil): Por isso eu vou na casa dela, ai-ai, falar do meu...",
    answer: "Amor pra ela",
    accepted: ["amor pra ela", "amor", "amor para ela"]
  },
  {
    intro: "Mulher de Fases (Raimundos): Que mulher ruim, jogou minhas coisas...",
    answer: "Fora",
    accepted: ["fora", "tudo fora"]
  },
  {
    intro: "Só Hoje (Jota Quest): Hoje eu preciso te abraçar, sentir teu cheiro de...",
    answer: "Roupa limpa",
    accepted: ["roupa limpa"]
  }
];

// Stop Express (Categorias e letras rápidas)
window.STOP_EXPRESS_DATA = {
  letters: ["A", "B", "C", "D", "E", "F", "G", "L", "M", "P", "R", "S", "T", "V"],
  categoriesPool: [
    ["Nome", "Animal", "Fruta"],
    ["País/Cidade", "Cor", "Objeto"],
    ["Comida", "Profissão", "Marca"],
    ["Super-Herói", "Filme/Série", "Parte do Corpo"],
    ["Carro/Veículo", "Instrumento Musical", "Animal"],
    ["Bebida", "Doce/Sobremesa", "Adjetivo/Defeito"],
    ["Celebridade/Famoso", "Time de Futebol", "Desenho/Animação"],
    ["Objeto de Praia", "Comida de Festa", "Animal que Voa"],
    ["Eletrodoméstico", "Acessório/Roupa", "Esporte"],
    ["Jogo de Videogame", "Inseto/Bicho", "Sabor de Pizza"],
    ["Fruta Tropical", "Meio de Transporte", "Marca de Roupa/Tênis"],
    ["Coisa da Cozinha", "Coisa que Derrete", "Vilão de Cinema"],
    ["Profissão Noturna", "Cidade Turística", "Tempero de Comida"],
    ["Nome Feminino", "Nome Masculino", "Animal Selvagem"]
  ]
};

// Trivia Mata-Mata (Perguntas com 4 opções)
window.TRIVIA_MATA_MATA_DATA = [
  { q: "Qual país venceu a Copa do Mundo de futebol de 2022?", opts: ["França", "Argentina", "Brasil", "Alemanha"], correct: 1 },
  { q: "Quantos ossos tem o corpo humano adulto em média?", opts: ["206", "198", "215", "300"], correct: 0 },
  { q: "Qual é o elemento químico mais abundante no universo?", opts: ["Oxigênio", "Hélio", "Hidrogênio", "Carbono"], correct: 2 },
  { q: "Em que ano o homem pisou na Lua pela primeira vez?", opts: ["1965", "1969", "1972", "1980"], correct: 1 },
  { q: "Qual é o oceano mais profundo do planeta Terra?", opts: ["Atlântico", "Índico", "Pacífico", "Ártico"], correct: 2 },
  { q: "Qual animal é o maior mamífero do mundo?", opts: ["Elefante Africano", "Baleia Azul", "Tubarão Branco", "Girafa"], correct: 1 },
  { q: "Quem escreveu a peça teatral 'Romeu e Julieta'?", opts: ["William Shakespeare", "Machado de Assis", "Charles Dickens", "Oscar Wilde"], correct: 0 },
  { q: "Qual é a capital da Austrália?", opts: ["Sydney", "Melbourne", "Camberra", "Brisbane"], correct: 2 },
  { q: "Quantos segundos há em exatamente 2 horas?", opts: ["3.600", "7.200", "12.000", "1.200"], correct: 1 },
  { q: "Qual planeta é conhecido popularmente como o 'Planeta Vermelho'?", opts: ["Vênus", "Marte", "Júpiter", "Mercúrio"], correct: 1 },
  { q: "Qual é a moeda oficial do Japão?", opts: ["Yuan", "Won", "Iene", "Dólar"], correct: 2 },
  { q: "Em qual continente fica o deserto do Saara?", opts: ["Ásia", "África", "América", "Oceania"], correct: 1 },
  { q: "Qual é a montanha mais alta do mundo?", opts: ["K2", "Monte Everest", "Aconcágua", "Monte Fuji"], correct: 1 },
  { q: "Quantos corações tem um polvo?", opts: ["1", "2", "3", "4"], correct: 2 },
  { q: "Qual pintor cortou a própria orelha após uma discussão?", opts: ["Pablo Picasso", "Vincent van Gogh", "Salvador Dalí", "Claude Monet"], correct: 1 },
  { q: "Quantos graus tem a soma dos ângulos internos de um triângulo?", opts: ["90°", "180°", "270°", "360°"], correct: 1 },
  { q: "Qual é o menor país do mundo em extensão territorial?", opts: ["Mônaco", "Vaticano", "Nauru", "San Marino"], correct: 1 },
  { q: "Quem é considerado o pai da teoria da evolução das espécies?", opts: ["Isaac Newton", "Albert Einstein", "Charles Darwin", "Gregor Mendel"], correct: 2 },
  { q: "Qual é a velocidade aproximada do som no ar ao nível do mar?", opts: ["343 m/s", "1.000 m/s", "300.000 km/s", "100 m/s"], correct: 0 },
  { q: "Qual país tem o formato de uma bota no mapa?", opts: ["Espanha", "Itália", "Grécia", "Portugal"], correct: 1 },
  { q: "Quantos jogadores formam um time de basquete em quadra?", opts: ["4", "5", "6", "7"], correct: 1 },
  { q: "Qual animal é conhecido por dormir em pé?", opts: ["Cavalo", "Leão", "Cachorro", "Urso"], correct: 0 },
  { q: "Qual civilização antiga construiu a cidade de Machu Picchu?", opts: ["Maias", "Astecas", "Incas", "Egípcios"], correct: 2 },
  { q: "Qual é a capital do Canadá?", opts: ["Toronto", "Vancouver", "Montreal", "Ottawa"], correct: 3 },
  { q: "Quantas patas tem uma aranha?", opts: ["6", "8", "10", "12"], correct: 1 },
  { q: "Quem inventou o telefone?", opts: ["Thomas Edison", "Alexander Graham Bell", "Nikola Tesla", "Benjamin Franklin"], correct: 1 },
  { q: "Qual é a camada mais externa da Terra?", opts: ["Núcleo", "Manto", "Crosta", "Litosfera"], correct: 2 },
  { q: "Qual país deu de presente a Estátua da Liberdade para os EUA?", opts: ["França", "Inglaterra", "Espanha", "Alemanha"], correct: 0 },
  { q: "Em que ano começou a Primeira Guerra Mundial?", opts: ["1912", "1914", "1918", "1939"], correct: 1 },
  { q: "Qual é o maior estado do Brasil em extensão territorial?", opts: ["Mato Grosso", "Pará", "Amazonas", "Minas Gerais"], correct: 2 }
];

// Desafio da Leitura Labial
window.LEITURA_LABIAL_DATA = [
  { phrase: "Pindamonhangaba", accepted: ["pindamonhangaba"] },
  { phrase: "Batata frita crocante", accepted: ["batata frita crocante", "batata frita"] },
  { phrase: "Supercalifragilistico", accepted: ["supercalifragilistico"] },
  { phrase: "O rato roeu a roupa do rei", accepted: ["o rato roeu a roupa do rei", "o rato roeu"] },
  { phrase: "Sorvete de pistache", accepted: ["sorvete de pistache"] },
  { phrase: "Paralelepípedo azul", accepted: ["paralelepipedo azul", "paralelepipedo"] },
  { phrase: "Liquidificador quebrado", accepted: ["liquidificador quebrado", "liquidificador"] },
  { phrase: "Chocolate com pimenta", accepted: ["chocolate com pimenta"] },
  { phrase: "Pikachu dando choque", accepted: ["pikachu dando choque", "pikachu"] },
  { phrase: "Voo de asa delta", accepted: ["voo de asa delta", "asa delta"] },
  { phrase: "Pipoca doce de cinema", accepted: ["pipoca doce de cinema", "pipoca doce", "pipoca"] },
  { phrase: "Eu te amo muito", accepted: ["eu te amo muito", "eu te amo"] },
  { phrase: "Passa a bola logo", accepted: ["passa a bola logo", "passa a bola"] },
  { phrase: "Churrasco no domingo", accepted: ["churrasco no domingo", "churrasco"] },
  { phrase: "Cachorro quente completo", accepted: ["cachorro quente completo", "cachorro quente"] },
  { phrase: "Montanha russa radical", accepted: ["montanha russa radical", "montanha russa"] },
  { phrase: "Bateu na trave e saiu", accepted: ["bateu na trave e saiu", "bateu na trave"] },
  { phrase: "Quero comer brigadeiro", accepted: ["quero comer brigadeiro", "brigadeiro"] },
  { phrase: "Torta na cara", accepted: ["torta na cara"] },
  { phrase: "Fim de semana chegou", accepted: ["fim de semana chegou", "fim de semana"] },
  { phrase: "Olha a chuva passando", accepted: ["olha a chuva passando", "olha a chuva"] },
  { phrase: "Dormir até meio-dia", accepted: ["dormir ate meio dia", "dormir"] },
  { phrase: "Café com pão de queijo", accepted: ["cafe com pao de queijo", "pao de queijo"] },
  { phrase: "Bateria do celular fraca", accepted: ["bateria do celular fraca", "bateria fraca"] },
  { phrase: "Tira o olho do meu lanche", accepted: ["tira o olho do meu lanche", "tira o olho"] }
];
