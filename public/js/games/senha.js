// Minijogo: Jogo da Senha (Código Secreto)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total) { ctx.end(); return; }
    s.round += 1;
    s.code = U.shuffle(['0','1','2','3','4','5','6','7','8','9']).slice(0, 4).join('');
    s.attempts = {}; // pid -> []
    s.winner = null;
    s.phase = 'play';
    ctx.cue('pop');
    ctx.setTimer(60, () => reveal(ctx, null));
  };

  const reveal = (ctx, winner) => {
    const s = ctx.s;
    if (s.phase !== 'play') return;
    ctx.clearTimer();
    s.phase = 'reveal';
    s.winner = winner;
    ctx.cue(winner ? 'success' : 'buzzer');
    ctx.after(6000, () => nextRound(ctx));
  };

  registerGame({
    id: 'jogo-senha',
    name: 'Jogo da Senha',
    emoji: '🔐',
    cat: 'deducao',
    desc: 'Descubra a senha de 4 dígitos em até 8 tentativas. Modo fácil (cores) e difícil (contagem)!',
    minPlayers: 1,

    start(ctx) {
      ctx.s.total = Math.min(ctx.settings.rounds || 3, 5);
      ctx.s.round = 0;
      ctx.s.mode = ctx.settings.difficulty || 'facil';
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'guess' || s.phase !== 'play') return false;
      const guess = (data.text || '').replace(/\D/g, '').slice(0, 4);
      if (guess.length !== 4) return false;

      s.attempts[pid] = s.attempts[pid] || [];
      const atts = s.attempts[pid];
      if (atts.length >= 8) return false;

      const secretArr = s.code.split('');
      const guessArr = guess.split('');
      let isCorrect = guess === s.code;
      let record;

      if (s.mode === 'facil') {
        const feedback = guessArr.map((d, i) => {
          if (d === secretArr[i]) return { digit: d, status: 'green' };
          if (secretArr.includes(d)) return { digit: d, status: 'yellow' };
          return { digit: d, status: 'red' };
        });
        record = { guess, feedback, isCorrect };
      } else {
        let exact = 0, existing = 0;
        guessArr.forEach((d, i) => {
          if (d === secretArr[i]) exact++;
          else if (secretArr.includes(d)) existing++;
        });
        record = { guess, hardFeedback: { exact, existing }, isCorrect };
      }

      atts.push(record);
      const player = ctx.player(pid);

      if (isCorrect) {
        const pts = Math.max(20 - (atts.length - 1) * 2, 6);
        ctx.addScore(pid, pts);
        reveal(ctx, { player, pts, attempts: atts.length });
      } else {
        ctx.cue('click');
        // Se todos esgotaram tentativas
        const allOut = ctx.players.every((p) => (s.attempts[p.id] || []).length >= 8);
        if (allOut) reveal(ctx, null);
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      const myAtts = s.attempts[pid] || [];
      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        mode: s.mode,
        myAttempts: myAtts,
        attemptsLeft: 8 - myAtts.length,
        winner: s.winner,
        secretCode: s.phase === 'reveal' ? s.code : null,
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      let body = '';

      if (v.phase === 'play') {
        const historyHtml = v.myAttempts.map((att, i) => {
          let chips = '';
          if (att.feedback) {
            chips = att.feedback.map((f) => `<span class="code-digit-box ${f.status}">${f.digit}</span>`).join('');
          } else {
            chips = `<span class="code-guess-txt">${att.guess}</span> <span class="muted small">🎯 ${att.hardFeedback.exact} na posição | 🔄 ${att.hardFeedback.existing} no código</span>`;
          }
          return `<div class="attempt-row"><span>#${i + 1}</span><div class="attempt-chips">${chips}</div></div>`;
        }).reverse().join('');

        body = `
          <div class="senha-form">
            <input id="senha-input-${v.round}" class="input-field senha-input" placeholder="0000" maxlength="4" autocomplete="off" autofocus ${v.attemptsLeft <= 0 ? 'disabled' : ''}>
            <button class="btn-primary" data-act="guess" ${v.attemptsLeft <= 0 ? 'disabled' : ''}>Testar</button>
          </div>
          <div class="muted small" style="margin:8px 0;">Tentativas restantes: <b>${v.attemptsLeft}</b> de 8</div>
          <div class="attempts-history">${historyHtml || '<div class="muted small">Nenhum palpite ainda. Digite 4 números!</div>'}</div>`;
      } else {
        body = v.winner
          ? `<div class="callout callout-lime">🏆 ${v.winner.player.avatar} <b>${esc(v.winner.player.nickname)}</b> quebrou o código em ${v.winner.attempts} tentativas! <span class="pts">+${v.winner.pts} pts</span></div>`
          : `<div class="callout callout-yellow">Ninguém quebrou o código a tempo!</div>`;
        body += `<div class="big-answer" style="margin-top:16px;">O CÓDIGO ERA: [ ${v.secretCode} ]</div>`;
      }

      el.innerHTML = `
        <div class="stage-top-badge">
          <span class="badge badge-deducao">${v.mode === 'facil' ? 'Modo Fácil (Cores nas posições)' : 'Modo Difícil (Apenas contagem)'}</span>
        </div>
        <div class="stage-card">
          <h2 class="stage-question">Descubra o Código Secreto de 4 Dígitos</h2>
        </div>
        <div class="stage-body">${body}</div>`;

      const input = el.querySelector(`#senha-input-${v.round}`);
      const btn = el.querySelector('[data-act="guess"]');
      const submit = () => {
        if (!input || input.value.trim().length !== 4) return;
        api.send('guess', { text: input.value });
        input.value = '';
        input.focus();
      };
      if (btn) btn.onclick = submit;
      if (input) input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    }
  });
})();
