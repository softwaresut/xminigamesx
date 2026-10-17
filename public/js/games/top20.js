// Minijogo: Top 20 (O Mestre das Listas)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
    s.round += 1;
    s.themeObj = s.deck.pop();
    // 20 itens normalizados para checagem rápida
    s.items = s.themeObj.items.map((item, idx) => ({
      index: idx + 1,
      name: item,
      norm: U.tight(item),
      foundBy: null
    }));
    s.foundCount = 0;
    s.phase = 'play';
    ctx.cue('pop');
    ctx.setTimer(60, () => revealAll(ctx));
  };

  const revealAll = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'play') return;
    ctx.clearTimer();
    s.phase = 'reveal';
    ctx.cue('success');
    ctx.after(6000, () => nextRound(ctx));
  };

  registerGame({
    id: 'top20',
    name: 'Top 20 Listas',
    emoji: '📋',
    cat: 'quiz',
    desc: 'Descubra o máximo de itens da lista de 20 em 60 segundos! +1 ponto por acerto.',
    minPlayers: 1,

    start(ctx) {
      const s = ctx.s;
      s.deck = U.shuffle(window.TOP20_DATA || []);
      s.total = Math.min(ctx.settings.rounds, s.deck.length);
      s.round = 0;
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'guess' || s.phase !== 'play') return false;
      const raw = U.clip(data.text, 40);
      if (!raw) return false;
      const normGuess = U.tight(raw);
      if (!normGuess) return false;

      // Procura se bate com algum item ainda não encontrado
      const target = s.items.find((it) => !it.foundBy && U.fuzzy(raw, [it.name], 0.22));
      if (target) {
        const p = ctx.player(pid);
        target.foundBy = { id: pid, nickname: p.nickname, avatar: p.avatar };
        s.foundCount += 1;
        ctx.addScore(pid, 1);
        ctx.cue('pop');
        if (s.foundCount >= s.items.length) {
          revealAll(ctx);
        }
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        theme: s.themeObj ? s.themeObj.theme : '',
        foundCount: s.foundCount,
        totalItems: s.items ? s.items.length : 20,
        items: (s.items || []).map((it) => ({
          index: it.index,
          revealed: s.phase === 'reveal' || !!it.foundBy,
          name: (s.phase === 'reveal' || it.foundBy) ? it.name : `Item #${it.index}`,
          foundBy: it.foundBy
        })),
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;
      const isPlay = v.phase === 'play';

      const itemsHtml = v.items.map((it) => {
        if (it.foundBy) {
          return `
            <div class="top20-chip found">
              <span class="idx">#${it.index}</span>
              <span class="name">${esc(it.name)}</span>
              <span class="finder" title="${esc(it.foundBy.nickname)}">${esc(it.foundBy.avatar)}</span>
            </div>`;
        }
        if (v.phase === 'reveal') {
          return `
            <div class="top20-chip missed">
              <span class="idx">#${it.index}</span>
              <span class="name">${esc(it.name)}</span>
            </div>`;
        }
        return `
          <div class="top20-chip hidden">
            <span class="idx">#${it.index}</span>
            <span class="dots">••••••••</span>
          </div>`;
      }).join('');

      el.innerHTML = `
        <div class="stage-card">
          <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--cyan-glow); margin-bottom:6px;">Tema da Lista</div>
          <h2 style="font-size:1.4rem; margin-bottom:8px;">${esc(v.theme)}</h2>
          <div class="muted small">Descobriram <b>${v.foundCount}</b> de ${v.totalItems} itens</div>
        </div>

        ${isPlay ? `
          <div class="answer-row" style="max-width:500px; margin: 14px auto;">
            <input id="top20-input" class="input-field" placeholder="Digite um item da lista…" maxlength="40" autocomplete="off" autofocus>
            <button class="btn-primary" data-act="send">Enviar</button>
          </div>
        ` : `
          <div class="callout callout-cyan" style="margin: 14px 0;">Tempo esgotado! Veja todos os 20 itens revelados:</div>
        `}

        <div class="top20-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:8px; margin-top:14px;">
          ${itemsHtml}
        </div>`;

      if (isPlay) {
        const inp = el.querySelector('#top20-input');
        const send = () => {
          if (!inp || !inp.value.trim()) return;
          api.send('guess', { text: inp.value });
          inp.value = '';
          if (window.innerWidth > 700) inp.focus();
        };
        const btn = el.querySelector('[data-act="send"]');
        if (btn) btn.onclick = send;
        if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') send(); };
      }
    }
  });
})();
