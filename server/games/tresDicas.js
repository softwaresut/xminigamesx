const tresDicasData = require('../data/tresDicasData');

function normalize(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

class TresDicasGame {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.id = 'tres-dicas';
    this.name = 'Jogo das 3 Dicas';
    this.totalRounds = room.settings.rounds || 5;
    this.currentRound = 0;
    this.usedItems = new Set();
    this.currentItem = null;
    this.currentClueIndex = 0; // 0, 1, 2
    this.clueTimer = null;
    this.clueTimeLeft = 8;
    this.roundWinner = null;
    this.phase = 'IDLE'; // 'GUESSING' | 'REVEAL' | 'FINISHED'
    this.cooldowns = new Map(); // socketId -> timestamp
  }

  start() {
    this.currentRound = 0;
    this.usedItems.clear();
    this.room.resetScores();
    this.nextRound();
  }

  nextRound() {
    this.currentRound += 1;
    this.currentClueIndex = 0;
    this.roundWinner = null;
    this.phase = 'GUESSING';
    this.cooldowns.clear();

    const available = tresDicasData.filter(item => !this.usedItems.has(item.answer));
    if (available.length === 0) {
      this.usedItems.clear();
    }
    const pool = available.length > 0 ? available : tresDicasData;
    const randomIndex = Math.floor(Math.random() * pool.length);
    this.currentItem = pool[randomIndex];
    this.usedItems.add(this.currentItem.answer);

    this.startClue(0);
  }

  startClue(index) {
    this.currentClueIndex = index;
    this.clueTimeLeft = 9;

    const pointsAvailable = index === 0 ? 15 : index === 1 ? 10 : 5;

    this.io.to(this.room.code).emit('tres_dicas_clue', {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      clueIndex: index, // 0, 1, 2
      clues: this.currentItem.clues.slice(0, index + 1),
      pointsAvailable,
      clueTimeLeft: this.clueTimeLeft,
      scores: this.room.getScores()
    });

    if (this.clueTimer) clearInterval(this.clueTimer);
    this.clueTimer = setInterval(() => {
      this.clueTimeLeft -= 1;
      this.io.to(this.room.code).emit('game_timer_tick', { timeLeft: this.clueTimeLeft });

      if (this.clueTimeLeft <= 0) {
        clearInterval(this.clueTimer);
        this.clueTimer = null;
        if (this.currentClueIndex < 2) {
          // Reveal next clue
          this.startClue(this.currentClueIndex + 1);
        } else {
          // No one guessed in 3 clues
          this.finishRound(null);
        }
      }
    }, 1000);
  }

  submitGuess(socketId, guess) {
    if (this.phase !== 'GUESSING' || !this.currentItem) return;

    const now = Date.now();
    const lastGuess = this.cooldowns.get(socketId) || 0;
    if (now - lastGuess < 1200) {
      return { success: false, message: 'Aguarde 1 segundo antes do próximo palpite' };
    }
    this.cooldowns.set(socketId, now);

    const normGuess = normalize(guess);
    const validNorms = [this.currentItem.answer, ...(this.currentItem.synonyms || [])].map(normalize);

    const player = this.room.getPlayer(socketId);
    if (!player) return;

    if (validNorms.includes(normGuess)) {
      // Correct!
      const points = this.currentClueIndex === 0 ? 15 : this.currentClueIndex === 1 ? 10 : 5;
      this.room.addScore(socketId, points);
      this.finishRound({ player, points, guess });
      return { success: true, correct: true };
    } else {
      // Wrong guess: broadcast incorrect guess activity to room
      this.io.to(this.room.code).emit('tres_dicas_wrong_guess', {
        player: { id: player.id, nickname: player.nickname, avatar: player.avatar },
        guess
      });
      return { success: true, correct: false };
    }
  }

  finishRound(winnerData) {
    if (this.phase !== 'GUESSING') return;
    this.phase = 'REVEAL';

    if (this.clueTimer) {
      clearInterval(this.clueTimer);
      this.clueTimer = null;
    }

    this.io.to(this.room.code).emit('tres_dicas_round_result', {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      winner: winnerData, // null or { player, points, guess }
      answer: this.currentItem.answer,
      allClues: this.currentItem.clues,
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
    if (this.clueTimer) {
      clearInterval(this.clueTimer);
      this.clueTimer = null;
    }
  }
}

module.exports = TresDicasGame;
