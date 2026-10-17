// Minijogo: O Que Você Prefere? (Dilemas Impossíveis)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
    s.round += 1;
    s.dilemma = s.deck.pop();
    s.votes = {}; // pid -> 'A' | 'B'
    s.phase = 'vote';
    ctx.cue('pop');
    ctx.setTimer(ctx.settings.time || 20, () => reveal(ctx));
  };

  const reveal = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'vote') return;
    ctx.clearTimer();
    s.phase = 'reveal';

    const groupA = [];
    const groupB = [];

    ctx.players.forEach((p) => {
      const choice = s.votes[p.id];
      if (choice === 'A') groupA.push(ctx.pub(p.id));
      else if (choice === 'B') groupB.push(ctx.pub(p.id));
    });

    s.tally = { A: groupA, B: groupB };

    if (groupA.length > groupB.length) {
      groupA.forEach((p) => ctx.addScore(p.id, 3));
      s.winner = 'A';
    } else if (groupB.length > groupA.length) {
      groupB.forEach((p) => ctx.addScore(p.id, 3));
      s.winner = 'B';
    } else {
      // Empate: todos ganham 2 pts
      ctx.players.forEach((p) => { if (s.votes[p.id]) ctx.addScore(p.id, 2); });
      s.winner = 'tie';
    }

    ctx.cue('success');
    ctx.after(6000, () => nextRound(ctx));
  };

  registerGame({
    id: 'prefere',
    name: 'O Que Você Prefere?',
    emoji: '⚖️',
    cat: 'social',
    desc: 'Escolha entre dois dilemas insanos! Quem estiver do lado da maioria pontua.',
    minPlayers: 2,

    start(ctx) {
      const s = ctx.s;
      s.deck = U.shuffle(window.PREFERE_DILEMAS || []);
      s.total = Math.min(ctx.settings.rounds, s.deck.length);
      s.round = 0;
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'vote' || s.phase !== 'vote') return false;
      if (data.choice !== 'A' && data.choice !== 'B') return false;
      s.votes[pid] = data.choice;
      ctx.cue('click');
      if (Object.keys(s.votes).length >= ctx.players.length) {
        reveal(ctx);
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        dilemma: s.dilemma,
        myChoice: s.votes ? s.votes[pid] : null,
        tally: s.tally || { A: [], B: [] },
        winner: s.winner,
        votedCount: Object.keys(s.votes || {}).length,
        totalPlayers: ctx.players.length,
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      const isVote = v.phase === 'vote';

      if (isVote) {
        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--cyan-glow); margin-bottom:6px;">Dilema da Rodada</div>
            <h2 style="font-size:1.4rem;">O que você prefere?</h2>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:20px 0;">
            <button class="${v.myChoice === 'A' ? 'btn-primary' : 'btn-secondary'}" data-choice="A" style="padding:24px 16px; min-height:120px; font-size:1.15rem; font-weight:700; line-height:1.4; border-color:var(--cyan-glow);">
              <div style="font-size:0.85rem; opacity:0.7; margin-bottom:6px;">OPÇÃO A</div>
              ${esc(v.dilemma.a)}
            </button>

            <button class="${v.myChoice === 'B' ? 'btn-primary' : 'btn-secondary'}" data-choice="B" style="padding:24px 16px; min-height:120px; font-size:1.15rem; font-weight:700; line-height:1.4; border-color:var(--magenta-glow);">
              <div style="font-size:0.85rem; opacity:0.7; margin-bottom:6px;">OPÇÃO B</div>
              ${esc(v.dilemma.b)}
            </button>
          </div>

          <div class="muted small" style="text-align:center;">
            Votos computados: <b>${v.votedCount}</b> de ${v.totalPlayers}
          </div>`;

        el.querySelectorAll('[data-choice]').forEach((b) => {
          b.onclick = () => {
            api.send('vote', { choice: b.dataset.choice });
            api.sound('click');
          };
        });
      } else {
        // Reveal
        const total = (v.tally.A.length + v.tally.B.length) || 1;
        const pctA = Math.round((v.tally.A.length / total) * 100);
        const pctB = 100 - pctA;

        let verdict = '';
        if (v.winner === 'A') verdict = `🏆 A Maioria escolheu Opção A! (+3 pts para quem votou A)`;
        else if (v.winner === 'B') verdict = `🏆 A Maioria escolheu Opção B! (+3 pts para quem votou B)`;
        else verdict = `🤝 Empate Perfeito! (+2 pts para todos)`;

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--cyan-glow); margin-bottom:6px;">Resultado do Dilema</div>
            <div class="callout callout-cyan">${verdict}</div>
          </div>

          <div style="margin:20px 0;">
            <div style="display:flex; justify-content:space-between; font-weight:800; margin-bottom:6px;">
              <span style="color:var(--cyan-glow);">A: ${pctA}% (${v.tally.A.length})</span>
              <span style="color:var(--magenta-glow);">B: ${pctB}% (${v.tally.B.length})</span>
            </div>
            <div style="display:flex; height:18px; border-radius:9px; overflow:hidden; border:2px solid #000;">
              <div style="width:${pctA}%; background:var(--cyan-glow);"></div>
              <div style="width:${pctB}%; background:var(--magenta-glow);"></div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div class="glass-panel" style="padding:12px;">
              <div style="font-weight:700; margin-bottom:6px; color:var(--cyan-glow);">Opção A: ${esc(v.dilemma.a)}</div>
              <div class="chip-list">
                ${v.tally.A.map((p) => `<span class="chip">${p.avatar} ${esc(p.nickname)}</span>`).join('') || '<span class="muted small">Nenhum</span>'}
              </div>
            </div>
            <div class="glass-panel" style="padding:12px;">
              <div style="font-weight:700; margin-bottom:6px; color:var(--magenta-glow);">Opção B: ${esc(v.dilemma.b)}</div>
              <div class="chip-list">
                ${v.tally.B.map((p) => `<span class="chip">${p.avatar} ${esc(p.nickname)}</span>`).join('') || '<span class="muted small">Nenhum</span>'}
              </div>
            </div>
          </div>`;
      }
    }
  });
})();
