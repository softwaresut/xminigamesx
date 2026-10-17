// Minijogo: Botão Rápido (Torta na Cara)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
    s.round += 1;
    s.item = s.deck.pop();
    s.buzzedBy = null;
    s.lockedOut = [];
    s.winner = null;
    s.phase = 'buzz';
    ctx.cue('pop');
    ctx.setTimer(15, () => reveal(ctx, null, 'Tempo esgotado para bater no botão!'));
  };

  const reveal = (ctx, winner, reason) => {
    const s = ctx.s;
    if (s.phase === 'reveal') return;
    ctx.clearTimer();
    s.phase = 'reveal';
    s.winner = winner;
    s.reason = reason;
    ctx.cue(winner ? 'success' : 'buzzer');
    ctx.after(5500, () => nextRound(ctx));
  };

  registerGame({
    id: 'botao-rapido',
    name: 'Botão Rápido',
    emoji: '🚨',
    cat: 'reflexo',
    desc: 'Quem bater no botão primeiro tem a chance de responder e pontuar. Se errar, libera para os outros!',
    minPlayers: 1,

    start(ctx) {
      const data = window.BOTAO_RAPIDO_QUESTIONS || [];
      ctx.s.deck = U.shuffle(data);
      ctx.s.total = Math.min(ctx.settings.rounds, ctx.s.deck.length);
      ctx.s.round = 0;
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;

      if (type === 'buzz' && s.phase === 'buzz') {
        if (s.lockedOut.includes(pid)) return false;
        s.buzzedBy = pid;
        s.phase = 'answer';
        ctx.clearTimer();
        ctx.cue('buzzer');
        ctx.setTimer(8, () => {
          // Não respondeu no tempo do buzzer: trava esse jogador e reabre para os outros!
          s.lockedOut.push(pid);
          if (s.lockedOut.length >= ctx.players.length) {
            reveal(ctx, null, 'Ninguém acertou!');
          } else {
            s.buzzedBy = null;
            s.phase = 'buzz';
            ctx.setTimer(10, () => reveal(ctx, null, 'Tempo esgotado!'));
          }
        });
      }

      if (type === 'answer' && s.phase === 'answer' && s.buzzedBy === pid) {
        ctx.clearTimer();
        const optionIdx = parseInt(data.index, 10);
        const player = ctx.player(pid);

        if (optionIdx === s.item.correctIndex) {
          ctx.addScore(pid, 10);
          reveal(ctx, { player, pts: 10, option: s.item.options[optionIdx] }, 'Resposta correta!');
        } else {
          // Errou: trava e reabre para os outros!
          s.lockedOut.push(pid);
          ctx.cue('buzzer');
          if (s.lockedOut.length >= ctx.players.length) {
            reveal(ctx, null, 'Nenhum jogador acertou!');
          } else {
            s.buzzedBy = null;
            s.phase = 'buzz';
            ctx.setTimer(10, () => reveal(ctx, null, 'Tempo esgotado!'));
          }
        }
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        question: s.item.question,
        options: s.item.options,
        correctIndex: s.phase === 'reveal' ? s.item.correctIndex : null,
        buzzedPlayer: s.buzzedBy ? ctx.pub(s.buzzedBy) : null,
        isMeBuzzed: s.buzzedBy === pid,
        isLockedOut: s.lockedOut.includes(pid),
        winner: s.winner,
        reason: s.reason,
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      let body = '';

      if (v.phase === 'buzz') {
        body = `
          <div class="buzzer-container">
            <button class="giant-buzzer-btn" data-act="buzz" ${v.isLockedOut ? 'disabled' : ''}>
              BATER NO<br>BOTÃO! 🚨
            </button>
            <div class="muted small" style="margin-top:16px;">
              ${v.isLockedOut ? '<span style="color:var(--punch-pink)">Você errou nesta rodada! Bloqueado.</span>' : 'Seja o mais rápido a bater!'}
            </div>
          </div>`;
      } else if (v.phase === 'answer') {
        if (v.isMeBuzzed) {
          const optsHtml = v.options.map((opt, i) => `
            <button class="btn-secondary option-btn" data-act="answer" data-idx="${i}">
              <b>${['A','B','C','D'][i]})</b> ${esc(opt)}
            </button>`).join('');

          body = `
            <div class="callout callout-lime" style="margin-bottom:18px;">
              VOCÊ BATEU PRIMEIRO! Escolha a resposta rápida:
            </div>
            <div class="options-grid">${optsHtml}</div>`;
        } else {
          body = `
            <div class="callout callout-yellow">
              ${v.buzzedPlayer.avatar} <b>${esc(v.buzzedPlayer.nickname)}</b> bateu no botão! Aguardando resposta…
            </div>`;
        }
      } else {
        body = v.winner
          ? `<div class="callout callout-lime">🎉 ${v.winner.player.avatar} <b>${esc(v.winner.player.nickname)}</b> acertou: "${esc(v.winner.option)}"! <span class="pts">+10 pts</span></div>`
          : `<div class="callout callout-pink">❌ ${esc(v.reason || 'Ninguém acertou!')} Resposta certa: <b>${esc(v.options[v.correctIndex])}</b></div>`;
      }

      el.innerHTML = `
        <div class="stage-card">
          <div class="stage-badge">PERGUNTA RÁPIDA</div>
          <h2 class="stage-question">${esc(v.question)}</h2>
        </div>
        <div class="stage-body">${body}</div>`;

      const buzzBtn = el.querySelector('[data-act="buzz"]');
      if (buzzBtn) buzzBtn.onclick = () => api.send('buzz');

      el.querySelectorAll('[data-act="answer"]').forEach((b) => {
        b.onclick = () => api.send('answer', { index: b.dataset.idx });
      });
    }
  });
})();
