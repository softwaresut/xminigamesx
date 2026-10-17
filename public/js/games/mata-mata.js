// Minijogo: Trivia Mata-Mata (Battle Royale)
(function () {
  const nextQuestion = (ctx) => {
    const s = ctx.s;
    if (!s.deck.length || s.round >= s.total || s.survivors.length <= 1) {
      endMataMata(ctx);
      return;
    }
    s.round += 1;
    s.q = s.deck.pop();
    s.answers = {}; // pid -> optIndex
    s.phase = 'question';
    ctx.cue('pop');
    ctx.setTimer(12, () => checkAnswers(ctx));
  };

  const checkAnswers = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'question') return;
    ctx.clearTimer();
    s.phase = 'reveal';

    const newSurvivors = [];
    const eliminatedThisRound = [];

    s.survivors.forEach((pid) => {
      const ans = s.answers[pid];
      if (ans === s.q.correct) {
        ctx.addScore(pid, 10);
        newSurvivors.push(pid);
      } else {
        eliminatedThisRound.push(pid);
      }
    });

    s.survivors = newSurvivors;
    s.eliminatedNow = eliminatedThisRound;

    if (newSurvivors.length === 1) {
      ctx.addScore(newSurvivors[0], 25);
    }

    ctx.cue(newSurvivors.length ? 'success' : 'buzzer');
    ctx.after(4500, () => nextQuestion(ctx));
  };

  const endMataMata = (ctx) => {
    ctx.clearTimer();
    ctx.end();
  };

  registerGame({
    id: 'mata-mata',
    name: 'Trivia Mata-Mata',
    emoji: '⚔️',
    cat: 'quiz',
    desc: 'Sobrevivência pura! Responda à pergunta de 4 opções em 12s. Errou, está eliminado!',
    minPlayers: 1,

    start(ctx) {
      const s = ctx.s;
      s.deck = U.shuffle(window.TRIVIA_MATA_MATA_DATA || []);
      s.total = Math.min(ctx.settings.rounds * 2, s.deck.length);
      s.round = 0;
      s.survivors = ctx.players.map((p) => p.id);
      nextQuestion(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'answer' || s.phase !== 'question') return false;
      if (!s.survivors.includes(pid)) return false;
      if (s.answers[pid] !== undefined) return false;
      const opt = parseInt(data.opt, 10);
      if (isNaN(opt) || opt < 0 || opt > 3) return false;
      s.answers[pid] = opt;
      ctx.cue('click');

      // Se todos os sobreviventes já responderam, avança
      if (s.survivors.every((id) => s.answers[id] !== undefined)) {
        checkAnswers(ctx);
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      const isAlive = s.survivors.includes(pid);
      const myAnswer = s.answers ? s.answers[pid] : undefined;
      return {
        phase: s.phase,
        label: `Pergunta ${s.round} • ${s.survivors.length} Sobrevivente(s)`,
        q: s.q ? s.q.q : '',
        opts: s.q ? s.q.opts : [],
        correct: s.phase === 'reveal' ? s.q.correct : null,
        isAlive,
        myAnswer,
        survivors: s.survivors.map((id) => ctx.pub(id)),
        eliminatedNow: (s.eliminatedNow || []).map((id) => ctx.pub(id)),
        answeredCount: Object.keys(s.answers || {}).length,
        totalSurvivors: s.survivors.length,
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      const isAlive = v.isAlive;
      const isQuestion = v.phase === 'question';

      const survivorTags = v.survivors.map((p) => `
        <span class="chip" style="background: rgba(0, 240, 255, 0.15); border-color: var(--cyan-glow);">
          ${esc(p.avatar)} <b>${esc(p.nickname)}</b>
        </span>`).join('');

      let statusMsg = '';
      if (!isAlive) {
        statusMsg = `<div class="callout callout-rose">💀 Você foi eliminado! Acompanhe os outros duelarem como espectador.</div>`;
      } else if (isQuestion && v.myAnswer !== undefined) {
        statusMsg = `<div class="callout callout-lime">✅ Resposta enviada! Aguardando o encerramento do timer…</div>`;
      }

      const optionsHtml = v.opts.map((opt, idx) => {
        let cls = 'btn-secondary';
        let disabled = !isAlive || !isQuestion || v.myAnswer !== undefined ? 'disabled' : '';
        if (v.phase === 'reveal') {
          if (idx === v.correct) cls = 'btn-primary' + ' correct-glow';
          else if (v.myAnswer === idx) cls = 'btn-danger';
        } else if (v.myAnswer === idx) {
          cls = 'btn-primary';
        }
        return `
          <button class="${cls}" data-opt="${idx}" ${disabled} style="padding:16px; font-size:1.05rem; font-weight:700; text-align:left;">
            <span style="opacity:0.6; margin-right:8px;">${['A', 'B', 'C', 'D'][idx]}.</span> ${esc(opt)}
          </button>`;
      }).join('');

      el.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div class="muted small">Sobreviventes na arena:</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">${survivorTags}</div>
        </div>

        <div class="stage-card">
          <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--rose-glow); margin-bottom:6px;">Pergunta Mata-Mata</div>
          <h2 style="font-size:1.35rem; line-height:1.4;">${esc(v.q)}</h2>
        </div>

        ${statusMsg}

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px;">
          ${optionsHtml}
        </div>`;

      if (isAlive && isQuestion && v.myAnswer === undefined) {
        el.querySelectorAll('[data-opt]').forEach((b) => {
          b.onclick = () => {
            api.send('answer', { opt: b.dataset.opt });
            api.sound('click');
          };
        });
      }
    }
  });
})();
