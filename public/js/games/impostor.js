// Minijogo: Jogo do Impostor (Spyfall)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
    s.round += 1;
    s.locationObj = s.deck.pop();

    const ps = ctx.players;
    const spyIdx = Math.floor(Math.random() * ps.length);
    s.spyId = ps[spyIdx].id;

    s.votes = {};
    s.spyGuess = null;
    s.phase = 'discuss';
    ctx.cue('pop');
    ctx.setTimer(ctx.settings.time ? ctx.settings.time * 2 : 50, () => startVoting(ctx));
  };

  const startVoting = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'discuss') return;
    ctx.clearTimer();
    s.phase = 'vote';
    ctx.cue('buzzer');
    ctx.setTimer(25, () => resolveVotes(ctx));
  };

  const resolveVotes = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'vote') return;
    ctx.clearTimer();

    // Tally votes
    const counts = {};
    ctx.players.forEach((p) => { counts[p.id] = 0; });
    Object.values(s.votes).forEach((targetId) => {
      if (counts[targetId] !== undefined) counts[targetId] += 1;
    });

    let max = 0;
    let accused = null;
    Object.entries(counts).forEach(([pid, cnt]) => {
      if (cnt > max) { max = cnt; accused = pid; }
    });

    s.accused = accused;
    s.unmasked = accused === s.spyId;
    s.phase = 'guess';

    // Se o espião foi desmascarado, dá 15s para ele tentar adivinhar o local
    if (s.unmasked) {
      ctx.setTimer(15, () => revealFinal(ctx));
    } else {
      // Espião venceu direto
      ctx.addScore(s.spyId, 15);
      revealFinal(ctx);
    }
  };

  const revealFinal = (ctx) => {
    const s = ctx.s;
    ctx.clearTimer();
    s.phase = 'reveal';

    if (s.unmasked) {
      if (s.spyGuess === s.locationObj.location) {
        // Espião adivinhou o local e roubou a vitória!
        ctx.addScore(s.spyId, 15);
        s.outcome = 'spy_stole';
      } else {
        // Inocentes venceram!
        ctx.players.forEach((p) => {
          if (p.id !== s.spyId) ctx.addScore(p.id, 10);
        });
        s.outcome = 'innocents_win';
      }
    } else {
      s.outcome = 'spy_escaped';
    }

    ctx.cue('success');
    ctx.after(7000, () => nextRound(ctx));
  };

  registerGame({
    id: 'impostor',
    name: 'Jogo do Impostor',
    emoji: '🕵️',
    cat: 'deducao',
    desc: 'Um de vocês não sabe onde estão! Descubra quem é o impostor antes que ele adivinhe o local.',
    minPlayers: 3,

    start(ctx) {
      const s = ctx.s;
      s.deck = U.shuffle(window.IMPOSTOR_LOCATIONS || []);
      s.allLocations = (window.IMPOSTOR_LOCATIONS || []).map((l) => l.location);
      s.total = Math.min(ctx.settings.rounds, s.deck.length);
      s.round = 0;
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type === 'vote' && s.phase === 'vote') {
        if (!ctx.player(data.targetId)) return false;
        s.votes[pid] = data.targetId;
        ctx.cue('click');
        if (Object.keys(s.votes).length >= ctx.players.length) {
          resolveVotes(ctx);
        }
      } else if (type === 'guess_location' && s.phase === 'guess' && pid === s.spyId) {
        s.spyGuess = data.location;
        revealFinal(ctx);
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      const isSpy = pid === s.spyId;
      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        isSpy,
        location: isSpy ? null : s.locationObj.location,
        clue: isSpy ? null : s.locationObj.clue,
        allLocations: s.allLocations,
        players: ctx.players.map((p) => ctx.pub(p.id)),
        spy: s.phase === 'reveal' ? ctx.pub(s.spyId) : null,
        accused: s.accused ? ctx.pub(s.accused) : null,
        myVote: s.votes ? s.votes[pid] : null,
        votedCount: Object.keys(s.votes || {}).length,
        totalPlayers: ctx.players.length,
        unmasked: s.unmasked,
        outcome: s.outcome,
        realLocation: s.phase === 'reveal' ? s.locationObj.location : null,
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;

      if (v.phase === 'discuss') {
        el.innerHTML = `
          <div class="stage-card">
            ${v.isSpy ? `
              <div style="font-size:3.5rem; margin-bottom:10px;">🕵️</div>
              <h2 style="font-size:1.6rem; color:var(--punch-pink);">VOCÊ É O IMPOSTOR!</h2>
              <p class="muted small" style="margin-top:8px;">Você não sabe onde estamos! Preste atenção nas perguntas e finja normalidade.</p>
            ` : `
              <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--cyan-glow); margin-bottom:6px;">Local Secreto</div>
              <h2 style="font-size:1.8rem; color:var(--acid-lime);">${esc(v.location)}</h2>
              <p class="muted small" style="margin-top:6px;">Dica do ambiente: <i>"${esc(v.clue)}"</i></p>
            `}
          </div>

          <div class="callout callout-cyan" style="margin-top:16px;">
            🗣️ <b>Fase de Conversa:</b> Façam perguntas uns aos outros para descobrir quem está blefando sem entregar o local!
          </div>`;
      } else if (v.phase === 'vote') {
        const playerButtons = v.players.map((p) => {
          const isSelected = v.myVote === p.id;
          return `
            <button class="${isSelected ? 'btn-primary' : 'btn-secondary'}" data-vote="${p.id}" style="padding:16px; font-size:1.1rem; display:flex; align-items:center; gap:8px; justify-content:center;">
              <span style="font-size:1.5rem;">${p.avatar}</span>
              <b>${esc(p.nickname)}</b>
            </button>`;
        }).join('');

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--punch-pink); margin-bottom:6px;">Hora da Votação</div>
            <h2 style="font-size:1.4rem;">Quem é o Impostor?</h2>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:16px;">
            ${playerButtons}
          </div>

          <div class="muted small" style="text-align:center; margin-top:14px;">
            Votos: <b>${v.votedCount}</b> de ${v.totalPlayers}
          </div>`;

        el.querySelectorAll('[data-vote]').forEach((b) => {
          b.onclick = () => {
            api.send('vote', { targetId: b.dataset.vote });
            api.sound('click');
          };
        });
      } else if (v.phase === 'guess') {
        if (v.isSpy) {
          const locButtons = v.allLocations.map((loc) => `
            <button class="btn-secondary" data-loc="${esc(loc)}" style="padding:10px; font-size:0.95rem;">${esc(loc)}</button>`).join('');

          el.innerHTML = `
            <div class="stage-card">
              <h2 style="font-size:1.4rem; color:var(--solar-yellow);">Você foi descoberto!</h2>
              <p class="muted small">Mas ainda pode virar o jogo se acertar o local correto:</p>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px; margin-top:14px;">
              ${locButtons}
            </div>`;

          el.querySelectorAll('[data-loc]').forEach((b) => {
            b.onclick = () => {
              api.send('guess_location', { location: b.dataset.loc });
              api.sound('click');
            };
          });
        } else {
          el.innerHTML = `
            <div class="stage-card">
              <h2 style="font-size:1.4rem;">O Impostor foi desmascarado!</h2>
              <p class="muted small">Aguarde: o impostor tem 15s para tentar adivinhar o local secreto…</p>
            </div>`;
        }
      } else {
        // Reveal
        let title = '';
        if (v.outcome === 'innocents_win') title = '🏆 Os Inocentes Venceram! (+10 pts)';
        else if (v.outcome === 'spy_stole') title = '🕵️ O Impostor adivinhou o local e roubou a vitória! (+15 pts)';
        else title = '🕵️ O Impostor escapou impune! (+15 pts)';

        el.innerHTML = `
          <div class="stage-card">
            <h2 style="font-size:1.4rem;">${title}</h2>
            <div class="callout callout-cyan" style="margin-top:12px;">
              Local Secreto: <b>${esc(v.realLocation)}</b><br>
              O Impostor era: ${v.spy.avatar} <b>${esc(v.spy.nickname)}</b>
            </div>
          </div>`;
      }
    }
  });
})();
