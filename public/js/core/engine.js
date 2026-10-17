// xMiniGamesx - motor de jogo do anfitrião (host-authoritative) + registro de jogos
//
// Cada jogo chama registerGame({...}) com:
//   id, name, emoji, cat ('quiz'|'social'|'reflexo'|'deducao'), desc, minPlayers
//   start(ctx)                       -> monta o estado inicial em ctx.s
//   action(ctx, playerId, type, data)-> trata ações; retornar false evita sincronizar
//   view(ctx, playerId)              -> objeto que aquele jogador enxerga
//   render(el, v, api)               -> desenha a tela (roda em todos os clientes)
//   playerLeft(ctx, playerId)        -> opcional
(function () {
  const GAMES = {};
  const ORDER = [];

  window.GAMES = GAMES;
  window.GAME_ORDER = ORDER;
  window.registerGame = (def) => {
    if (!GAMES[def.id]) ORDER.push(def.id);
    GAMES[def.id] = def;
  };

  class HostEngine {
    constructor(app, net, code, me) {
      this.app = app;
      this.net = net;
      this.room = {
        code,
        hostId: me.id,
        players: [{ id: me.id, nickname: me.nickname, avatar: me.avatar, score: 0, connected: true }],
        selectedGame: ORDER[0],
        settings: { rounds: 5, time: 20, difficulty: 'facil' },
        phase: 'lobby',
        gameId: null
      };
      this.chat = [];
      this.game = null;
      this.ctx = null;
      this.timer = null;
      this.timerEnd = 0;
      this.timerTotal = 0;
      this.delays = new Set();
      this.cue = null;
      this.cueN = 0;

      net.on('msg', (pid, msg) => this.handle(pid, msg));
      net.on('leave', (pid) => this.leave(pid));
    }

    // ---------- entrega ----------
    deliver(pid, msg) {
      if (pid === this.room.hostId) this.app.receive(msg);
      else this.net.send(pid, msg);
    }
    everyone(msg) {
      this.room.players.forEach((p) => { if (p.connected) this.deliver(p.id, msg); });
    }
    pushRoom() { this.everyone({ t: 'room', room: this.room }); }
    toast(text, pid) {
      if (pid) this.deliver(pid, { t: 'toast', text });
      else this.everyone({ t: 'toast', text });
    }
    systemChat(text) { this.addChat({ system: true, text }); }
    addChat(m) {
      m.time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      this.chat.push(m);
      if (this.chat.length > 60) this.chat.shift();
      this.everyone({ t: 'chat', m });
    }

    // ---------- mensagens recebidas ----------
    handle(pid, msg) {
      if (!msg || typeof msg !== 'object') return;
      const p = this.room.players.find((x) => x.id === pid);

      switch (msg.t) {
        case 'join': {
          let player = p;
          if (player) {
            player.connected = true;
          } else {
            player = {
              id: pid,
              nickname: U.clip(msg.nickname, 16) || 'Jogador',
              avatar: U.clip(msg.avatar, 4) || '🙂',
              score: 0,
              connected: true
            };
            this.room.players.push(player);
          }
          this.deliver(pid, { t: 'chatlog', list: this.chat });
          this.pushRoom();
          if (this.game) this.syncOne(player);
          this.systemChat(`${player.avatar} ${player.nickname} entrou na sala`);
          break;
        }

        case 'action': {
          if (!p || !this.game || this.room.phase !== 'game') return;
          let r;
          try { r = this.game.action(this.ctx, pid, msg.type, msg.data || {}); } catch (e) { console.error('[game action]', e); }
          if (r !== false) this.sync();
          break;
        }

        case 'chat': {
          if (!p) return;
          const text = U.clip(msg.text, 160);
          if (!text) return;
          this.addChat({ id: p.id, nickname: p.nickname, avatar: p.avatar, text });
          break;
        }

        case 'react': {
          if (!p) return;
          this.everyone({ t: 'react', emoji: U.clip(msg.emoji, 4), avatar: p.avatar });
          break;
        }

        case 'lobby': {
          if (pid !== this.room.hostId) return;
          this.lobbyAction(msg);
          break;
        }
      }
    }

    lobbyAction(msg) {
      if (msg.op === 'select' && GAMES[msg.gameId] && this.room.phase === 'lobby') {
        this.room.selectedGame = msg.gameId;
        this.pushRoom();
      } else if (msg.op === 'settings') {
        const s = this.room.settings;
        if (msg.rounds) s.rounds = Math.max(1, Math.min(15, parseInt(msg.rounds, 10) || 5));
        if (msg.time) s.time = Math.max(10, Math.min(90, parseInt(msg.time, 10) || 20));
        if (msg.difficulty) s.difficulty = msg.difficulty === 'dificil' ? 'dificil' : 'facil';
        this.pushRoom();
      } else if (msg.op === 'start') {
        this.startGame();
      } else if (msg.op === 'lobby') {
        this.backToLobby();
      }
    }

    leave(pid) {
      const p = this.room.players.find((x) => x.id === pid);
      if (!p) return;
      if (this.room.phase === 'lobby') {
        this.room.players = this.room.players.filter((x) => x.id !== pid);
      } else {
        p.connected = false;
      }
      this.systemChat(`${p.avatar} ${p.nickname} saiu`);
      this.pushRoom();
      if (this.game) {
        try { if (this.game.playerLeft) this.game.playerLeft(this.ctx, pid); } catch (e) { console.error(e); }
        this.sync();
      }
    }

    // ---------- ciclo do jogo ----------
    activePlayers() { return this.room.players.filter((p) => p.connected); }

    startGame() {
      const def = GAMES[this.room.selectedGame];
      if (!def) return;
      const active = this.activePlayers();
      if (active.length < (def.minPlayers || 1)) {
        this.toast(`${def.name} precisa de pelo menos ${def.minPlayers} jogadores.`, this.room.hostId);
        return;
      }
      this.stopGame();
      this.room.players = active;
      this.room.players.forEach((p) => { p.score = 0; });
      this.room.phase = 'game';
      this.room.gameId = def.id;
      this.game = def;
      this.ctx = this.makeCtx();
      this.pushRoom();
      try { def.start(this.ctx); } catch (e) { console.error('[game start]', e); }
      this.sync();
    }

    stopGame() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.timerEnd = 0;
      this.delays.forEach((h) => clearTimeout(h));
      this.delays.clear();
      this.cue = null;
    }

    endGame() {
      this.stopGame();
      this.game = null;
      this.ctx = null;
      this.room.phase = 'podium';
      this.pushRoom();
    }

    backToLobby() {
      this.stopGame();
      this.game = null;
      this.ctx = null;
      this.room.phase = 'lobby';
      this.room.gameId = null;
      this.room.players = this.room.players.filter((p) => p.connected);
      this.pushRoom();
    }

    makeCtx() {
      const E = this;
      const ctx = {
        s: {},
        settings: Object.assign({}, this.room.settings),
        get players() { return E.activePlayers(); },
        player(id) { return E.room.players.find((p) => p.id === id); },
        name(id) { const p = ctx.player(id); return p ? p.nickname : '?'; },
        pub(id) { const p = ctx.player(id); return p ? { id: p.id, nickname: p.nickname, avatar: p.avatar } : { id, nickname: '?', avatar: '❔' }; },
        addScore(id, n) { const p = ctx.player(id); if (p) p.score += n; },
        guard(fn) {
          return () => {
            if (E.ctx !== ctx) return; // jogo já terminou
            try { fn(); } catch (e) { console.error('[game timer]', e); }
            if (E.ctx === ctx) E.sync();
          };
        },
        // Timer visível (contagem regressiva no topo)
        setTimer(sec, cb) {
          ctx.clearTimer();
          E.timerTotal = sec;
          E.timerEnd = Date.now() + sec * 1000;
          E.timer = setTimeout(() => { E.timer = null; E.timerEnd = 0; ctx.guard(cb)(); }, sec * 1000);
        },
        clearTimer() {
          if (E.timer) clearTimeout(E.timer);
          E.timer = null;
          E.timerEnd = 0;
        },
        // Atraso invisível (ex: tempo de leitura do resultado, pavio da bomba)
        after(ms, cb) {
          const h = setTimeout(() => { E.delays.delete(h); ctx.guard(cb)(); }, ms);
          E.delays.add(h);
          return h;
        },
        cancel(h) { clearTimeout(h); E.delays.delete(h); },
        cue(name) { E.cueN += 1; E.cue = { name, id: E.cueN }; },
        toast(text, pid) { E.toast(text, pid); },
        sync() { E.sync(); },
        end() { E.endGame(); }
      };
      return ctx;
    }

    buildView(p) {
      let v = {};
      try { v = this.game.view(this.ctx, p.id) || {}; } catch (e) { console.error('[game view]', e); }
      v._timer = this.timerEnd ? { left: Math.max(0, this.timerEnd - Date.now()), total: this.timerTotal } : null;
      v._cue = this.cue;
      v._scores = this.room.players
        .map((x) => ({ id: x.id, nickname: x.nickname, avatar: x.avatar, score: x.score, connected: x.connected }))
        .sort((a, b) => b.score - a.score);
      return v;
    }

    sync() {
      if (!this.game) return;
      this.activePlayers().forEach((p) => this.deliver(p.id, { t: 'view', v: this.buildView(p) }));
    }

    syncOne(p) {
      if (!this.game) return;
      this.deliver(p.id, { t: 'view', v: this.buildView(p) });
    }
  }

  window.HostEngine = HostEngine;

  // =====================================================================
  // Helper: jogos de "adivinhe a resposta" (Emoji, Anagrama, Música, Leitura Labial)
  // opts: id, name, emoji, cat, desc, minPlayers, deck(ctx) -> itens,
  //       answers(item) -> respostas aceitas, prompt(item) -> objeto exibido,
  //       renderPrompt(prompt, esc) -> HTML, ratio (tolerância), speaker (bool),
  //       points: array por ordem de acerto
  // =====================================================================
  window.makeGuessGame = (opts) => {
    const points = opts.points || [10, 7, 5, 3];
    const nextRound = (ctx) => {
      const s = ctx.s;
      if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
      s.round += 1;
      s.item = s.deck.pop();
      s.correct = [];       // ids na ordem de acerto
      s.tries = {};         // id -> nº de tentativas
      s.last = {};          // id -> último chute errado
      s.phase = 'guess';
      if (opts.speaker) {
        const ps = ctx.players;
        s.speakerIdx = (s.speakerIdx + 1) % ps.length;
        s.speaker = ps[s.speakerIdx].id;
      }
      ctx.cue('pop');
      ctx.setTimer(opts.time ? opts.time(ctx) : ctx.settings.time, () => reveal(ctx));
    };
    const guessers = (ctx) => ctx.players.filter((p) => p.id !== ctx.s.speaker);
    const reveal = (ctx) => {
      const s = ctx.s;
      if (s.phase !== 'guess') return;
      ctx.clearTimer();
      s.phase = 'reveal';
      ctx.cue(s.correct.length ? 'success' : 'buzzer');
      ctx.after(5000, () => nextRound(ctx));
    };

    registerGame({
      id: opts.id, name: opts.name, emoji: opts.emoji, cat: opts.cat, desc: opts.desc,
      minPlayers: opts.minPlayers || (opts.speaker ? 2 : 1),

      start(ctx) {
        const s = ctx.s;
        s.deck = U.shuffle(opts.deck(ctx));
        s.total = Math.min(ctx.settings.rounds, s.deck.length);
        s.round = 0;
        s.speakerIdx = -1;
        s.speaker = null;
        nextRound(ctx);
      },

      action(ctx, pid, type, data) {
        const s = ctx.s;
        if (type !== 'guess' || s.phase !== 'guess') return false;
        if (pid === s.speaker || s.correct.includes(pid)) return false;
        const g = U.clip(data.text, 80);
        if (!g) return false;
        s.tries[pid] = (s.tries[pid] || 0) + 1;
        if (U.fuzzy(g, opts.answers(s.item), opts.ratio || 0.2)) {
          const pts = points[Math.min(s.correct.length, points.length - 1)];
          s.correct.push(pid);
          ctx.addScore(pid, pts);
          if (opts.speaker && s.speaker) ctx.addScore(s.speaker, 3);
          ctx.cue('pop');
          if (s.correct.length >= guessers(ctx).length) reveal(ctx);
        } else {
          s.last[pid] = g;
        }
      },

      view(ctx, pid) {
        const s = ctx.s;
        const isSpeaker = pid === s.speaker;
        const showAnswer = s.phase === 'reveal' || isSpeaker;
        return {
          phase: s.phase,
          label: `Rodada ${s.round} de ${s.total}`,
          prompt: opts.prompt(s.item, { isSpeaker, phase: s.phase }),
          answer: showAnswer ? opts.answers(s.item)[0] : null,
          speaker: s.speaker ? ctx.pub(s.speaker) : null,
          isSpeaker,
          solved: s.correct.includes(pid),
          myPoints: s.correct.includes(pid) ? points[Math.min(s.correct.indexOf(pid), points.length - 1)] : 0,
          last: s.last[pid] || null,
          correct: s.correct.map((id, i) => Object.assign(ctx.pub(id), { pts: points[Math.min(i, points.length - 1)] })),
          total: guessers(ctx).length,
          round: s.round
        };
      },

      render(el, v, api) {
        const esc = api.esc;
        const promptHtml = opts.renderPrompt(v.prompt, esc, v);
        let body = '';
        if (v.phase === 'guess') {
          if (v.isSpeaker) {
            body = `<div class="callout callout-yellow">Você é a vez! Faça a leitura labial <b>sem som</b>:<div class="big-answer">${esc(v.answer)}</div></div>`;
          } else if (v.solved) {
            body = `<div class="callout callout-lime">✅ Acertou! +${v.myPoints} pts. Aguarde os outros…</div>`;
          } else {
            body = `
              <div class="answer-row">
                <input id="guess-${v.round}" class="input-field" placeholder="Digite seu palpite…" maxlength="80" autocomplete="off">
                <button class="btn-primary" data-act="send">Chutar</button>
              </div>
              ${v.last ? `<div class="muted small">❌ "${esc(v.last)}" não é. Tente de novo!</div>` : ''}`;
          }
        } else {
          body = `<div class="callout callout-cyan">Resposta: <div class="big-answer">${esc(v.answer)}</div></div>`;
        }
        const list = v.correct.length
          ? v.correct.map((c, i) => `<span class="chip"><b>${i + 1}º</b> ${c.avatar} ${esc(c.nickname)} <span class="pts">+${c.pts}</span></span>`).join('')
          : '<span class="muted small">Ninguém acertou ainda.</span>';

        el.innerHTML = `
          ${v.speaker ? `<div class="turn-banner">${v.speaker.avatar} <b>${esc(v.speaker.nickname)}</b> está fazendo a leitura labial</div>` : ''}
          <div class="stage-card">${promptHtml}</div>
          <div class="stage-body">${body}</div>
          <div class="section-title">Acertaram (${v.correct.length}/${v.total})</div>
          <div class="chip-list">${list}</div>`;

        const input = el.querySelector(`#guess-${v.round}`);
        const send = () => {
          if (!input || !input.value.trim()) return;
          api.send('guess', { text: input.value });
          input.value = '';
          input.focus();
        };
        const btn = el.querySelector('[data-act="send"]');
        if (btn) btn.onclick = send;
        if (input) input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
      }
    });
  };
})();
