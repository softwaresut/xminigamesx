const questionsPool = require('../data/botaoRapidoQuestions');

class BotaoRapidoGame {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.id = 'botao-rapido';
    this.name = 'Botão Rápido (Torta na Cara)';
    this.totalRounds = room.settings.rounds || 5;
    this.currentRound = 0;
    this.usedQuestions = new Set();
    this.currentQuestion = null;
    this.buzzerLockedBy = null; // socketId
    this.buzzerTimer = null;
    this.buzzerTimeLeft = 8;
    this.questionTimer = null;
    this.questionTimeLeft = 15;
    this.lockedOutPlayers = new Set(); // players who buzzed wrong in this round
    this.phase = 'IDLE'; // 'BUZZING' | 'ANSWERING' | 'REVEAL' | 'FINISHED'
  }

  start() {
    this.currentRound = 0;
    this.usedQuestions.clear();
    this.room.resetScores();
    this.nextRound();
  }

  nextRound() {
    this.currentRound += 1;
    this.buzzerLockedBy = null;
    this.lockedOutPlayers.clear();
    this.phase = 'BUZZING';
    this.questionTimeLeft = 15;

    const available = questionsPool.filter(q => !this.usedQuestions.has(q.question));
    if (available.length === 0) {
      this.usedQuestions.clear();
    }
    const pool = available.length > 0 ? available : questionsPool;
    const randomIndex = Math.floor(Math.random() * pool.length);
    this.currentQuestion = pool[randomIndex];
    this.usedQuestions.add(this.currentQuestion.question);

    this.io.to(this.room.code).emit('botao_round_start', {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      question: this.currentQuestion.question,
      options: this.currentQuestion.options,
      scores: this.room.getScores()
    });

    if (this.questionTimer) clearInterval(this.questionTimer);
    this.questionTimer = setInterval(() => {
      this.questionTimeLeft -= 1;
      this.io.to(this.room.code).emit('game_timer_tick', { timeLeft: this.questionTimeLeft });

      if (this.questionTimeLeft <= 0) {
        clearInterval(this.questionTimer);
        this.questionTimer = null;
        this.finishRound(null, 'Tempo esgotado para bater no botão!');
      }
    }, 1000);
  }

  pressBuzzer(socketId) {
    if (this.phase !== 'BUZZING') return;
    if (this.lockedOutPlayers.has(socketId)) return;

    const player = this.room.getPlayer(socketId);
    if (!player) return;

    // First player captures the buzzer!
    this.phase = 'ANSWERING';
    this.buzzerLockedBy = socketId;

    if (this.questionTimer) {
      clearInterval(this.questionTimer);
      this.questionTimer = null;
    }

    this.buzzerTimeLeft = 8;
    this.io.to(this.room.code).emit('botao_buzzed', {
      player: { id: player.id, nickname: player.nickname, avatar: player.avatar },
      buzzerTimeLeft: this.buzzerTimeLeft
    });

    if (this.buzzerTimer) clearInterval(this.buzzerTimer);
    this.buzzerTimer = setInterval(() => {
      this.buzzerTimeLeft -= 1;
      this.io.to(this.room.code).emit('game_timer_tick', { timeLeft: this.buzzerTimeLeft });

      if (this.buzzerTimeLeft <= 0) {
        clearInterval(this.buzzerTimer);
        this.buzzerTimer = null;
        this.handleWrongAnswer(socketId, 'Não respondeu a tempo após bater no botão');
      }
    }, 1000);
  }

  submitAnswer(socketId, optionIndex) {
    if (this.phase !== 'ANSWERING' || this.buzzerLockedBy !== socketId) return;

    if (this.buzzerTimer) {
      clearInterval(this.buzzerTimer);
      this.buzzerTimer = null;
    }

    const player = this.room.getPlayer(socketId);
    if (!player) return;

    if (optionIndex === this.currentQuestion.correctIndex) {
      // Correct!
      const points = 10;
      this.room.addScore(socketId, points);
      this.finishRound({ player, points, correctOption: this.currentQuestion.options[optionIndex] }, 'Resposta correta!');
    } else {
      // Wrong!
      this.handleWrongAnswer(socketId, 'Resposta incorreta');
    }
  }

  handleWrongAnswer(socketId, reason) {
    this.lockedOutPlayers.add(socketId);
    const player = this.room.getPlayer(socketId);

    // Broadcast lockout for this player
    this.io.to(this.room.code).emit('botao_player_failed', {
      player: player ? { id: player.id, nickname: player.nickname, avatar: player.avatar } : null,
      reason
    });

    const activePlayers = this.room.getActivePlayers();
    if (this.lockedOutPlayers.size >= activePlayers.length) {
      // Everyone failed or locked out
      this.finishRound(null, 'Nenhum jogador acertou!');
    } else {
      // Re-open buzzer for remaining players
      this.phase = 'BUZZING';
      this.buzzerLockedBy = null;
      this.questionTimeLeft = 10;

      this.io.to(this.room.code).emit('botao_reopened', {
        questionTimeLeft: this.questionTimeLeft,
        lockedOutIds: Array.from(this.lockedOutPlayers)
      });

      if (this.questionTimer) clearInterval(this.questionTimer);
      this.questionTimer = setInterval(() => {
        this.questionTimeLeft -= 1;
        this.io.to(this.room.code).emit('game_timer_tick', { timeLeft: this.questionTimeLeft });

        if (this.questionTimeLeft <= 0) {
          clearInterval(this.questionTimer);
          this.questionTimer = null;
          this.finishRound(null, 'Tempo esgotado');
        }
      }, 1000);
    }
  }

  finishRound(winnerData, reason) {
    this.phase = 'REVEAL';

    if (this.questionTimer) clearInterval(this.questionTimer);
    if (this.buzzerTimer) clearInterval(this.buzzerTimer);

    this.io.to(this.room.code).emit('botao_round_result', {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      winner: winnerData,
      correctIndex: this.currentQuestion.correctIndex,
      correctOption: this.currentQuestion.options[this.currentQuestion.correctIndex],
      reason,
      scores: this.room.getScores(),
      isGameOver: this.currentRound >= this.totalRounds
    });

    setTimeout(() => {
      if (this.currentRound >= this.totalRounds) {
        this.endGame();
      } else {
        this.nextRound();
      }
    }, 6000);
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
    if (this.questionTimer) clearInterval(this.questionTimer);
    if (this.buzzerTimer) clearInterval(this.buzzerTimer);
  }
}

module.exports = BotaoRapidoGame;
