// Jogo da Senha (Mastermind / Quebrador de Código)
// Modos: Fácil (cores por posição) e Difícil (apenas quantidade de dígitos existentes)

function generateSecretCode() {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  // Shuffle and pick 4 unique digits
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits.slice(0, 4).join('');
}

class JogoSenhaGame {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.id = 'jogo-senha';
    this.name = 'Jogo da Senha (Código Secreto)';
    this.mode = room.settings.difficulty || 'facil'; // 'facil' | 'dificil'
    this.totalRounds = room.settings.rounds || 3;
    this.maxAttempts = 8;
    this.currentRound = 0;
    this.secretCode = '';
    this.roundWinner = null;
    this.playerAttempts = {}; // socketId -> Array of attempts: [ { guess, result } ]
    this.phase = 'IDLE'; // 'GUESSING' | 'REVEAL' | 'FINISHED'
    this.roundTimer = null;
    this.roundTimeLeft = 60;
  }

  start() {
    this.currentRound = 0;
    this.room.resetScores();
    this.nextRound();
  }

  nextRound() {
    this.currentRound += 1;
    this.secretCode = generateSecretCode();
    this.roundWinner = null;
    this.playerAttempts = {};
    this.phase = 'GUESSING';
    this.roundTimeLeft = 60;

    const activePlayers = this.room.getActivePlayers();
    activePlayers.forEach(p => {
      this.playerAttempts[p.id] = [];
    });

    this.io.to(this.room.code).emit('senha_round_start', {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      mode: this.mode,
      maxAttempts: this.maxAttempts,
      timeLimit: this.roundTimeLeft,
      scores: this.room.getScores()
    });

    if (this.roundTimer) clearInterval(this.roundTimer);
    this.roundTimer = setInterval(() => {
      this.roundTimeLeft -= 1;
      this.io.to(this.room.code).emit('game_timer_tick', { timeLeft: this.roundTimeLeft });

      if (this.roundTimeLeft <= 0) {
        clearInterval(this.roundTimer);
        this.roundTimer = null;
        this.finishRound(null);
      }
    }, 1000);
  }

  evaluateGuess(guess) {
    const secretArr = this.secretCode.split('');
    const guessArr = guess.split('');

    if (this.mode === 'facil') {
      // Return feedback for each digit: 'green', 'yellow', 'red'
      const feedback = [];
      for (let i = 0; i < 4; i++) {
        const d = guessArr[i];
        if (d === secretArr[i]) {
          feedback.push({ digit: d, status: 'green' }); // Posição exata
        } else if (secretArr.includes(d)) {
          feedback.push({ digit: d, status: 'yellow' }); // Existe no código
        } else {
          feedback.push({ digit: d, status: 'red' }); // Não existe
        }
      }
      const isCorrect = guess === this.secretCode;
      return { isCorrect, feedback };
    } else {
      // Modo difícil: sem posições exatas
      let exactMatches = 0;
      let existingMatches = 0;

      for (let i = 0; i < 4; i++) {
        if (guessArr[i] === secretArr[i]) {
          exactMatches += 1;
        } else if (secretArr.includes(guessArr[i])) {
          existingMatches += 1;
        }
      }

      const isCorrect = guess === this.secretCode;
      return {
        isCorrect,
        hardFeedback: {
          exactMatches, // quantos no lugar certo (sem dizer quais)
          existingMatches // quantos existem no código mas fora de posição
        }
      };
    }
  }

  submitGuess(socketId, guess) {
    if (this.phase !== 'GUESSING') return;
    if (!/^\d{4}$/.test(guess)) return { success: false, message: 'Digite exatamente 4 dígitos' };

    const player = this.room.getPlayer(socketId);
    if (!player) return;

    if (!this.playerAttempts[socketId]) {
      this.playerAttempts[socketId] = [];
    }

    if (this.playerAttempts[socketId].length >= this.maxAttempts) {
      return { success: false, message: 'Você atingiu o limite de tentativas nesta rodada' };
    }

    const evaluation = this.evaluateGuess(guess);
    const attemptRecord = {
      guess,
      ...evaluation,
      timestamp: Date.now()
    };
    this.playerAttempts[socketId].push(attemptRecord);

    // Send private feedback to this player
    this.io.to(socketId).emit('senha_guess_feedback', {
      attempt: attemptRecord,
      attemptsCount: this.playerAttempts[socketId].length,
      maxAttempts: this.maxAttempts
    });

    // Notify room of attempt activity
    this.io.to(this.room.code).emit('senha_activity', {
      player: { id: player.id, nickname: player.nickname, avatar: player.avatar },
      attemptsCount: this.playerAttempts[socketId].length
    });

    if (evaluation.isCorrect) {
      // First player to discover the code wins!
      const points = 20 - (this.playerAttempts[socketId].length - 1) * 2; // e.g. 20, 18, 16...
      this.room.addScore(socketId, Math.max(points, 6));
      this.finishRound({ player, points, attempts: this.playerAttempts[socketId].length });
    } else {
      // Check if all players exhausted their attempts
      const activePlayers = this.room.getActivePlayers();
      const allExhausted = activePlayers.every(p => {
        const atts = this.playerAttempts[p.id] || [];
        return atts.length >= this.maxAttempts;
      });
      if (allExhausted) {
        this.finishRound(null);
      }
    }

    return { success: true };
  }

  finishRound(winnerData) {
    if (this.phase !== 'GUESSING') return;
    this.phase = 'REVEAL';

    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }

    this.io.to(this.room.code).emit('senha_round_result', {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      secretCode: this.secretCode,
      winner: winnerData,
      scores: this.room.getScores(),
      isGameOver: this.currentRound >= this.totalRounds
    });

    setTimeout(() => {
      if (this.currentRound >= this.totalRounds) {
        this.endGame();
      } else {
        this.nextRound();
      }
    }, 6500);
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
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
  }
}

module.exports = JogoSenhaGame;
