// Minijogo: Sintonia (Conexão Mental / Pensar Igual)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
    s.round += 1;
    s.prompt = s.deck.pop();
    s.answers = {};
    s.phase = 'answer';
    ctx.cue('pop');
    ctx.setTimer(ctx.settings.time || 20, () => reveal(ctx));
  };

  const reveal = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'answer') return;
    ctx.clearTimer();
    s.phase = 'reveal';

    const normMap = new Map();
    const missed = [];

    ctx.players.forEach((p) => {
      const raw = (s.answers[p.id] || '').trim();
      const norm = U.tight(raw);
      if (!raw || !norm) {
        missed.push({ player: p, raw: '(Não respondeu)' });
      } else {
        if (!normMap.has(norm)) normMap.set(norm, []);
        normMap.get(norm).push({ player: p, raw });
      }
    });

    s.matches = [];
    s.solos = [];
    s.missed = missed;

    for (const [norm, group] of normMap.entries()) {
      if (group.length > 1) {
        const ptsPerPeer = (group.length - 1) * 3;
        group.forEach((item) => ctx.addScore(item.player.id, ptsPerPeer));
        s.matches.push({
          sample: group[0].raw,
          players: group.map((g) => g.player),
          pts: ptsPerPeer
        });
      } else {
        s.solos.push({ player: group[0].player, raw: group[0].raw });
      }
    }

    ctx.cue(s.matches.length ? 'success' : 'buzzer');
    ctx.after(6000, () => nextRound(ctx));
  };

  registerGame({
    id: 'sintonia',
    name: 'Sintonia',
    emoji: '🧠',
    cat: 'social',
    desc: 'O oposto de Não Responda: tente pensar e escrever EXATAMENTE igual aos seus amigos! +3 pts por par.',
    minPlayers: 2,

    start(ctx) {
      const s = ctx.s;
      s.deck = U.shuffle(window.SINTONIA_PROMPTS || []);
      s.total = Math.min(ctx.settings.rounds, s.deck.length);
      s.round = 0;
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'answer' || s.phase !== 'answer') return false;
      const ans = U.clip(data.text, 40);
      if (!ans) return false;
      s.answers[pid] = ans;
      ctx.cue('pop');
      if (Object.keys(s.answers).length >= ctx.players.length) {
        reveal(ctx);
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        prompt: s.prompt,
        answeredCount: Object.keys(s.answers).length,
        totalPlayers: ctx.players.length,
        myAnswer: s.answers[pid] || null,
        matches: s.matches || [],
        solos: s.solos || [],
        missed: s.missed || [],
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      const isAnswer = v.phase === 'answer';

      if (isAnswer) {
        const hasSent = !!v.myAnswer;
        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--magenta-glow); margin-bottom:6px;">Conexão Mental</div>
            <h2 style="font-size:1.5rem; line-height:1.4;">${esc(v.prompt)}</h2>
            <p class="muted small" style="margin-top:8px;">Pense no que a maioria dos seus amigos vai responder!</p>
          </div>

          <div style="max-width:500px; margin: 18px auto; text-align:center;">
            ${hasSent ? `
              <div class="callout callout-lime">
                Sua resposta: <b>"${esc(v.myAnswer)}"</b>. Torcendo para alguém ter escrito igual!
              </div>
            ` : `
              <div class="answer-row">
                <input id="sintonia-input" class="input-field" placeholder="Escreva o que todos vão pensar…" maxlength="40" autocomplete="off" autofocus>
                <button class="btn-primary" data-act="send">Enviar</button>
              </div>
            `}
            <div class="muted small" style="margin-top:10px;">
              Respostas enviadas: <b>${v.answeredCount}</b> de ${v.totalPlayers}
            </div>
          </div>`;

        if (!hasSent) {
          const inp = el.querySelector('#sintonia-input');
          const send = () => {
            if (!inp || !inp.value.trim()) return;
            api.send('answer', { text: inp.value });
            inp.value = '';
          };
          const btn = el.querySelector('[data-act="send"]');
          if (btn) btn.onclick = send;
          if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') send(); };
        }
      } else {
        // Reveal
        const matchesHtml = v.matches.length ? v.matches.map((m) => `
          <div class="result-group duplicates" style="border-left-color: var(--cyan-glow);">
            <div class="result-tag-badge" style="color: var(--cyan-glow);">
              ⚡ SINTONIA TOTAL: "${esc(m.sample)}" (+${m.pts} pts cada)
            </div>
            <div class="result-chips-list">
              ${m.players.map((p) => `<span class="chip">${p.avatar} ${esc(p.nickname)}</span>`).join('')}
            </div>
          </div>`).join('') : '<div class="muted small">Nenhuma conexão mental nesta rodada! Todos pensaram diferente.</div>';

        const solosHtml = v.solos.map((s) => `
          <span class="chip" style="opacity:0.75;">${s.player.avatar} <b>${esc(s.player.nickname)}</b>: "${esc(s.raw)}"</span>`).join('');

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--magenta-glow); margin-bottom:6px;">Resultado da Sintonia</div>
            <h2 style="font-size:1.35rem;">${esc(v.prompt)}</h2>
          </div>

          <div style="margin-top:16px;">
            ${matchesHtml}
          </div>

          ${v.solos.length ? `
            <div style="margin-top:16px;">
              <div class="section-title">Sem Sintonia (0 pts)</div>
              <div class="chip-list">${solosHtml}</div>
            </div>` : ''}`;
      }
    }
  });
})();
