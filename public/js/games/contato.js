// Minijogo: O Jogo do Contato
(function () {
  const nextWordRound = (ctx) => {
    const s = ctx.s;
    if (s.round >= s.total || !s.deck.length) { ctx.end(); return; }
    s.round += 1;
    s.secretWord = s.deck.pop().toUpperCase();
    s.revealedLen = 1; // Começa com 1 letra revelada
    s.activeChallenge = null;
    s.phase = 'play';
    ctx.cue('pop');
    ctx.setTimer(75, () => timeoutRound(ctx));
  };

  const timeoutRound = (ctx) => {
    const s = ctx.s;
    if (s.phase !== 'play') return;
    ctx.clearTimer();
    s.phase = 'reveal';
    ctx.cue('buzzer');
    ctx.after(6000, () => nextWordRound(ctx));
  };

  registerGame({
    id: 'contato',
    name: 'Jogo do Contato',
    emoji: '🤝',
    cat: 'deducao',
    desc: 'Crie dicas com as letras reveladas. Se outro jogador fizer "Contato" com você, a próxima letra é liberada!',
    minPlayers: 2,

    start(ctx) {
      const s = ctx.s;
      s.deck = U.shuffle(window.CONTATO_WORDS || ['CHOCOLATE', 'COMPUTADOR', 'ELEFANTE']);
      s.total = Math.min(ctx.settings.rounds, s.deck.length);
      s.round = 0;
      nextWordRound(ctx);
    },

    action(ctx, pid, type, data) {
      const s = ctx.s;
      if (s.phase !== 'play') return false;

      // 1. Chute da Palavra Secreta Completa
      if (type === 'guess_word') {
        const guess = U.tight(data.text);
        if (guess === U.tight(s.secretWord)) {
          ctx.clearTimer();
          s.phase = 'reveal';
          s.winner = ctx.pub(pid);
          ctx.addScore(pid, 20);
          ctx.cue('success');
          ctx.after(6000, () => nextWordRound(ctx));
        } else {
          ctx.toast(`"${data.text}" não é a palavra secreta!`, pid);
        }
      }

      // 2. Lançar Desafio de Contato
      else if (type === 'create_clue') {
        const clue = U.clip(data.clue, 50);
        const word = U.tight(data.word);
        const prefix = s.secretWord.slice(0, s.revealedLen).toLowerCase();

        if (!clue || !word || !word.startsWith(prefix)) {
          ctx.toast(`A palavra da dica deve começar com "${prefix.toUpperCase()}"!`, pid);
          return false;
        }

        s.activeChallenge = {
          creatorId: pid,
          clue,
          targetWord: word,
          expiresAt: Date.now() + 15000
        };
        ctx.cue('pop');

        // Expira o desafio após 15s
        if (s.challengeTimer) ctx.cancel(s.challengeTimer);
        s.challengeTimer = ctx.after(15000, () => {
          if (s.activeChallenge) {
            s.activeChallenge = null;
            ctx.sync();
          }
        });
      }

      // 3. Responder ao Desafio de Contato
      else if (type === 'answer_clue' && s.activeChallenge) {
        if (pid === s.activeChallenge.creatorId) return false;
        const guess = U.tight(data.text);

        if (guess === s.activeChallenge.targetWord) {
          // BINGO! Contato estabelecido!
          if (s.challengeTimer) ctx.cancel(s.challengeTimer);
          const cId = s.activeChallenge.creatorId;
          s.activeChallenge = null;

          ctx.addScore(cId, 5);
          ctx.addScore(pid, 5);

          // Revela próxima letra da palavra secreta
          if (s.revealedLen < s.secretWord.length) {
            s.revealedLen += 1;
          }

          ctx.toast(`🤝 CONTATO CONFIRMADO! Próxima letra revelada!`);
          ctx.cue('success');

          // Se revelou a palavra inteira
          if (s.revealedLen >= s.secretWord.length) {
            ctx.clearTimer();
            s.phase = 'reveal';
            ctx.after(6000, () => nextWordRound(ctx));
          }
        } else {
          ctx.toast(`Contato errado!`, pid);
        }
      }
    },

    view(ctx, pid) {
      const s = ctx.s;
      const mask = s.secretWord
        ? s.secretWord.split('').map((char, i) => (i < s.revealedLen ? char : '_')).join(' ')
        : '';

      return {
        phase: s.phase,
        label: `Rodada ${s.round} de ${s.total}`,
        mask,
        prefix: s.secretWord ? s.secretWord.slice(0, s.revealedLen) : '',
        activeChallenge: s.activeChallenge ? {
          creator: ctx.pub(s.activeChallenge.creatorId),
          isMine: s.activeChallenge.creatorId === pid,
          clue: s.activeChallenge.clue
        } : null,
        winner: s.winner,
        secretWord: s.phase === 'reveal' ? s.secretWord : null,
        round: s.round
      };
    },

    render(el, v, api) {
      const esc = api.esc;

      if (v.phase === 'play') {
        const challengeBox = v.activeChallenge ? `
          <div class="glass-panel" style="padding:16px; margin:16px 0; border:2px solid var(--amber-glow); background:rgba(255,208,0,0.1);">
            <div style="font-size:0.85rem; font-weight:800; color:var(--solar-yellow);">⚡ DESAFIO DE CONTATO ATIVO!</div>
            <div style="font-size:1.15rem; font-weight:700; margin:6px 0;">
              ${v.activeChallenge.creator.avatar} <b>${esc(v.activeChallenge.creator.nickname)}</b> deu a dica:
            </div>
            <div style="font-size:1.3rem; color:var(--cyan-glow); margin:8px 0;">"${esc(v.activeChallenge.clue)}"</div>
            ${v.activeChallenge.isMine ? `
              <div class="muted small">Você lançou este desafio. Aguarde alguém dar o Contato!</div>
            ` : `
              <div class="answer-row" style="max-width:400px; margin:10px auto;">
                <input id="contato-answer-input" class="input-field" placeholder="Palavra com ${esc(v.prefix)}…" maxlength="30" autocomplete="off">
                <button class="btn-primary" data-act="answer-clue">Gritar Contato!</button>
              </div>
            `}
          </div>
        ` : `
          <div class="glass-panel" style="padding:16px; margin:16px 0;">
            <div style="font-size:0.9rem; font-weight:700; margin-bottom:8px; color:var(--cyan-glow);">Lançar um Desafio de Contato:</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <input id="clue-desc-input" class="input-field" placeholder="Dica pública (Ex: Animal que late)" maxlength="40" style="flex:2; min-width:160px;">
              <input id="clue-secret-input" class="input-field" placeholder="Palavra com ${esc(v.prefix)} (Ex: Cachorro)" maxlength="30" style="flex:1; min-width:140px;">
              <button class="btn-secondary" data-act="create-clue">Criar Dica</button>
            </div>
            <div class="muted small" style="margin-top:6px;">Se outro jogador adivinhar sua palavra, a próxima letra é liberada!</div>
          </div>
        `;

        el.innerHTML = `
          <div class="stage-card">
            <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--cyan-glow); margin-bottom:6px;">Palavra Secreta</div>
            <div style="font-family:'JetBrains Mono', monospace; font-size:2.8rem; font-weight:900; letter-spacing:12px; color:var(--acid-lime); margin:12px 0;">
              ${esc(v.mask)}
            </div>
            <div class="muted small">Tamanho: ${v.mask.replace(/\s/g, '').length} letras</div>
          </div>

          ${challengeBox}

          <!-- Chute da Palavra Secreta Completa -->
          <div style="max-width:480px; margin:20px auto; text-align:center;">
            <div style="font-size:0.9rem; font-weight:700; margin-bottom:6px;">Já sabe a palavra secreta inteira?</div>
            <div class="answer-row">
              <input id="guess-full-word-input" class="input-field" placeholder="Chutar palavra completa…" maxlength="30" autocomplete="off">
              <button class="btn-primary" data-act="guess-full" style="background:var(--emerald-glow); border-color:#000;">Acertar (+20)</button>
            </div>
          </div>`;

        // Bindings
        const btnGuessFull = el.querySelector('[data-act="guess-full"]');
        const inpGuessFull = el.querySelector('#guess-full-word-input');
        if (btnGuessFull && inpGuessFull) {
          const sendGuessFull = () => {
            if (!inpGuessFull.value.trim()) return;
            api.send('guess_word', { text: inpGuessFull.value });
            inpGuessFull.value = '';
          };
          btnGuessFull.onclick = sendGuessFull;
          inpGuessFull.onkeydown = (e) => { if (e.key === 'Enter') sendGuessFull(); };
        }

        const btnCreateClue = el.querySelector('[data-act="create-clue"]');
        if (btnCreateClue) {
          btnCreateClue.onclick = () => {
            const desc = el.querySelector('#clue-desc-input').value;
            const word = el.querySelector('#clue-secret-input').value;
            if (!desc.trim() || !word.trim()) return;
            api.send('create_clue', { clue: desc, word });
          };
        }

        const btnAnswerClue = el.querySelector('[data-act="answer-clue"]');
        const inpAnswerClue = el.querySelector('#contato-answer-input');
        if (btnAnswerClue && inpAnswerClue) {
          const sendAnswerClue = () => {
            if (!inpAnswerClue.value.trim()) return;
            api.send('answer_clue', { text: inpAnswerClue.value });
            inpAnswerClue.value = '';
          };
          btnAnswerClue.onclick = sendAnswerClue;
          inpAnswerClue.onkeydown = (e) => { if (e.key === 'Enter') sendAnswerClue(); };
        }
      } else {
        // Reveal
        el.innerHTML = `
          <div class="stage-card">
            <h2 style="font-size:1.4rem;">Fim da Rodada do Contato</h2>
            <div class="callout callout-cyan" style="margin-top:12px;">
              Palavra Secreta: <div style="font-size:2rem; font-weight:800; color:var(--acid-lime);">${esc(v.secretWord)}</div>
              ${v.winner ? `<div style="margin-top:8px;">🏆 Descoberta por ${v.winner.avatar} <b>${esc(v.winner.nickname)}</b> (+20 pts)!</div>` : ''}
            </div>
          </div>`;
      }
    }
  });
})();
