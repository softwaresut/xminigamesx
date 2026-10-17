// Minijogo: Não Responda Igual (O Diferentão)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
    s.round += 1;
    s.question = s.deck.pop();
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
        missed.push({ player: p, raw: '(Dormiu no ponto)' });
      } else {
        if (!normMap.has(norm)) normMap.set(norm, []);
        normMap.get(norm).push({ player: p, raw });
      }
    });

    s.uniques = [];
    s.clones = [];
    s.missed = missed;

    for (const [norm, group] of normMap.entries()) {
      if (group.length === 1) {
        const item = group[0];
        ctx.addScore(item.player.id, 10);
        s.uniques.push({ player: item.player, raw: item.raw, pts: 10 });
      } else {
        group.forEach((item) => ctx.addScore(item.player.id, 5));
        s.clones.push({
          sample: group[0].raw,
          players: group.map((g) => g.player),
          pts: 5
        });
      }
    }

    ctx.cue('success');
    ctx.after(6000, () => nextRound(ctx));
  };

  registerGame({
    id: 'nao-responda',
    name: 'Não Responda Igual',
    emoji: '💡',
    cat: 'social',
    desc: 'Resposta única vale 10 pts, respostas repetidas valem 5 pts. Não pense igual aos outros!',
    minPlayers: 2,

    start(ctx) {
      const questions = window.NAO_RESPONDA_QUESTIONS || ['Diga uma fruta vermelha', 'Algo que tem na praia'];
      ctx.s.deck = U.shuffle(questions);
      ctx.s.total = Math.min(ctx.settings.rounds, ctx.s.deck.length);
      ctx.s.round = 0;
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
      const myAnswer = s.answers[pid] || null;
      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        question: s.question,
        answeredCount: Object.keys(s.answers).length,
        totalPlayers: ctx.players.length,
        myAnswer,
        uniques: s.uniques || [],
        clones: s.clones || [],
        missed: s.missed || [],
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      let body = '';

      if (v.phase === 'answer') {
        if (v.myAnswer) {
          body = `
            <div class="callout callout-lime">
              Enviado: <b>"${esc(v.myAnswer)}"</b>. Torcendo para ninguém ter respondido igual!
            </div>
            <div class="muted small" style="margin-top:10px">
              Respostas enviadas: ${v.answeredCount} de ${v.totalPlayers}
            </div>`;
        } else {
          body = `
            <div class="answer-row">
              <input id="nr-input-${v.round}" class="input-field" placeholder="Sua resposta (1 palavra ou termo curto)…" maxlength="40" autocomplete="off" autofocus>
              <button class="btn-primary" data-act="send">Enviar ➔</button>
            </div>
            <div class="muted small" style="margin-top:10px">
              Respostas enviadas: ${v.answeredCount} de ${v.totalPlayers}
            </div>`;
        }
      } else {
        // Revelação com os selos físicos solicitados pelo usuário
        const uniquesHtml = v.uniques.length
          ? v.uniques.map((u) => `
              <div class="stamp-chip stamp-unique">
                <span class="stamp-badge">🌟 DIFERENTÃO! +10 PTS</span>
                <span>${u.player.avatar} <b>${esc(u.player.nickname)}</b>: "${esc(u.raw)}"</span>
              </div>`).join('')
          : '<div class="muted small">Ninguém pensou diferente nesta rodada!</div>';

        const clonesHtml = v.clones.length
          ? v.clones.map((c) => `
              <div class="stamp-chip stamp-clone">
                <span class="stamp-badge">👥 CLONES! +5 PTS</span>
                <span>"${esc(c.sample)}" <small>(${c.players.map((p) => esc(p.nickname)).join(' e ')})</small></span>
              </div>`).join('')
          : '<div class="muted small">Nenhuma resposta repetida!</div>';

        const missedHtml = v.missed.length
          ? v.missed.map((m) => `
              <div class="stamp-chip stamp-missed">
                <span class="stamp-badge">💤 DORMIU NO PONTO! 0 PTS</span>
                <span>${m.player.avatar} <b>${esc(m.player.nickname)}</b></span>
              </div>`).join('')
          : '<div class="muted small">Todos responderam a tempo!</div>';

        body = `
          <div class="results-stamp-grid">
            <div class="stamp-col">${uniquesHtml}</div>
            <div class="stamp-col">${clonesHtml}</div>
            <div class="stamp-col">${missedHtml}</div>
          </div>`;
      }

      el.innerHTML = `
        <div class="stage-card">
          <div class="stage-badge">PERGUNTA DA RODADA</div>
          <h2 class="stage-question">${esc(v.question)}</h2>
        </div>
        <div class="stage-body">${body}</div>`;

      const input = el.querySelector(`#nr-input-${v.round}`);
      const btn = el.querySelector('[data-act="send"]');
      const submit = () => {
        if (!input || !input.value.trim()) return;
        api.send('answer', { text: input.value });
      };
      if (btn) btn.onclick = submit;
      if (input) input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    }
  });
})();
