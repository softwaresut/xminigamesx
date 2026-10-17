// Minijogo: Quem Sou Eu? (Post-it na Testa Digital)
(function () {
  const startTurn = (ctx) => {
    const s = ctx.s;
    const unsolved = ctx.players.filter((p) => !s.solved.includes(p.id));
    if (!unsolved.length || s.turnsTaken >= ctx.players.length * 3) {
      ctx.end();
      return;
    }

    s.turnIdx = (s.turnIdx + 1) % ctx.players.length;
    s.activeId = ctx.players[s.turnIdx].id;

    // Se o jogador da vez já resolveu, pula para o próximo
    if (s.solved.includes(s.activeId)) {
      s.turnsTaken += 1;
      startTurn(ctx);
      return;
    }

    s.turnsTaken += 1;
    s.question = null;
    s.answers = {}; // voterId -> 'sim' | 'nao' | 'talvez'
    s.phase = 'ask';
    ctx.cue('pop');
    ctx.setTimer(ctx.settings.time || 25, () => nextPlayerTurn(ctx));
  };

  const nextPlayerTurn = (ctx) => {
    ctx.clearTimer();
    startTurn(ctx);
  };

  registerGame({
    id: 'quem-sou-eu',
    name: 'Quem Sou Eu?',
    emoji: '👤',
    cat: 'deducao',
    desc: 'Visão assimétrica: você vê o personagem de todos, menos o seu! Faça perguntas e deduza quem você é.',
    minPlayers: 2,

    start(ctx) {
      const s = ctx.s;
      const deck = U.shuffle(window.QUEM_SOU_EU_DATA || []);
      s.assignments = {}; // pid -> { name, hint }
      ctx.players.forEach((p, i) => {
        s.assignments[p.id] = deck[i % deck.length];
      });

      s.solved = [];
      s.strikes = {}; // pid -> count
      s.turnIdx = -1;
      s.turnsTaken = 0;
      startTurn(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;

      // 1. Jogador da vez faz pergunta
      if (type === 'ask' && pid === s.activeId && s.phase === 'ask') {
        const q = U.clip(data.text, 60);
        if (!q) return false;
        s.question = q;
        s.answers = {};
        s.phase = 'vote';
        ctx.cue('pop');
        ctx.setTimer(15, () => nextPlayerTurn(ctx));
      }

      // 2. Outros respondem Sim / Não / Talvez
      else if (type === 'vote_ans' && s.phase === 'vote' && pid !== s.activeId) {
        if (!['sim', 'nao', 'talvez'].includes(data.ans)) return false;
        s.answers[pid] = data.ans;
        ctx.cue('click');

        // Se todos os outros responderam
        const others = ctx.players.filter((p) => p.id !== s.activeId);
        if (others.every((p) => s.answers[p.id])) {
          ctx.clearTimer();
          ctx.after(3000, () => nextPlayerTurn(ctx));
        }
      }

      // 3. Chute do Personagem
      else if (type === 'guess' && pid === s.activeId) {
        const guess = U.clip(data.text, 40);
        const myChar = s.assignments[pid];
        if (!myChar) return false;

        if (U.fuzzy(guess, [myChar.name], 0.22)) {
          // Acertou!
          s.solved.push(pid);
          ctx.addScore(pid, 15);
          ctx.toast(`🎉 ${ctx.name(pid)} acertou o próprio personagem: ${myChar.name}!`);
          ctx.cue('success');
          nextPlayerTurn(ctx);
        } else {
          // Errou
          s.strikes[pid] = (s.strikes[pid] || 0) + 1;
          ctx.toast(`❌ Errou! (${s.strikes[pid]}/3 erros)`, pid);
          ctx.cue('buzzer');
          if (s.strikes[pid] >= 3) {
            s.solved.push(pid); // Fim de jogo para este jogador
          }
          nextPlayerTurn(ctx);
        }
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      const isActive = pid === s.activeId;

      // Monta os cards dos jogadores: o próprio jogador vê '???' se ainda não acertou!
      const cards = ctx.players.map((p) => {
        const isMe = p.id === pid;
        const char = s.assignments[p.id];
        const hasSolved = s.solved.includes(p.id);

        return {
          player: ctx.pub(p.id),
          character: (isMe && !hasSolved) ? '???' : (char ? char.name : '—'),
          hint: (isMe && !hasSolved) ? 'Descubra fazendo perguntas!' : (char ? char.hint : ''),
          isMe,
          solved: hasSolved,
          strikes: s.strikes[p.id] || 0
        };
      });

      return {
        phase: s.phase,
        label: `Vez de ${ctx.name(s.activeId)}`,
        activePlayer: ctx.pub(s.activeId),
        isActive,
        cards,
        question: s.question,
        answers: s.answers || {},
        myAnswer: s.answers ? s.answers[pid] : null,
        myStrikes: s.strikes[pid] || 0,
        solved: s.solved.includes(pid)
      };
    },

    render(el, v, api) {
      const esc = api.esc;

      const cardsHtml = v.cards.map((c) => `
        <div class="glass-panel" style="padding:14px; text-align:center; border:2px solid ${c.isMe ? 'var(--amber-glow)' : 'var(--bg-card-border)'};">
          <div style="font-size:2rem; margin-bottom:4px;">${c.player.avatar}</div>
          <div style="font-weight:800; font-size:1.05rem;">${esc(c.player.nickname)} ${c.isMe ? '(Você)' : ''}</div>
          <div style="background:rgba(0,0,0,0.3); border-radius:8px; padding:10px; margin:8px 0; border:1px solid ${c.isMe ? 'var(--amber-glow)' : 'rgba(255,255,255,0.1)'};">
            <div style="font-family:'Righteous', cursive; font-size:1.3rem; color:${c.isMe ? 'var(--solar-yellow)' : 'var(--cyan-glow)'};">
              ${esc(c.character)}
            </div>
            <div class="muted small" style="margin-top:4px;">${esc(c.hint)}</div>
          </div>
          <div class="muted small">${c.solved ? '✅ Descoberto!' : `Erros: ${c.strikes}/3`}</div>
        </div>`).join('');

      let actionArea = '';

      if (v.isActive) {
        if (v.phase === 'ask') {
          actionArea = `
            <div class="callout callout-yellow" style="margin:16px 0;">
              <b>Sua Vez!</b> Faça uma pergunta de SIM ou NÃO para o grupo, ou chute quem você é:
            </div>
            <div style="display:flex; flex-direction:column; gap:10px; max-width:500px; margin:0 auto;">
              <div class="answer-row">
                <input id="qsu-ask-input" class="input-field" placeholder="Ex: Eu sou uma pessoa real?" maxlength="60" autocomplete="off">
                <button class="btn-secondary" data-act="send-ask">Perguntar</button>
              </div>
              <div class="answer-row">
                <input id="qsu-guess-input" class="input-field" placeholder="Ex: Sou o Harry Potter?" maxlength="40" autocomplete="off">
                <button class="btn-primary" data-act="send-guess" style="background:var(--emerald-glow); border-color:#000;">Chutar Nome (+15)</button>
              </div>
            </div>`;
        } else {
          actionArea = `
            <div class="callout callout-cyan" style="margin:16px 0;">
              Sua pergunta: <b>"${esc(v.question)}"</b><br>
              Aguardando os outros jogadores responderem…
            </div>`;
        }
      } else {
        if (v.phase === 'vote' && v.question) {
          actionArea = `
            <div class="stage-card" style="margin:16px 0;">
              <div class="muted small">${v.activePlayer.avatar} <b>${esc(v.activePlayer.nickname)}</b> perguntou:</div>
              <h3 style="font-size:1.3rem; margin:8px 0;">"${esc(v.question)}"</h3>
              <div style="display:flex; justify-content:center; gap:10px; margin-top:12px;">
                <button class="${v.myAnswer === 'sim' ? 'btn-primary' : 'btn-secondary'}" data-ans="sim" style="padding:10px 24px; font-weight:800;">👍 SIM</button>
                <button class="${v.myAnswer === 'nao' ? 'btn-primary' : 'btn-secondary'}" data-ans="nao" style="padding:10px 24px; font-weight:800;">👎 NÃO</button>
                <button class="${v.myAnswer === 'talvez' ? 'btn-primary' : 'btn-secondary'}" data-ans="talvez" style="padding:10px 24px; font-weight:800;">🤷 TALVEZ</button>
              </div>
            </div>`;
        } else {
          actionArea = `
            <div class="turn-banner" style="margin:16px 0;">
              É a vez de ${v.activePlayer.avatar} <b>${esc(v.activePlayer.nickname)}</b> fazer uma pergunta ou tentar adivinhar!
            </div>`;
        }
      }

      el.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
          ${cardsHtml}
        </div>
        ${actionArea}`;

      if (v.isActive && v.phase === 'ask') {
        const btnAsk = el.querySelector('[data-act="send-ask"]');
        const inpAsk = el.querySelector('#qsu-ask-input');
        if (btnAsk && inpAsk) {
          btnAsk.onclick = () => {
            if (!inpAsk.value.trim()) return;
            api.send('ask', { text: inpAsk.value });
          };
        }

        const btnGuess = el.querySelector('[data-act="send-guess"]');
        const inpGuess = el.querySelector('#qsu-guess-input');
        if (btnGuess && inpGuess) {
          btnGuess.onclick = () => {
            if (!inpGuess.value.trim()) return;
            api.send('guess', { text: inpGuess.value });
          };
        }
      }

      if (!v.isActive && v.phase === 'vote') {
        el.querySelectorAll('[data-ans]').forEach((b) => {
          b.onclick = () => {
            api.send('vote_ans', { ans: b.dataset.ans });
            api.sound('click');
          };
        });
      }
    }
  });
})();
