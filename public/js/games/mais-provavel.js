// Minijogo: Quem é Mais Provável?
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
    s.round += 1;
    s.question = s.deck.pop();
    s.votes = {}; // voterId -> targetId
    s.phase = 'vote';
    ctx.cue('pop');
    ctx.setTimer(ctx.settings.time || 20, () => reveal(ctx));
  };

  const reveal = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'vote') return;
    ctx.clearTimer();
    s.phase = 'reveal';

    // Apuração dos votos
    const counts = {}; // targetId -> [voterIds]
    ctx.players.forEach((p) => { counts[p.id] = []; });

    Object.entries(s.votes).forEach(([voterId, targetId]) => {
      if (counts[targetId]) counts[targetId].push(voterId);
    });

    // Encontra o mais votado
    let max = 0;
    Object.values(counts).forEach((arr) => { if (arr.length > max) max = arr.length; });

    const winners = [];
    Object.entries(counts).forEach(([tid, arr]) => {
      if (arr.length === max && max > 0) winners.push(tid);
    });

    s.tally = ctx.players.map((p) => ({
      target: ctx.pub(p.id),
      votes: (counts[p.id] || []).map((vid) => ctx.pub(vid)),
      count: (counts[p.id] || []).length,
      isWinner: winners.includes(p.id)
    })).sort((a, b) => b.count - a.count);

    // Quem votou com a maioria ganha 5 pontos
    Object.entries(s.votes).forEach(([voterId, targetId]) => {
      if (winners.includes(targetId) && max > 0) {
        ctx.addScore(voterId, 5);
      }
    });

    s.winners = winners.map((id) => ctx.pub(id));
    ctx.cue('success');
    ctx.after(6000, () => nextRound(ctx));
  };

  registerGame({
    id: 'mais-provavel',
    name: 'Quem é Mais Provável',
    emoji: '👉',
    cat: 'social',
    desc: 'Vote secretamente em quem mais combina com a situação. Quem votar na maioria ganha +5 pts!',
    minPlayers: 2,

    start(ctx) {
      const s = ctx.s;
      s.deck = U.shuffle(window.MAIS_PROVAVEL_QUESTIONS || []);
      s.total = Math.min(ctx.settings.rounds, s.deck.length);
      s.round = 0;
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'vote' || s.phase !== 'vote') return false;
      const targetId = data.targetId;
      if (!ctx.player(targetId)) return false;
      s.votes[pid] = targetId;
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
        question: s.question,
        myVote: s.votes ? s.votes[pid] : null,
        players: ctx.players.map((p) => ctx.pub(p.id)),
        tally: s.tally || [],
        winners: s.winners || [],
        votedCount: Object.keys(s.votes || {}).length,
        totalPlayers: ctx.players.length,
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      const isVote = v.phase === 'vote';

      if (isVote) {
        const playerButtons = v.players.map((p) => {
          const isSelected = v.myVote === p.id;
          return `
            <button class="${isSelected ? 'btn-primary' : 'btn-secondary'}" data-vote="${p.id}" style="padding:16px; font-size:1.1rem; display:flex; align-items:center; gap:10px; justify-content:center;">
              <span style="font-size:1.6rem;">${p.avatar}</span>
              <b>${esc(p.nickname)}</b>
            </button>`;
        }).join('');

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--amber-glow); margin-bottom:6px;">Hora do Voto</div>
            <h2 style="font-size:1.5rem; line-height:1.4;">${esc(v.question)}</h2>
            <p class="muted small" style="margin-top:8px;">Escolha quem mais combina com a frase. O voto é secreto!</p>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:20px;">
            ${playerButtons}
          </div>

          <div class="muted small" style="text-align:center; margin-top:16px;">
            Votos confirmados: <b>${v.votedCount}</b> de ${v.totalPlayers}
          </div>`;

        el.querySelectorAll('[data-vote]').forEach((b) => {
          b.onclick = () => {
            api.send('vote', { targetId: b.dataset.vote });
            api.sound('click');
          };
        });
      } else {
        // Reveal
        const winnersTitle = v.winners.map((w) => `${w.avatar} <b>${esc(w.nickname)}</b>`).join(' e ');

        const tallyHtml = v.tally.map((item) => {
          const pct = v.totalPlayers > 0 ? Math.round((item.count / v.totalPlayers) * 100) : 0;
          return `
            <div class="glass-panel" style="padding:12px 16px; margin-bottom:10px; border-left:4px solid ${item.isWinner ? 'var(--amber-glow)' : 'var(--bg-card-border)'};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-size:1.1rem; font-weight:700;">${item.target.avatar} ${esc(item.target.nickname)} ${item.isWinner ? '👑 Eleito!' : ''}</div>
                <div style="font-weight:800; font-size:1rem; color:var(--cyan-glow);">${item.count} voto(s) (${pct}%)</div>
              </div>
              <div class="progress-bar-bg" style="height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${item.isWinner ? 'var(--amber-glow)' : 'var(--cyan-glow)'};"></div>
              </div>
              <div class="muted small" style="margin-top:6px;">
                Votado por: ${item.votes.map((vt) => `${vt.avatar} ${esc(vt.nickname)}`).join(', ') || 'Ninguém'}
              </div>
            </div>`;
        }).join('');

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--amber-glow); margin-bottom:6px;">Resultado dos Votos</div>
            <h2 style="font-size:1.35rem;">${esc(v.question)}</h2>
            <div class="callout callout-yellow" style="margin-top:12px;">
              🏆 Mais votado: ${winnersTitle}! (+5 pts para quem votou com a maioria)
            </div>
          </div>

          <div style="margin-top:16px;">
            ${tallyHtml}
          </div>`;
      }
    }
  });
})();
