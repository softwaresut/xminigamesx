// Minijogo: Jokenpô Tournament (Pedra, Papel e Tesoura)
(function () {
  const CHOICES = {
    rock: { name: 'Pedra', emoji: '✊', beats: 'scissors' },
    paper: { name: 'Papel', emoji: '✋', beats: 'rock' },
    scissors: { name: 'Tesoura', emoji: '✌️', beats: 'paper' }
  };

  const startTournamentRound = (ctx) => {
    const s = ctx.s;
    if (s.bracket.length <= 1) {
      if (s.bracket.length === 1) {
        ctx.addScore(s.bracket[0], 15);
      }
      ctx.end();
      return;
    }

    s.round += 1;
    s.pairs = [];
    s.byes = [];
    const pool = U.shuffle(s.bracket.slice());

    while (pool.length >= 2) {
      s.pairs.push([pool.pop(), pool.pop()]);
    }
    if (pool.length === 1) {
      s.byes.push(pool.pop());
    }

    s.choices = {}; // pid -> 'rock'|'paper'|'scissors'
    s.phase = 'choose';
    ctx.cue('pop');
    ctx.setTimer(6, () => resolveDuels(ctx));
  };

  const resolveDuels = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'choose') return;
    ctx.clearTimer();
    s.phase = 'reveal';

    const winners = [];
    const duelsSummary = [];

    s.pairs.forEach(([p1Id, p2Id]) => {
      const c1 = s.choices[p1Id] || ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
      const c2 = s.choices[p2Id] || ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];

      let winnerId = null;
      if (c1 === c2) {
        // Morte súbita / desempate por moeda
        winnerId = Math.random() < 0.5 ? p1Id : p2Id;
      } else if (CHOICES[c1].beats === c2) {
        winnerId = p1Id;
      } else {
        winnerId = p2Id;
      }

      ctx.addScore(winnerId, 5);
      winners.push(winnerId);

      duelsSummary.push({
        p1: ctx.pub(p1Id),
        c1: CHOICES[c1],
        p2: ctx.pub(p2Id),
        c2: CHOICES[c2],
        winner: ctx.pub(winnerId),
        isTie: c1 === c2
      });
    });

    s.byes.forEach((bid) => {
      winners.push(bid);
      duelsSummary.push({
        p1: ctx.pub(bid),
        c1: { name: 'Avançou direto', emoji: '⏩' },
        winner: ctx.pub(bid),
        isBye: true
      });
    });

    s.bracket = winners;
    s.duelsSummary = duelsSummary;
    ctx.cue('success');
    ctx.after(5500, () => startTournamentRound(ctx));
  };

  registerGame({
    id: 'jokenpo',
    name: 'Jokenpô Mania',
    emoji: '✊',
    cat: 'reflexo',
    desc: 'Torneio eliminatório de Pedra, Papel e Tesoura! Escolha em 5s e vença seus duelos.',
    minPlayers: 2,

    start(ctx) {
      const s = ctx.s;
      s.bracket = ctx.players.map((p) => p.id);
      s.round = 0;
      startTournamentRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'choice' || s.phase !== 'choose') return false;
      if (!CHOICES[data.choice]) return false;
      s.choices[pid] = data.choice;
      ctx.cue('click');

      // Se todos os jogadores em duelos escolheram, avança
      const inDuels = [].concat(...s.pairs);
      if (inDuels.every((id) => s.choices[id])) {
        resolveDuels(ctx);
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      const myPair = (s.pairs || []).find((pair) => pair.includes(pid));
      const opponentId = myPair ? (myPair[0] === pid ? myPair[1] : myPair[0]) : null;
      const isBye = (s.byes || []).includes(pid);
      return {
        phase: s.phase,
        label: `Fase Eliminatória ${s.round}`,
        myChoice: s.choices ? s.choices[pid] : null,
        opponent: opponentId ? ctx.pub(opponentId) : null,
        isBye,
        isInDuel: !!myPair,
        duelsSummary: s.duelsSummary || [],
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      const isChoose = v.phase === 'choose';

      if (isChoose) {
        if (v.isBye) {
          el.innerHTML = `
            <div class="stage-card">
              <div style="font-size:3rem;">⏩</div>
              <h2 style="font-size:1.5rem; color:var(--solar-yellow);">Você avançou direto!</h2>
              <p class="muted small">Número ímpar de jogadores nesta fase. Aguarde os outros duelarem.</p>
            </div>`;
          return;
        }

        if (!v.isInDuel) {
          el.innerHTML = `
            <div class="stage-card">
              <h2 style="font-size:1.3rem;">Você foi eliminado!</h2>
              <p class="muted small">Aguarde o grande campeão ser decidido.</p>
            </div>`;
          return;
        }

        const choicesButtons = [
          { key: 'rock', emoji: '✊', name: 'Pedra' },
          { key: 'paper', emoji: '✋', name: 'Papel' },
          { key: 'scissors', emoji: '✌️', name: 'Tesoura' }
        ].map((c) => `
          <button class="${v.myChoice === c.key ? 'btn-primary' : 'btn-secondary'}" data-choice="${c.key}" style="padding:24px 10px; font-size:1.2rem; display:flex; flex-direction:column; align-items:center; gap:8px;">
            <span style="font-size:3rem;">${c.emoji}</span>
            <b>${c.name}</b>
          </button>`).join('');

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--cyan-glow); margin-bottom:6px;">Duelo 1 vs 1</div>
            <h2 style="font-size:1.4rem;">Você vs ${v.opponent.avatar} ${esc(v.opponent.nickname)}</h2>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-top:20px;">
            ${choicesButtons}
          </div>

          <div class="muted small" style="text-align:center; margin-top:14px;">
            ${v.myChoice ? '✅ Escolha feita! Aguardando oponente…' : 'Escolha rápido antes do fim do tempo!'}
          </div>`;

        el.querySelectorAll('[data-choice]').forEach((b) => {
          b.onclick = () => {
            api.send('choice', { choice: b.dataset.choice });
            api.sound('click');
          };
        });
      } else {
        // Reveal
        const duelsList = v.duelsSummary.map((d) => {
          if (d.isBye) {
            return `
              <div class="glass-panel" style="padding:12px; margin-bottom:10px;">
                ${d.p1.avatar} <b>${esc(d.p1.nickname)}</b> avançou direto para a próxima fase! ⏩
              </div>`;
          }
          return `
            <div class="glass-panel" style="padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:1.1rem;">
                ${d.p1.avatar} <b>${esc(d.p1.nickname)}</b> (${d.c1.emoji})
                <span style="margin:0 8px; color:var(--text-muted);">vs</span>
                (${d.c2.emoji}) ${d.p2.avatar} <b>${esc(d.p2.nickname)}</b>
              </div>
              <div style="font-weight:800; color:var(--acid-lime);">
                🏆 ${esc(d.winner.nickname)} venceu! (+5 pts)
                ${d.isTie ? '<br><span style="font-size:0.75rem; color:var(--solar-yellow);">Desempate súbito</span>' : ''}
              </div>
            </div>`;
        }).join('');

        el.innerHTML = `
          <div class="stage-card">
            <h2 style="font-size:1.4rem;">Resultado dos Duelos</h2>
          </div>
          <div style="margin-top:16px;">
            ${duelsList}
          </div>`;
      }
    }
  });
})();
