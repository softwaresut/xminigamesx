// Minijogo: Stop Express (Adedonha Digital)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total) { ctx.end(); return; }
    s.round += 1;

    const data = window.STOP_EXPRESS_DATA || { letters: ['A', 'B', 'C'], categoriesPool: [['Nome', 'Animal', 'Fruta']] };
    s.letter = data.letters[Math.floor(Math.random() * data.letters.length)];
    s.categories = U.shuffle(data.categoriesPool)[0];
    s.answers = {}; // pid -> [ans1, ans2, ans3]
    s.stopper = null;
    s.phase = 'write';
    ctx.cue('pop');
    ctx.setTimer(ctx.settings.time ? ctx.settings.time * 2 : 45, () => stopRound(ctx, null));
  };

  const stopRound = (ctx, pid) => {
    const s = ctx.s;
    if (s.phase !== 'write') return;
    ctx.clearTimer();
    s.stopper = pid;
    s.phase = 'reveal';

    // Apuração dos pontos:
    // Para cada categoria:
    // Se a palavra começa com a letra certa:
    // única -> 10 pts, repetida -> 5 pts, inválida/vazia -> 0 pts
    s.categoryResults = s.categories.map((cat, catIdx) => {
      const normMap = new Map();
      const catScores = {};

      ctx.players.forEach((p) => {
        const pAns = (s.answers[p.id] || [])[catIdx] || '';
        const trimmed = pAns.trim();
        const norm = U.tight(trimmed);
        const startsWithLetter = norm.startsWith(s.letter.toLowerCase());

        if (trimmed && startsWithLetter) {
          if (!normMap.has(norm)) normMap.set(norm, []);
          normMap.get(norm).push(p.id);
        }
      });

      normMap.forEach((pids, norm) => {
        const pts = pids.length === 1 ? 10 : 5;
        pids.forEach((pid) => {
          catScores[pid] = pts;
          ctx.addScore(pid, pts);
        });
      });

      return {
        category: cat,
        scores: catScores
      };
    });

    ctx.cue('buzzer');
    ctx.after(8000, () => nextRound(ctx));
  };

  registerGame({
    id: 'stop',
    name: 'Stop Express',
    emoji: '🛑',
    cat: 'social',
    desc: '1 Letra e 3 Categorias! Preencha rápido e bata no STOP para travar todos os outros jogadores.',
    minPlayers: 2,

    start(ctx) {
      const s = ctx.s;
      s.total = Math.min(ctx.settings.rounds, 5);
      s.round = 0;
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (s.phase !== 'write') return false;

      if (type === 'update') {
        s.answers[pid] = [
          U.clip(data.c0, 30),
          U.clip(data.c1, 30),
          U.clip(data.c2, 30)
        ];
      } else if (type === 'stop') {
        if (data.c0) {
          s.answers[pid] = [
            U.clip(data.c0, 30),
            U.clip(data.c1, 30),
            U.clip(data.c2, 30)
          ];
        }
        stopRound(ctx, pid);
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      const myAnswers = s.answers[pid] || ['', '', ''];
      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        letter: s.letter,
        categories: s.categories,
        stopper: s.stopper ? ctx.pub(s.stopper) : null,
        myAnswers,
        allAnswers: s.phase === 'reveal' ? ctx.players.map((p) => ({
          player: ctx.pub(p.id),
          answers: s.answers[p.id] || []
        })) : [],
        categoryResults: s.categoryResults || [],
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      const isWrite = v.phase === 'write';

      if (isWrite) {
        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--rose-glow); margin-bottom:6px;">Letra Sorteada</div>
            <div style="font-family:'Righteous', cursive; font-size:4rem; color:var(--solar-yellow); line-height:1;">${esc(v.letter)}</div>
          </div>

          <div style="max-width:500px; margin:20px auto;">
            ${v.categories.map((cat, idx) => `
              <div class="input-group" style="margin-bottom:12px; text-align:left;">
                <label style="font-weight:700; color:var(--cyan-glow);">${esc(cat)} com a letra ${esc(v.letter)}:</label>
                <input id="stop-cat-${idx}" class="input-field" placeholder="Ex: algo com ${esc(v.letter)}…" maxlength="30" autocomplete="off" value="${esc(v.myAnswers[idx] || '')}">
              </div>
            `).join('')}

            <button class="btn-primary" id="btn-slam-stop" style="width:100%; padding:16px; font-size:1.3rem; background:var(--punch-pink); border-color:#000; margin-top:10px;">
              🛑 STOP! PAROU TUDO!
            </button>
          </div>`;

        const inputs = [el.querySelector('#stop-cat-0'), el.querySelector('#stop-cat-1'), el.querySelector('#stop-cat-2')];
        const pushUpdate = () => {
          api.send('update', {
            c0: inputs[0] ? inputs[0].value : '',
            c1: inputs[1] ? inputs[1].value : '',
            c2: inputs[2] ? inputs[2].value : ''
          });
        };

        inputs.forEach((inp) => {
          if (inp) inp.oninput = pushUpdate;
        });

        const btnStop = el.querySelector('#btn-slam-stop');
        if (btnStop) {
          btnStop.onclick = () => {
            api.send('stop', {
              c0: inputs[0] ? inputs[0].value : '',
              c1: inputs[1] ? inputs[1].value : '',
              c2: inputs[2] ? inputs[2].value : ''
            });
            api.sound('buzzer');
          };
        }
      } else {
        // Reveal
        const stopperBanner = v.stopper
          ? `<div class="turn-banner" style="background:var(--punch-pink); color:#fff;">🛑 <b>${esc(v.stopper.nickname)}</b> bateu no STOP!</div>`
          : `<div class="turn-banner">⏳ O tempo esgotou!</div>`;

        const answersList = v.allAnswers.map((row) => {
          const catPills = v.categories.map((cat, idx) => {
            const word = (row.answers || [])[idx] || '—';
            const catRes = v.categoryResults[idx];
            const pts = (catRes && catRes.scores[row.player.id]) || 0;
            return `
              <div style="flex:1; min-width:120px; background:rgba(0,0,0,0.25); padding:8px 10px; border-radius:6px; border:1px solid var(--bg-card-border);">
                <div class="muted small">${esc(cat)}</div>
                <div style="font-weight:700; margin:2px 0;">${esc(word)}</div>
                <div style="font-size:0.8rem; font-weight:800; color:${pts === 10 ? 'var(--acid-lime)' : pts === 5 ? 'var(--solar-yellow)' : 'var(--punch-pink)'};">
                  ${pts > 0 ? `+${pts} pts` : '0 pts'}
                </div>
              </div>`;
          }).join('');

          return `
            <div class="glass-panel" style="margin-bottom:10px; padding:12px;">
              <div style="font-weight:800; margin-bottom:8px;">${row.player.avatar} ${esc(row.player.nickname)}</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${catPills}
              </div>
            </div>`;
        }).join('');

        el.innerHTML = `
          ${stopperBanner}
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--solar-yellow); margin-bottom:6px;">Letra: ${esc(v.letter)}</div>
            <h2 style="font-size:1.3rem;">Resultado da Adedonha</h2>
            <div class="muted small" style="margin-top:6px;">+10 pts por palavra única válida • +5 pts se outro jogador colocou igual</div>
          </div>

          <div style="margin-top:16px;">
            ${answersList}
          </div>`;
      }
    }
  });
})();
