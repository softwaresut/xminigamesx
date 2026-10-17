// Minijogo: Passa a Bomba (Batata Quente Explosiva)
(function () {
  const nextRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || s.alive.length <= 1) {
      if (s.alive.length === 1) {
        ctx.addScore(s.alive[0], 20);
      }
      ctx.end();
      return;
    }

    s.round += 1;
    const cats = window.BOMBA_CATEGORIES || ['Frutas', 'Animais', 'Cores'];
    s.category = cats[Math.floor(Math.random() * cats.length)];
    s.usedWords = new Set();
    s.holderIdx = Math.floor(Math.random() * s.alive.length);
    s.holder = s.alive[s.holderIdx];
    s.phase = 'ticking';

    // Pavio oculto entre 18 e 35 segundos
    const fuseSeconds = Math.floor(Math.random() * 18 + 18);
    s.exploded = false;
    ctx.cue('pop');

    // Atraso invisível para a explosão
    if (s.bombTimer) ctx.cancel(s.bombTimer);
    s.bombTimer = ctx.after(fuseSeconds * 1000, () => explode(ctx));
  };

  const explode = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'ticking') return;
    s.phase = 'boom';
    s.exploded = true;
    const victim = s.holder;
    s.victim = victim;

    // Elimina a vítima dos vivos
    s.alive = s.alive.filter((id) => id !== victim);

    // Sobreviventes ganham 5 pontos
    s.alive.forEach((id) => ctx.addScore(id, 5));

    ctx.cue('boom');
    ctx.after(5000, () => nextRound(ctx));
  };

  registerGame({
    id: 'bomba',
    name: 'Passa a Bomba',
    emoji: '💣',
    cat: 'reflexo',
    desc: 'O pavio está aceso e ninguém sabe quando vai explodir! Digite uma palavra válida para passar a bomba.',
    minPlayers: 2,

    start(ctx) {
      const s = ctx.s;
      s.alive = ctx.players.map((p) => p.id);
      s.total = Math.min(ctx.settings.rounds, s.alive.length);
      s.round = 0;
      nextRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (type !== 'pass' || s.phase !== 'ticking') return false;
      if (pid !== s.holder) return false;

      const word = U.clip(data.text, 30);
      const norm = U.tight(word);
      if (!norm || norm.length < 2) return false;
      if (s.usedWords.has(norm)) return false;

      s.usedWords.add(norm);

      // Passa a bomba para o próximo vivo
      const currIdx = s.alive.indexOf(s.holder);
      const nextIdx = (currIdx + 1) % s.alive.length;
      s.holder = s.alive[nextIdx];
      s.lastWord = word;
      s.lastPasser = pid;

      ctx.cue('click');
    },

    view(ctx, pid) {
      const s = ctx.s;
      return {
        phase: s.phase,
        label: `Rodada ${s.round} • ${s.alive.length} Jogadores Vivos`,
        category: s.category,
        holder: s.holder ? ctx.pub(s.holder) : null,
        isHolder: pid === s.holder,
        isAlive: s.alive.includes(pid),
        victim: s.victim ? ctx.pub(s.victim) : null,
        lastWord: s.lastWord,
        lastPasser: s.lastPasser ? ctx.pub(s.lastPasser) : null,
        alivePlayers: s.alive.map((id) => ctx.pub(id)),
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;

      if (v.phase === 'ticking') {
        const isHolder = v.isHolder;

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--rose-glow); margin-bottom:6px;">Categoria da Bomba</div>
            <h2 style="font-size:1.6rem; color:var(--solar-yellow);">${esc(v.category)}</h2>
          </div>

          <div style="text-align:center; margin:20px 0;">
            <div style="font-size:4.5rem; animation: pulse 0.7s infinite alternate;">💣</div>
            <div class="turn-banner" style="margin-top:10px; background:${isHolder ? 'var(--punch-pink)' : 'rgba(0,0,0,0.3)'};">
              ${isHolder ? '🔥 A BOMBA ESTÁ COM VOCÊ! DIGITE RÁPIDO! 🔥' : `A bomba está com ${v.holder.avatar} <b>${esc(v.holder.nickname)}</b>`}
            </div>
            ${v.lastWord ? `<div class="muted small" style="margin-top:8px;">Última palavra aceita: <b>"${esc(v.lastWord)}"</b> por ${v.lastPasser.avatar} ${esc(v.lastPasser.nickname)}</div>` : ''}
          </div>

          ${isHolder ? `
            <div class="answer-row" style="max-width:480px; margin:0 auto;">
              <input id="bomba-input" class="input-field" placeholder="Digite uma palavra de ${esc(v.category)}…" maxlength="30" autocomplete="off" autofocus>
              <button class="btn-primary" data-act="pass" style="background:var(--punch-pink); border-color:#000;">PASSA! 💣</button>
            </div>
          ` : `
            <div class="muted small" style="text-align:center;">
              Torça para a bomba não explodir antes de voltar para você!
            </div>
          `}`;

        if (isHolder) {
          const inp = el.querySelector('#bomba-input');
          const sendPass = () => {
            if (!inp || !inp.value.trim()) return;
            api.send('pass', { text: inp.value });
            inp.value = '';
          };
          const btn = el.querySelector('[data-act="pass"]');
          if (btn) btn.onclick = sendPass;
          if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') sendPass(); };
        }
      } else {
        // Boom
        el.innerHTML = `
          <div class="stage-card" style="border-color:var(--punch-pink);">
            <div style="font-size:4rem;">💥 BOOOOOOM! 💥</div>
            <h2 style="font-size:1.6rem; color:var(--punch-pink); margin-top:8px;">A bomba explodiu!</h2>
            <div class="callout callout-rose" style="margin-top:14px;">
              ${v.victim.avatar} <b>${esc(v.victim.nickname)}</b> segurou a bomba por tempo demais e foi eliminado da rodada! (+5 pts para os sobreviventes)
            </div>
          </div>`;
      }
    }
  });
})();
