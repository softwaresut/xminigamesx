// Minijogo: Memória de Emoji (Simon Says Sequência)
(function () {
  const EMOJI_POOL = ['🐶', '🍕', '🚀', '💎', '🔥', '⚡'];

  const nextSequenceLevel = (ctx) => {
    const s = ctx.s;
    if (s.level >= 6 || s.survivors.length <= 1) {
      if (s.survivors.length === 1) {
        ctx.addScore(s.survivors[0], 15);
      }
      ctx.end();
      return;
    }

    s.level += 1;
    const length = s.level + 2; // Level 1 = 3 emojis, Level 2 = 4 emojis, etc.
    s.sequence = [];
    for (let i = 0; i < length; i++) {
      s.sequence.push(EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]);
    }

    s.inputs = {}; // pid -> [emojis clicados]
    s.finished = new Set();
    s.phase = 'watch';
    ctx.cue('pop');

    // 3.5 segundos para memorizar
    ctx.setTimer(4, () => startRecall(ctx));
  };

  const startRecall = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'watch') return;
    s.phase = 'recall';
    ctx.cue('buzzer');
    ctx.setTimer(10, () => checkRecall(ctx));
  };

  const checkRecall = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'recall') return;
    ctx.clearTimer();
    s.phase = 'reveal';

    const nextSurvivors = [];
    s.survivors.forEach((pid) => {
      const userSeq = s.inputs[pid] || [];
      const match = userSeq.length === s.sequence.length && userSeq.every((em, i) => em === s.sequence[i]);
      if (match) {
        ctx.addScore(pid, 5);
        nextSurvivors.push(pid);
      }
    });

    s.survivors = nextSurvivors;
    ctx.cue(nextSurvivors.length ? 'success' : 'buzzer');
    ctx.after(4500, () => nextSequenceLevel(ctx));
  };

  registerGame({
    id: 'memoria-emoji',
    name: 'Memória de Emoji',
    emoji: '🧠',
    cat: 'reflexo',
    desc: 'Memorize a sequência rápida de emojis e repita na mesma ordem! Errou, está fora.',
    minPlayers: 1,

    start(ctx) {
      const s = ctx.s;
      s.survivors = ctx.players.map((p) => p.id);
      s.level = 0;
      nextSequenceLevel(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'click_emoji' || s.phase !== 'recall') return false;
      if (!s.survivors.includes(pid) || s.finished.has(pid)) return false;

      if (!s.inputs[pid]) s.inputs[pid] = [];
      s.inputs[pid].push(data.emoji);
      ctx.cue('click');

      // Se atingiu o tamanho da sequência, finaliza a tentativa
      if (s.inputs[pid].length >= s.sequence.length) {
        s.finished.add(pid);
      }

      // Se todos os sobreviventes terminaram
      if (s.survivors.every((id) => s.finished.has(id))) {
        checkRecall(ctx);
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      const isAlive = s.survivors.includes(pid);
      return {
        phase: s.phase,
        label: `Nível ${s.level} • ${s.sequence.length} Emojis`,
        sequence: s.sequence,
        pool: EMOJI_POOL,
        myInput: s.inputs[pid] || [],
        isAlive,
        isFinished: s.finished ? s.finished.has(pid) : false,
        survivors: s.survivors.map((id) => ctx.pub(id)),
        level: s.level
      };
    },

    render(el, v, api) {
      const esc = api.esc;

      if (v.phase === 'watch') {
        const sequenceHtml = v.sequence.map((em) => `
          <span style="font-size:3.5rem; padding:8px 12px; background:rgba(0,0,0,0.3); border-radius:12px; border:2px solid var(--cyan-glow);">${em}</span>`).join(' ');

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--cyan-glow); margin-bottom:6px;">Memorize a Sequência</div>
            <h2 style="font-size:1.4rem;">Preste atenção!</h2>
          </div>

          <div style="display:flex; justify-content:center; gap:12px; margin:24px 0; flex-wrap:wrap;">
            ${sequenceHtml}
          </div>

          <div class="muted small" style="text-align:center;">
            A sequência vai sumir em instantes…
          </div>`;
      } else if (v.phase === 'recall') {
        if (!v.isAlive) {
          el.innerHTML = `
            <div class="stage-card">
              <h2 style="font-size:1.3rem;">Você foi eliminado!</h2>
              <p class="muted small">Aguarde os outros competidores terminarem.</p>
            </div>`;
          return;
        }

        const inputSlots = [];
        for (let i = 0; i < v.sequence.length; i++) {
          const em = v.myInput[i];
          inputSlots.push(`
            <span style="width:48px; height:48px; font-size:1.8rem; display:inline-flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.4); border-radius:8px; border:2px dashed ${em ? 'var(--acid-lime)' : 'var(--bg-card-border)'};">
              ${em || ''}
            </span>`);
        }

        const poolButtons = v.pool.map((em) => `
          <button class="btn-secondary emoji-recall-btn" data-emoji="${em}" ${v.isFinished ? 'disabled' : ''} style="font-size:2.4rem; padding:16px;">
            ${em}
          </button>`).join('');

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--solar-yellow); margin-bottom:6px;">Sua Vez</div>
            <h2 style="font-size:1.3rem;">Repita a sequência na ordem certa:</h2>
          </div>

          <div style="display:flex; justify-content:center; gap:8px; margin:16px 0;">
            ${inputSlots.join('')}
          </div>

          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; max-width:320px; margin:0 auto;">
            ${poolButtons}
          </div>

          <div class="muted small" style="text-align:center; margin-top:14px;">
            ${v.isFinished ? '✅ Sequência preenchida! Aguardando resultado…' : 'Clique nos emojis na ordem!'}
          </div>`;

        if (!v.isFinished) {
          el.querySelectorAll('.emoji-recall-btn').forEach((b) => {
            b.onclick = () => {
              api.send('click_emoji', { emoji: b.dataset.emoji });
            };
          });
        }
      } else {
        // Reveal
        const correctSequence = v.sequence.join(' ');
        el.innerHTML = `
          <div class="stage-card">
            <h2 style="font-size:1.4rem;">Fim da Rodada de Memória</h2>
            <div class="callout callout-cyan" style="margin-top:12px;">
              Sequência Correta: <div style="font-size:2.5rem; margin-top:6px;">${correctSequence}</div>
            </div>
            <div class="muted small" style="margin-top:10px;">
              Sobreviveram: ${v.survivors.map((p) => `${p.avatar} <b>${esc(p.nickname)}</b>`).join(', ') || 'Ninguém'}
            </div>
          </div>`;
      }
    }
  });
})();
