// Banco de dados: Complete a Música, Stop Express, Trivia Mata-Mata e Leitura Labial

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
  }
];

// Stop Express (Categorias e letras rápidas)
window.STOP_EXPRESS_DATA = {
  letters: ["A", "B", "C", "D", "E", "F", "G", "L", "M", "P", "R", "S", "T", "V"],
  categoriesPool: [
    ["Nome", "Animal", "Fruta"],
    ["País/Cidade", "Cor", "Objeto"],
    ["Comida", "Profissão", "Marca"],
    ["Super-Herói/Vilão", "Filme/Série", "Parte do Corpo"],
    ["Carro/Veículo", "Instrumento", "Animal"]
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
  { q: "Em qual continente fica o deserto do Saara?", opts: ["Ásia", "África", "América", "Oceania"], correct: 1 }
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
  { phrase: "Voo de asa delta", accepted: ["voo de asa delta", "asa delta"] }
];
