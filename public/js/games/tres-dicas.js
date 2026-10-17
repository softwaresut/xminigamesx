// Minijogo: Jogo das 3 Dicas (estilo Silvio Santos)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
    s.round += 1;
    s.item = s.deck.pop();
    s.clueIndex = 0;
    s.winner = null;
    s.lastWrong = null;
    s.phase = 'clue';
    startClue(ctx, 0);
  };

  const startClue = (ctx, idx) => {
    const s = ctx.s;
    s.clueIndex = idx;
    s.pointsAvailable = idx === 0 ? 15 : idx === 1 ? 10 : 5;
    ctx.cue('pop');
    ctx.setTimer(8, () => {
      if (s.clueIndex < 2) {
        startClue(ctx, s.clueIndex + 1);
      } else {
        reveal(ctx, null);
      }
    });
  };

  const reveal = (ctx, winner) => {
    const s = ctx.s;
    if (s.phase !== 'clue') return;
    ctx.clearTimer();
    s.phase = 'reveal';
    s.winner = winner;
    ctx.cue(winner ? 'success' : 'buzzer');
    ctx.after(5500, () => nextRound(ctx));
  };

  registerGame({
    id: 'tres-dicas',
    name: 'Jogo das 3 Dicas',
    emoji: '🔍',
    cat: 'quiz',
    desc: 'Três dicas progressivas estilo Silvio Santos. Quanto mais cedo acertar, mais pontos leva!',
    minPlayers: 1,

    start(ctx) {
      const data = window.TRES_DICAS_DATA || [];
      ctx.s.deck = U.shuffle(data);
      ctx.s.total = Math.min(ctx.settings.rounds, ctx.s.deck.length);
      ctx.s.round = 0;
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'guess' || s.phase !== 'clue') return false;
      const guess = U.clip(data.text, 50);
      if (!guess) return false;

      const player = ctx.player(pid);
      const accepted = [s.item.answer, ...(s.item.synonyms || [])];

      if (U.fuzzy(guess, accepted, 0.2)) {
        ctx.addScore(pid, s.pointsAvailable);
        reveal(ctx, { player, pts: s.pointsAvailable, guess });
      } else {
        s.lastWrong = { player, guess };
        ctx.cue('buzzer');
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        clues: s.item ? s.item.clues.slice(0, s.clueIndex + 1) : [],
        clueIndex: s.clueIndex,
        pointsAvailable: s.pointsAvailable,
        winner: s.winner,
        answer: s.phase === 'reveal' ? s.item.answer : null,
        lastWrong: s.lastWrong,
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      const cluesHtml = v.clues.map((c, i) => `
        <div class="clue-card">
          <span class="clue-tag">DICA ${i + 1}</span>
          <span class="clue-text">${esc(c)}</span>
        </div>`).join('');

      let body = '';
      if (v.phase === 'clue') {
        body = `
          <div class="answer-row">
            <input id="td-input-${v.round}" class="input-field" placeholder="Qual é o seu palpite?" maxlength="50" autocomplete="off" autofocus>
            <button class="btn-primary" data-act="guess">Chutar!</button>
          </div>
          ${v.lastWrong ? `<div class="muted small" style="color:var(--punch-pink); margin-top:10px">❌ ${v.lastWrong.player.avatar} <b>${esc(v.lastWrong.player.nickname)}</b> chutou: "${esc(v.lastWrong.guess)}" (Incorreto!)</div>` : ''}`;
      } else {
        body = v.winner
          ? `<div class="callout callout-lime">🎉 ${v.winner.player.avatar} <b>${esc(v.winner.player.nickname)}</b> acertou com "${esc(v.winner.guess)}"! <span class="pts">+${v.winner.pts} pts</span></div>`
          : `<div class="callout callout-yellow">⏳ Ninguém adivinhou a tempo! A resposta era: <b>${esc(v.answer)}</b></div>`;
      }

      el.innerHTML = `
        <div class="stage-top-badge">
          <span class="badge badge-quiz" style="font-size:1.05rem; padding:6px 16px;">Acerto agora vale ${v.pointsAvailable} Pontos!</span>
        </div>
        <div class="clues-container">${cluesHtml}</div>
        <div class="stage-body">${body}</div>`;

      const input = el.querySelector(`#td-input-${v.round}`);
      const btn = el.querySelector('[data-act="guess"]');
      const submit = () => {
        if (!input || !input.value.trim()) return;
        api.send('guess', { text: input.value });
        input.value = '';
        if (window.innerWidth > 700) input.focus();
      };
      if (btn) btn.onclick = submit;
      if (input) input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    }
  });
})();
