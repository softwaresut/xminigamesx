// xMiniGamesx - P2P WebRTC Game Engine (100% Serverless para Vercel)
// Permite que salas e jogos funcionem de navegador para navegador sem servidor Node.js!

function normalizeText(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

class P2PNetworkAdapter {
  constructor() {
    this.isP2P = true;
    this.peer = null;
    this.id = 'p2p-' + Math.random().toString(36).substring(2, 9);
    this.connected = false;
    this.isHost = false;
    this.hostConnection = null; // for guest: connection to host
    this.connections = new Map(); // for host: peerId -> DataConnection
    this.listeners = new Map(); // event -> array of callbacks

    // Host room state
    this.room = null;
    this.gameTimer = null;
    this.gameInstance = null;
  }

  init(onReady) {
    if (typeof Peer === 'undefined') {
      console.error('[P2P] PeerJS library not loaded!');
      return;
    }

    this.peer = new Peer(this.id, {
      debug: 1
    });

    this.peer.on('open', (id) => {
      this.id = id;
      this.connected = true;
      console.log('[P2P] Peer ready! ID:', id);
      if (typeof onReady === 'function') onReady();
      this.trigger('connect');
    });

    this.peer.on('error', (err) => {
      console.warn('[P2P] Peer error:', err.type, err);
      if (err.type === 'unavailable-id') {
        // Room code already taken, retry
        this.trigger('error_message', 'Código de sala já em uso. Tente novamente!');
      } else {
        this.trigger('error_message', 'Erro de conexão P2P: ' + err.message);
      }
    });
  }

  // Event dispatching
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      const list = this.listeners.get(event) || [];
      const idx = list.indexOf(wrapper);
      if (idx !== -1) list.splice(idx, 1);
    };
    this.on(event, wrapper);
  }

  trigger(event, data) {
    const list = this.listeners.get(event) || [];
    list.forEach(cb => {
      try { cb(data); } catch (e) { console.error('[P2P Error in listener]', event, e); }
    });
  }

  // Broadcast from Host to all connected clients and self
  broadcast(event, data) {
    this.trigger(event, data); // local dispatch
    const payload = JSON.stringify({ event, data });
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(payload);
      }
    });
  }

  // Send to specific player
  sendTo(peerId, event, data) {
    if (peerId === this.id) {
      this.trigger(event, data);
      return;
    }
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send(JSON.stringify({ event, data }));
    }
  }

  // Socket.io compatible emit()
  emit(event, data = {}, callback) {
    if (this.isHost) {
      this.handleHostAction(this.id, event, data, callback);
    } else {
      if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send(JSON.stringify({ event, data, isAction: true }));
        if (typeof callback === 'function') callback({ success: true });
      } else {
        if (event === 'create_room') {
          this.becomeHost(data, callback);
        } else if (event === 'join_room') {
          this.joinHostRoom(data, callback);
        }
      }
    }
  }

  // Become Host & Create Room
  becomeHost({ nickname, avatar }, callback) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

    const hostPeerId = 'xmg-' + code.toLowerCase();

    // Re-create peer with room-based ID
    if (this.peer) this.peer.destroy();

    this.peer = new Peer(hostPeerId, { debug: 1 });

    this.peer.on('open', () => {
      this.id = hostPeerId;
      this.isHost = true;
      this.connected = true;

      this.room = {
        code,
        hostId: this.id,
        players: [{
          id: this.id,
          nickname: nickname || 'Líder',
          avatar: avatar || '🦊',
          score: 0,
          isHost: true,
          connected: true
        }],
        selectedGame: 'nao-responda',
        settings: { rounds: 5, timerSeconds: 20, difficulty: 'facil' },
        state: 'LOBBY'
      };

      // Listen for incoming guest connections
      this.peer.on('connection', (conn) => {
        conn.on('open', () => {
          this.connections.set(conn.peer, conn);
        });

        conn.on('data', (raw) => {
          try {
            const parsed = JSON.parse(raw);
            this.handleHostAction(conn.peer, parsed.event, parsed.data);
          } catch (e) {
            console.error('[P2P] Malformed message', e);
          }
        });

        conn.on('close', () => {
          this.connections.delete(conn.peer);
          if (this.room) {
            this.room.players = this.room.players.filter(p => p.id !== conn.peer);
            this.broadcast('room_player_left', { room: this.room });
          }
        });
      });

      console.log('[P2P] Host Room created:', code);
      if (typeof callback === 'function') callback({ success: true, room: this.room });
      this.trigger('room_created', this.room);
    });

    this.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        this.becomeHost({ nickname, avatar }, callback); // retry with new code
      } else {
        this.trigger('error_message', 'Erro ao criar sala P2P: ' + err.message);
      }
    });
  }

  // Join Room as Guest
  joinHostRoom({ code, nickname, avatar }, callback) {
    const targetPeerId = 'xmg-' + (code || '').toLowerCase().trim();

    const conn = this.peer.connect(targetPeerId, {
      reliable: true
    });

    conn.on('open', () => {
      this.hostConnection = conn;
      this.isHost = false;

      // Register self with host
      conn.send(JSON.stringify({
        event: 'guest_join_request',
        data: { id: this.id, nickname, avatar }
      }));
    });

    conn.on('data', (raw) => {
      try {
        const parsed = JSON.parse(raw);
        this.trigger(parsed.event, parsed.data);
        if (parsed.event === 'room_joined' && typeof callback === 'function') {
          callback({ success: true, room: parsed.data });
        }
      } catch (e) {
        console.error('[P2P] Guest parse error', e);
      }
    });

    conn.on('close', () => {
      this.trigger('disconnect');
    });

    conn.on('error', (err) => {
      this.trigger('error_message', 'Não foi possível conectar à sala: ' + code);
      if (typeof callback === 'function') callback({ success: false, error: 'Sala não encontrada' });
    });
  }

  // Host Central Action Router
  handleHostAction(senderId, event, data, callback) {
    if (!this.isHost || !this.room) return;

    switch (event) {
      case 'guest_join_request': {
        const newPlayer = {
          id: senderId,
          nickname: data.nickname || 'Jogador',
          avatar: data.avatar || '🐼',
          score: 0,
          isHost: false,
          connected: true
        };
        this.room.players.push(newPlayer);
        // Send state back to guest
        this.sendTo(senderId, 'room_joined', this.room);
        // Broadcast to everyone
        this.broadcast('room_player_joined', { player: newPlayer, room: this.room });
        break;
      }

      case 'select_game': {
        this.room.selectedGame = data.gameId;
        this.broadcast('game_selected', { selectedGame: data.gameId, room: this.room });
        break;
      }

      case 'update_settings': {
        if (data.rounds) this.room.settings.rounds = parseInt(data.rounds);
        if (data.timerSeconds) this.room.settings.timerSeconds = parseInt(data.timerSeconds);
        if (data.difficulty) this.room.settings.difficulty = data.difficulty;
        this.broadcast('settings_updated', { settings: this.room.settings });
        break;
      }

      case 'start_game': {
        this.startP2PGame();
        break;
      }

      case 'submit_answer': {
        if (this.gameInstance && typeof this.gameInstance.submitAnswer === 'function') {
          this.gameInstance.submitAnswer(senderId, data.answer);
        }
        break;
      }

      case 'submit_guess': {
        if (this.gameInstance && typeof this.gameInstance.submitGuess === 'function') {
          const res = this.gameInstance.submitGuess(senderId, data.guess);
          if (typeof callback === 'function') callback(res);
        }
        break;
      }

      case 'press_buzzer': {
        if (this.gameInstance && typeof this.gameInstance.pressBuzzer === 'function') {
          this.gameInstance.pressBuzzer(senderId);
        }
        break;
      }

      case 'submit_buzzer_answer': {
        if (this.gameInstance && typeof this.gameInstance.submitAnswer === 'function') {
          this.gameInstance.submitAnswer(senderId, data.optionIndex);
        }
        break;
      }

      case 'send_reaction': {
        const p = this.room.players.find(x => x.id === senderId);
        if (p) {
          this.broadcast('player_reaction', {
            playerId: p.id,
            nickname: p.nickname,
            avatar: p.avatar,
            emoji: data.emoji
          });
        }
        break;
      }

      case 'return_to_lobby': {
        this.room.state = 'LOBBY';
        this.broadcast('room_returned_to_lobby', this.room);
        break;
      }
    }
  }

  // Start selected game in host
  startP2PGame() {
    this.room.players.forEach(p => p.score = 0);
    this.room.state = 'IN_GAME';

    if (this.room.selectedGame === 'nao-responda') {
      this.runNaoRespondaGame();
    } else if (this.room.selectedGame === 'tres-dicas') {
      this.runTresDicasGame();
    } else if (this.room.selectedGame === 'jogo-senha') {
      this.runJogoSenhaGame();
    } else if (this.room.selectedGame === 'botao-rapido') {
      this.runBotaoRapidoGame();
    }
  }

  // Jogo 1: Não Responda
  runNaoRespondaGame() {
    const questions = window.NAO_RESPONDA_QUESTIONS || ["Diga uma fruta", "Um super-herói"];
    const totalRounds = this.room.settings.rounds || 5;
    const timerDuration = this.room.settings.timerSeconds || 20;
    let round = 0;
    let currentQuestion = '';
    let answers = {};
    let timeLeft = timerDuration;
    let timer = null;

    const nextRound = () => {
      round += 1;
      answers = {};
      timeLeft = timerDuration;
      currentQuestion = questions[Math.floor(Math.random() * questions.length)];

      this.broadcast('game_round_start', {
        gameId: 'nao-responda',
        gameName: 'Não Responda a Mesma Resposta que Eu',
        round,
        totalRounds,
        question: currentQuestion,
        timerDuration,
        scores: this.getScores()
      });

      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        timeLeft -= 1;
        this.broadcast('game_timer_tick', { timeLeft });
        if (timeLeft <= 0) {
          clearInterval(timer);
          finishRound();
        }
      }, 1000);
    };

    const finishRound = () => {
      if (timer) clearInterval(timer);

      const normMap = new Map();
      const noAnswers = [];

      this.room.players.forEach(p => {
        const raw = answers[p.id];
        const norm = normalizeText(raw);
        if (!raw || norm.length === 0) {
          noAnswers.push({ player: p, rawAnswer: '(Não respondeu)', points: 0 });
        } else {
          if (!normMap.has(norm)) normMap.set(norm, []);
          normMap.get(norm).push({ player: p, rawAnswer: raw });
        }
      });

      const uniqueAnswers = [];
      const duplicateGroups = [];

      for (const [norm, group] of normMap.entries()) {
        if (group.length === 1) {
          const item = group[0];
          item.player.score += 10;
          uniqueAnswers.push({ player: item.player, rawAnswer: item.rawAnswer, points: 10 });
        } else {
          group.forEach(item => item.player.score += 5);
          duplicateGroups.push({
            sampleAnswer: group[0].rawAnswer,
            players: group.map(g => g.player),
            points: 5
          });
        }
      }

      this.broadcast('game_round_result', {
        round,
        totalRounds,
        question: currentQuestion,
        results: { uniques: uniqueAnswers, duplicates: duplicateGroups, noAnswers },
        scores: this.getScores(),
        isGameOver: round >= totalRounds
      });

      setTimeout(() => {
        if (round >= totalRounds) {
          this.broadcast('game_podium', {
            podium: this.getScores().slice(0, 3),
            scores: this.getScores()
          });
        } else {
          nextRound();
        }
      }, 7000);
    };

    this.gameInstance = {
      submitAnswer: (senderId, ans) => {
        answers[senderId] = (ans || '').trim();
        const answeredCount = Object.keys(answers).length;
        this.broadcast('game_answered_update', {
          answeredCount,
          totalPlayers: this.room.players.length
        });
        if (answeredCount >= this.room.players.length) {
          setTimeout(finishRound, 600);
        }
      }
    };

    nextRound();
  }

  // Jogo 2: 3 Dicas
  runTresDicasGame() {
    const dataList = window.TRES_DICAS_DATA || [];
    const totalRounds = this.room.settings.rounds || 5;
    let round = 0;
    let currentItem = null;
    let clueIndex = 0;
    let clueTimeLeft = 8;
    let timer = null;

    const startClue = (idx) => {
      clueIndex = idx;
      clueTimeLeft = 9;
      const pointsAvailable = idx === 0 ? 15 : idx === 1 ? 10 : 5;

      this.broadcast('tres_dicas_clue', {
        round,
        totalRounds,
        clueIndex: idx,
        clues: currentItem.clues.slice(0, idx + 1),
        pointsAvailable,
        scores: this.getScores()
      });

      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        clueTimeLeft -= 1;
        this.broadcast('game_timer_tick', { timeLeft: clueTimeLeft });
        if (clueTimeLeft <= 0) {
          clearInterval(timer);
          if (clueIndex < 2) startClue(clueIndex + 1);
          else finishRound(null);
        }
      }, 1000);
    };

    const nextRound = () => {
      round += 1;
      currentItem = dataList[Math.floor(Math.random() * dataList.length)];
      startClue(0);
    };

    const finishRound = (winnerData) => {
      if (timer) clearInterval(timer);
      this.broadcast('tres_dicas_round_result', {
        round,
        totalRounds,
        winner: winnerData,
        answer: currentItem.answer,
        scores: this.getScores(),
        isGameOver: round >= totalRounds
      });

      setTimeout(() => {
        if (round >= totalRounds) {
          this.broadcast('game_podium', { podium: this.getScores().slice(0, 3), scores: this.getScores() });
        } else {
          nextRound();
        }
      }, 6000);
    };

    this.gameInstance = {
      submitGuess: (senderId, guess) => {
        const norm = normalizeText(guess);
        const valid = [currentItem.answer, ...(currentItem.synonyms || [])].map(normalizeText);
        const player = this.room.players.find(p => p.id === senderId);
        if (valid.includes(norm)) {
          const pts = clueIndex === 0 ? 15 : clueIndex === 1 ? 10 : 5;
          if (player) player.score += pts;
          finishRound({ player, points: pts, guess });
          return { success: true, correct: true };
        } else {
          this.broadcast('tres_dicas_wrong_guess', { player, guess });
          return { success: true, correct: false };
        }
      }
    };

    nextRound();
  }

  // Jogo 3: Senha
  runJogoSenhaGame() {
    const totalRounds = this.room.settings.rounds || 3;
    const mode = this.room.settings.difficulty || 'facil';
    let round = 0;
    let secretCode = '';
    let playerAttempts = {};
    let timer = null;
    let timeLeft = 60;

    const generateCode = () => {
      const d = ['0','1','2','3','4','5','6','7','8','9'].sort(() => Math.random() - 0.5);
      return d.slice(0, 4).join('');
    };

    const nextRound = () => {
      round += 1;
      secretCode = generateCode();
      playerAttempts = {};
      timeLeft = 60;

      this.broadcast('senha_round_start', {
        round,
        totalRounds,
        mode,
        maxAttempts: 8,
        scores: this.getScores()
      });

      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        timeLeft -= 1;
        this.broadcast('game_timer_tick', { timeLeft });
        if (timeLeft <= 0) {
          clearInterval(timer);
          finishRound(null);
        }
      }, 1000);
    };

    const finishRound = (winnerData) => {
      if (timer) clearInterval(timer);
      this.broadcast('senha_round_result', {
        round,
        totalRounds,
        secretCode,
        winner: winnerData,
        scores: this.getScores(),
        isGameOver: round >= totalRounds
      });

      setTimeout(() => {
        if (round >= totalRounds) {
          this.broadcast('game_podium', { podium: this.getScores().slice(0, 3), scores: this.getScores() });
        } else {
          nextRound();
        }
      }, 6500);
    };

    this.gameInstance = {
      submitGuess: (senderId, guess) => {
        if (!/^\d{4}$/.test(guess)) return { success: false, message: 'Digite 4 dígitos' };
        if (!playerAttempts[senderId]) playerAttempts[senderId] = [];
        const atts = playerAttempts[senderId];
        if (atts.length >= 8) return { success: false, message: 'Tentativas esgotadas' };

        const secretArr = secretCode.split('');
        const guessArr = guess.split('');
        let attemptRecord;

        if (mode === 'facil') {
          const feedback = guessArr.map((d, i) => {
            if (d === secretArr[i]) return { digit: d, status: 'green' };
            if (secretArr.includes(d)) return { digit: d, status: 'yellow' };
            return { digit: d, status: 'red' };
          });
          attemptRecord = { guess, feedback, isCorrect: guess === secretCode };
        } else {
          let exact = 0, existing = 0;
          guessArr.forEach((d, i) => {
            if (d === secretArr[i]) exact++;
            else if (secretArr.includes(d)) existing++;
          });
          attemptRecord = { guess, hardFeedback: { exactMatches: exact, existingMatches: existing }, isCorrect: guess === secretCode };
        }

        atts.push(attemptRecord);
        this.sendTo(senderId, 'senha_guess_feedback', { attempt: attemptRecord, attemptsCount: atts.length });

        const player = this.room.players.find(p => p.id === senderId);
        this.broadcast('senha_activity', { player, attemptsCount: atts.length });

        if (attemptRecord.isCorrect) {
          const pts = Math.max(20 - (atts.length - 1) * 2, 6);
          if (player) player.score += pts;
          finishRound({ player, points: pts, attempts: atts.length });
        }
        return { success: true };
      }
    };

    nextRound();
  }

  // Jogo 4: Botão Rápido
  runBotaoRapidoGame() {
    const list = window.BOTAO_RAPIDO_QUESTIONS || [];
    const totalRounds = this.room.settings.rounds || 5;
    let round = 0;
    let currentQ = null;
    let buzzedBy = null;
    let timer = null;
    let timeLeft = 15;

    const nextRound = () => {
      round += 1;
      buzzedBy = null;
      timeLeft = 15;
      currentQ = list[Math.floor(Math.random() * list.length)];

      this.broadcast('botao_round_start', {
        round,
        totalRounds,
        question: currentQ.question,
        options: currentQ.options,
        scores: this.getScores()
      });

      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        timeLeft -= 1;
        this.broadcast('game_timer_tick', { timeLeft });
        if (timeLeft <= 0) {
          clearInterval(timer);
          finishRound(null, 'Tempo esgotado');
        }
      }, 1000);
    };

    const finishRound = (winnerData, reason) => {
      if (timer) clearInterval(timer);
      this.broadcast('botao_round_result', {
        round,
        totalRounds,
        winner: winnerData,
        correctIndex: currentQ.correctIndex,
        correctOption: currentQ.options[currentQ.correctIndex],
        reason,
        scores: this.getScores(),
        isGameOver: round >= totalRounds
      });

      setTimeout(() => {
        if (round >= totalRounds) {
          this.broadcast('game_podium', { podium: this.getScores().slice(0, 3), scores: this.getScores() });
        } else {
          nextRound();
        }
      }, 6000);
    };

    this.gameInstance = {
      pressBuzzer: (senderId) => {
        if (buzzedBy) return;
        buzzedBy = senderId;
        if (timer) clearInterval(timer);
        const player = this.room.players.find(p => p.id === senderId);
        this.broadcast('botao_buzzed', { player, buzzerTimeLeft: 8 });
      },
      submitAnswer: (senderId, optionIdx) => {
        if (buzzedBy !== senderId) return;
        const player = this.room.players.find(p => p.id === senderId);
        if (optionIdx === currentQ.correctIndex) {
          if (player) player.score += 10;
          finishRound({ player, points: 10, correctOption: currentQ.options[optionIdx] }, 'Correto!');
        } else {
          finishRound(null, 'Errou a resposta');
        }
      }
    };

    nextRound();
  }

  getScores() {
    return (this.room ? this.room.players : [])
      .map(p => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, score: p.score, isHost: p.isHost }))
      .sort((a, b) => b.score - a.score);
  }
}

window.P2PNetworkAdapter = P2PNetworkAdapter;
