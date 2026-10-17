const questionsPool = require('../data/naoRespondaQuestions');

function normalize(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

class NaoRespondaGame {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.id = 'nao-responda';
    this.name = 'Não Responda a Mesma Resposta que Eu';
    this.totalRounds = room.settings.rounds || 5;
    this.timerDuration = room.settings.timerSeconds || 20;
    this.currentRound = 0;
    this.usedQuestions = new Set();
    this.currentQuestion = '';
    this.answers = {}; // socketId -> rawAnswer
    this.timer = null;
    this.timeLeft = 0;
    this.phase = 'IDLE'; // 'ANSWERING' | 'REVEAL' | 'FINISHED'
  }

  start() {
    this.currentRound = 0;
    this.usedQuestions.clear();
    // Reset round scores, keep overall room scores or reset room scores
    this.room.resetScores();
    this.nextRound();
  }

  nextRound() {
    this.currentRound += 1;
    this.answers = {};
    this.phase = 'ANSWERING';

    // Pick question
    const available = questionsPool.filter(q => !this.usedQuestions.has(q));
    if (available.length === 0) {
      this.usedQuestions.clear();
    }
    const pool = available.length > 0 ? available : questionsPool;
    const randomIndex = Math.floor(Math.random() * pool.length);
    this.currentQuestion = pool[randomIndex];
    this.usedQuestions.add(this.currentQuestion);

    this.timeLeft = this.timerDuration;

    this.io.to(this.room.code).emit('game_round_start', {
      gameId: this.id,
      gameName: this.name,
      round: this.currentRound,
      totalRounds: this.totalRounds,
      question: this.currentQuestion,
      timerDuration: this.timerDuration,
      scores: this.room.getScores()
    });

    // Start timer interval
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      this.io.to(this.room.code).emit('game_timer_tick', { timeLeft: this.timeLeft });

      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.timer = null;
        this.finishRound();
      }
    }, 1000);
  }

  submitAnswer(socketId, answer) {
    if (this.phase !== 'ANSWERING') return;
    
    // Store answer (trimmed)
    this.answers[socketId] = (answer || '').trim();

    // Broadcast update of how many players have answered
    const activePlayers = this.room.getActivePlayers();
    const answeredCount = Object.keys(this.answers).length;

    this.io.to(this.room.code).emit('game_answered_update', {
      answeredCount,
      totalPlayers: activePlayers.length
    });

    // If all active players answered, finish immediately!
    if (answeredCount >= activePlayers.length && activePlayers.length > 0) {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      setTimeout(() => this.finishRound(), 800);
    }
  }

  finishRound() {
    if (this.phase !== 'ANSWERING') return;
    this.phase = 'REVEAL';

    const activePlayers = this.room.getActivePlayers();

    // Group answers by normalized representation
    const normMap = new Map(); // normalized -> [ { socketId, rawAnswer, player } ]
    const noAnswers = [];

    activePlayers.forEach(p => {
      const raw = this.answers[p.id];
      const norm = normalize(raw);
      if (!raw || norm.length === 0) {
        noAnswers.push({
          player: { id: p.id, nickname: p.nickname, avatar: p.avatar },
          rawAnswer: raw || '(Não respondeu a tempo)',
          points: 0,
          reason: 'Sem resposta'
        });
      } else {
        if (!normMap.has(norm)) {
          normMap.set(norm, []);
        }
        normMap.get(norm).push({
          player: { id: p.id, nickname: p.nickname, avatar: p.avatar },
          rawAnswer: raw
        });
      }
    });

    const uniqueAnswers = [];
    const duplicateGroups = [];

    for (const [norm, group] of normMap.entries()) {
      if (group.length === 1) {
        // Unique answer -> 10 points
        const item = group[0];
        const points = 10;
        this.room.addScore(item.player.id, points);
        uniqueAnswers.push({
          player: item.player,
          rawAnswer: item.rawAnswer,
          points,
          reason: 'Resposta Única! (+10 pts)'
        });
      } else {
        // Duplicate answers -> 5 points each
        const points = 5;
        group.forEach(item => {
          this.room.addScore(item.player.id, points);
        });
        duplicateGroups.push({
          normalized: norm,
          sampleAnswer: group[0].rawAnswer,
          players: group.map(g => g.player),
          points,
          reason: `Repetida por ${group.length} jogadores (+5 pts)`
        });
      }
    }

    // Broadcast results of the round
    this.io.to(this.room.code).emit('game_round_result', {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      question: this.currentQuestion,
      results: {
        uniques: uniqueAnswers,
        duplicates: duplicateGroups,
        noAnswers: noAnswers
      },
      scores: this.room.getScores(),
      isGameOver: this.currentRound >= this.totalRounds
    });

    // Countdown to next round or podium
    setTimeout(() => {
      if (this.currentRound >= this.totalRounds) {
        this.endGame();
      } else {
        this.nextRound();
      }
    }, 7000); // 7 seconds to read all answers and laugh with friends
  }

  endGame() {
    this.phase = 'FINISHED';
    const podium = this.room.getPodium();
    this.io.to(this.room.code).emit('game_podium', {
      podium,
      scores: this.room.getScores()
    });
  }

  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = NaoRespondaGame;
