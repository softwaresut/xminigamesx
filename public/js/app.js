// xMiniGamesx - controlador do cliente (telas, lobby, chat, renderização do jogo)
(function () {
  const AVATARS = ['🦊', '🤖', '🦁', '🐯', '🐼', '🦄', '🚀', '👑', '👻', '👾', '🍕', '🎯', '🔥', '⚡', '💎', '🐉', '🥑', '🎮', '🐸', '🦖'];
  const CATS = { all: 'Todos', quiz: 'Quiz', social: 'Social', reflexo: 'Reflexo', deducao: 'Dedução' };
  const esc = U.esc;
  const $ = (id) => document.getElementById(id);

  const S = {
    me: {
      id: null,
      nickname: localStorage.getItem('x_nickname') || `Jogador${Math.floor(Math.random() * 900 + 100)}`,
      avatar: localStorage.getItem('x_avatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)]
    },
    net: null,
    host: null,
    room: null,
    view: null,
    filter: 'all',
    lastCue: 0,
    timerEnd: 0,
    lastTick: -1,
    chatOpen: false,
    unread: 0
  };

  // ---------------- utilidades de UI ----------------
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const el = $('screen-' + name);
    if (el) el.classList.add('active');
    $('chat-fab').style.display = name === 'welcome' ? 'none' : 'flex';
  }

  let toastT = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function setStatus(kind, text) {
    const dot = $('server-status-dot');
    const txt = $('server-status-text');
    const color = { online: 'var(--acid-lime)', wait: 'var(--solar-yellow)', off: 'var(--punch-pink)' }[kind];
    dot.style.background = color;
    dot.style.boxShadow = `0 0 8px ${color}`;
    txt.style.color = color;
    txt.textContent = text;
  }

  function sound(name) {
    const se = window.soundEngine;
    if (!se) return;
    const map = { pop: 'playPop', click: 'playClick', success: 'playSuccess', buzzer: 'playBuzzer', tick: 'playTick', victory: 'playVictory', boom: 'playBuzzer' };
    if (map[name] && se[map[name]]) se[map[name]]();
  }

  const isHost = () => S.room && S.me.id === S.room.hostId;

  // ---------------- rede ----------------
  function send(msg) {
    if (S.host) S.host.handle(S.me.id, msg);
    else if (S.net) S.net.toHost(msg);
  }

  async function createRoom() {
    const btn = $('btn-create-room');
    btn.disabled = true;
    btn.textContent = '⏳ Criando sala…';
    setStatus('wait', 'Conectando…');
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = U.roomCode();
      const net = new Net();
      try {
        const id = await net.host(code);
        S.net = net;
        S.me.id = id;
        S.host = new HostEngine(api, net, code, S.me);
        setStatus('online', 'ONLINE');
        S.host.pushRoom();
        S.host.systemChat('Sala criada. Copie o link e chame a galera!');
        return;
      } catch (err) {
        if (err && err.type === 'unavailable-id') continue;
        console.error(err);
        toast('Não foi possível criar a sala: ' + (err.type || err.message));
        break;
      }
    }
    setStatus('off', 'Offline');
    btn.disabled = false;
    btn.textContent = '✨ Criar Sala Privada';
  }

  async function joinRoom() {
    const code = $('input-room-code').value.trim().toUpperCase();
    if (code.length !== 4) { toast('O código da sala tem 4 letras.'); return; }
    const btn = $('btn-join-room');
    btn.disabled = true;
    btn.textContent = '⏳';
    setStatus('wait', 'Conectando…');
    const net = new Net();
    net.on('msg', (_from, msg) => receive(msg));
    net.on('hostLost', () => {
      setStatus('off', 'Sala encerrada');
      toast('O anfitrião saiu. A sala foi encerrada.');
      setTimeout(() => { window.location.href = window.location.pathname; }, 3500);
    });
    try {
      S.me.id = await net.join(code);
      S.net = net;
      setStatus('online', 'ONLINE');
      net.toHost({ t: 'join', nickname: S.me.nickname, avatar: S.me.avatar });
    } catch (err) {
      net.destroy();
      setStatus('off', 'Offline');
      toast(err.message);
      btn.disabled = false;
      btn.textContent = 'Entrar ➔';
    }
  }

  // ---------------- mensagens do anfitrião ----------------
  function receive(msg) {
    if (!msg) return;
    switch (msg.t) {
      case 'room': onRoom(msg.room); break;
      case 'view': onView(msg.v); break;
      case 'chat': addChat(msg.m); break;
      case 'chatlog': $('chat-log').innerHTML = ''; (msg.list || []).forEach((m) => addChat(m, true)); break;
      case 'react': floatReaction(msg.emoji); sound('pop'); break;
      case 'toast': toast(msg.text); break;
    }
  }

  function onRoom(room) {
    const prevPhase = S.room && S.room.phase;
    S.room = room;
    const url = `${location.pathname}?sala=${room.code}`;
    if (location.search !== `?sala=${room.code}`) history.replaceState(null, '', url);

    if (room.phase === 'lobby') {
      showScreen('lobby');
      renderLobby();
    } else if (room.phase === 'game') {
      showScreen('game');
      if (prevPhase !== 'game') { S.view = null; $('game-stage').innerHTML = '<div class="muted">Carregando…</div>'; }
    } else if (room.phase === 'podium') {
      showScreen('podium');
      renderPodium();
    }
  }

  // ---------------- lobby ----------------
  function renderLobby() {
    const r = S.room;
    $('lobby-room-code').textContent = r.code;
    $('lobby-player-count').textContent = r.players.length;
    $('lobby-host-indicator').textContent = isHost() ? '👑 Você é o líder da sala' : 'Aguardando o líder iniciar…';
    $('btn-start-game').style.display = isHost() ? 'flex' : 'none';

    $('lobby-player-list').innerHTML = r.players.map((p) => `
      <div class="player-pill">
        <div class="left-info"><span class="avatar">${esc(p.avatar)}</span>
          <span style="font-weight:700">${esc(p.nickname)}${p.id === S.me.id ? ' (você)' : ''}</span></div>
        ${p.id === r.hostId ? '<span class="host-crown">👑 Líder</span>' : '<span class="muted small">pronto</span>'}
      </div>`).join('');

    // filtros
    $('lobby-filters').innerHTML = Object.entries(CATS).map(([k, label]) =>
      `<button class="filter-chip ${S.filter === k ? 'active' : ''}" data-cat="${k}">${label}</button>`).join('');
    $('lobby-filters').querySelectorAll('.filter-chip').forEach((b) => {
      b.onclick = () => { S.filter = b.dataset.cat; renderLobby(); };
    });

    // cartuchos
    const ids = GAME_ORDER.filter((id) => S.filter === 'all' || GAMES[id].cat === S.filter);
    $('lobby-game-cards').innerHTML = ids.map((id) => {
      const g = GAMES[id];
      return `
        <div class="game-select-card ${r.selectedGame === id ? 'selected' : ''}" data-id="${id}">
          <div class="card-top"><span class="badge badge-${g.cat}">${CATS[g.cat]}</span>
            <span class="muted small">👥 ${g.minPlayers}+</span></div>
          <h4>${g.emoji} ${esc(g.name)}</h4>
          <p class="muted small">${esc(g.desc)}</p>
        </div>`;
    }).join('');
    $('lobby-game-cards').querySelectorAll('.game-select-card').forEach((c) => {
      c.onclick = () => {
        if (!isHost()) { toast('Só o líder escolhe o jogo.'); return; }
        send({ t: 'lobby', op: 'select', gameId: c.dataset.id });
        sound('click');
      };
    });

    const sel = GAMES[r.selectedGame];
    $('lobby-selected-name').textContent = sel ? `${sel.emoji} ${sel.name}` : '';
    $('setting-rounds').value = r.settings.rounds;
    $('setting-timer').value = r.settings.time;
    $('setting-difficulty').value = r.settings.difficulty;
    ['setting-rounds', 'setting-timer', 'setting-difficulty'].forEach((id) => { $(id).disabled = !isHost(); });
  }

  // ---------------- jogo ----------------
  const gameApi = {
    send: (type, data) => send({ t: 'action', type, data: data || {} }),
    esc,
    get me() { return S.me.id; },
    sound
  };

  function onView(v) {
    S.view = v;
    if (!S.room || S.room.phase !== 'game') return;
    const def = GAMES[S.room.gameId];
    if (!def) return;

    $('game-active-title').textContent = `${def.emoji} ${def.name}`;
    $('game-round-counter').textContent = v.label || '';

    // timer: converte "restante" em relógio local (evita diferença de relógio entre aparelhos)
    if (v._timer) {
      S.timerEnd = Date.now() + v._timer.left;
      $('game-timer-display').style.visibility = 'visible';
    } else {
      S.timerEnd = 0;
      $('game-timer-display').style.visibility = 'hidden';
    }
    if (v._cue && v._cue.id !== S.lastCue) { S.lastCue = v._cue.id; sound(v._cue.name); }

    // re-renderiza preservando o que o jogador estava digitando
    const stage = $('game-stage');
    const saved = {};
    stage.querySelectorAll('input[id], textarea[id]').forEach((i) => { saved[i.id] = i.value; });
    const focused = document.activeElement && stage.contains(document.activeElement) ? document.activeElement.id : null;
    const caret = focused ? document.activeElement.selectionStart : null;

    try { def.render(stage, v, gameApi); } catch (e) { console.error('[render]', e); }

    Object.entries(saved).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && stage.contains(el) && !el.dataset.fresh && !el.value) el.value = val;
    });
    if (focused) {
      const el = document.getElementById(focused);
      if (el && !el.disabled) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* ignore */ } }
    } else {
      const auto = stage.querySelector('[data-autofocus]');
      if (auto && !auto.disabled && window.innerWidth > 700) auto.focus();
    }

    $('game-live-scoreboard').innerHTML = (v._scores || []).map((s) => `
      <div class="chip ${s.connected ? '' : 'chip-off'}">${esc(s.avatar)} <b>${esc(s.nickname)}</b>
        <span class="pts">${s.score}</span></div>`).join('');
    $('btn-game-exit').style.display = isHost() ? 'inline-flex' : 'none';
  }

  function tickTimer() {
    if (!S.timerEnd) return;
    const left = Math.max(0, Math.ceil((S.timerEnd - Date.now()) / 1000));
    $('game-timer-val').textContent = left;
    const box = $('game-timer-display');
    if (left <= 5) {
      box.classList.add('warning');
      if (left !== S.lastTick && left > 0) sound('tick');
    } else {
      box.classList.remove('warning');
    }
    S.lastTick = left;
  }

  // ---------------- pódio ----------------
  function renderPodium() {
    const sorted = S.room.players.slice().sort((a, b) => b.score - a.score);
    [1, 2, 3].forEach((n) => {
      const p = sorted[n - 1];
      $(`podium-avatar-${n}`).textContent = p ? p.avatar : '—';
      $(`podium-name-${n}`).textContent = p ? p.nickname : '-';
      $(`podium-score-${n}`).textContent = p ? `${p.score} pts` : '';
    });
    $('podium-full-list').innerHTML = sorted.map((p, i) => `
      <div class="player-pill"><div class="left-info"><b>#${i + 1}</b>
        <span class="avatar">${esc(p.avatar)}</span><span style="font-weight:700">${esc(p.nickname)}</span></div>
        <b class="pts">${p.score} pts</b></div>`).join('');
    $('btn-play-again').style.display = isHost() ? 'inline-flex' : 'none';
    $('btn-back-lobby').style.display = isHost() ? 'inline-flex' : 'none';
    $('podium-wait').style.display = isHost() ? 'none' : 'block';
    sound('victory');
    confetti();
  }

  // ---------------- chat ----------------
  function addChat(m, silent) {
    const log = $('chat-log');
    const div = document.createElement('div');
    div.className = m.system ? 'chat-msg system' : 'chat-msg';
    div.innerHTML = m.system
      ? `<span>${esc(m.text)}</span>`
      : `<span class="chat-who">${esc(m.avatar)} ${esc(m.nickname)}</span> <span>${esc(m.text)}</span> <span class="chat-time">${esc(m.time)}</span>`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    if (!silent && !S.chatOpen && !m.system) {
      S.unread += 1;
      $('chat-badge').textContent = S.unread;
      $('chat-badge').style.display = 'flex';
    }
  }

  function toggleChat(open) {
    S.chatOpen = open == null ? !S.chatOpen : open;
    $('chat-panel').classList.toggle('open', S.chatOpen);
    if (S.chatOpen) {
      S.unread = 0;
      $('chat-badge').style.display = 'none';
      setTimeout(() => $('chat-input').focus(), 50);
    }
  }

  // ---------------- efeitos ----------------
  function floatReaction(emoji) {
    const el = document.createElement('div');
    el.className = 'floating-reaction';
    el.textContent = emoji;
    el.style.left = `${Math.random() * 60 + 20}%`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  function confetti() {
    const canvas = $('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const colors = ['#ccff00', '#ff1f6d', '#00f0ff', '#ffd000', '#ffffff'];
    const parts = Array.from({ length: 140 }, () => ({
      x: canvas.width / 2, y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 18, vy: (Math.random() - 0.85) * 18,
      s: Math.random() * 8 + 4, c: colors[Math.floor(Math.random() * colors.length)],
      r: Math.random() * 360, vr: (Math.random() - 0.5) * 12
    }));
    (function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      parts.forEach((p) => {
        p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y < canvas.height) alive = true;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r * Math.PI / 180);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
      });
      if (alive) requestAnimationFrame(frame); else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })();
  }

  // ---------------- inicialização ----------------
  const api = { receive };

  function init() {
    // limpa service workers antigos (projeto anterior na mesma porta)
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));

    $('input-nickname').value = S.me.nickname;
    $('user-avatar-preview').textContent = S.me.avatar;
    $('avatar-picker-grid').innerHTML = AVATARS.map((a) =>
      `<div class="avatar-opt ${a === S.me.avatar ? 'selected' : ''}">${a}</div>`).join('');
    $('avatar-picker-grid').querySelectorAll('.avatar-opt').forEach((el) => {
      el.onclick = () => {
        S.me.avatar = el.textContent;
        localStorage.setItem('x_avatar', S.me.avatar);
        $('user-avatar-preview').textContent = S.me.avatar;
        document.querySelectorAll('.avatar-opt').forEach((x) => x.classList.remove('selected'));
        el.classList.add('selected');
        sound('pop');
      };
    });
    $('input-nickname').oninput = (e) => {
      S.me.nickname = U.clip(e.target.value, 16) || 'Jogador';
      localStorage.setItem('x_nickname', S.me.nickname);
    };

    const code = new URLSearchParams(location.search).get('sala');
    if (code) {
      $('input-room-code').value = code.toUpperCase().slice(0, 4);
      $('join-card').classList.add('highlight');
    }

    if (typeof Peer === 'undefined') {
      setStatus('off', 'PeerJS não carregou');
    } else {
      setStatus('online', 'Pronto');
    }

    $('btn-create-room').onclick = createRoom;
    $('btn-join-room').onclick = joinRoom;
    $('input-room-code').onkeydown = (e) => { if (e.key === 'Enter') joinRoom(); };

    $('btn-copy-code').onclick = () => navigator.clipboard.writeText(S.room.code).then(() => toast(`Código ${S.room.code} copiado!`));
    $('btn-copy-link').onclick = () => {
      const inviteUrl = `${location.origin}${location.pathname}?sala=${S.room.code}`;
      if (navigator.share && window.innerWidth <= 768) {
        navigator.share({
          title: 'xMiniGamesx Party',
          text: `Bora jogar xMiniGamesx! Entra na minha sala ${S.room.code}:`,
          url: inviteUrl
        }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(inviteUrl).then(() => toast('Link copiado! Mande no WhatsApp ou Discord 🚀'));
      }
    };

    const sendSettings = () => send({ t: 'lobby', op: 'settings', rounds: $('setting-rounds').value, time: $('setting-timer').value, difficulty: $('setting-difficulty').value });
    ['setting-rounds', 'setting-timer', 'setting-difficulty'].forEach((id) => { $(id).onchange = sendSettings; });

    $('btn-start-game').onclick = () => send({ t: 'lobby', op: 'start' });
    $('btn-play-again').onclick = () => send({ t: 'lobby', op: 'start' });
    $('btn-back-lobby').onclick = () => send({ t: 'lobby', op: 'lobby' });
    $('btn-game-exit').onclick = () => { if (confirm('Encerrar o jogo e voltar ao lobby?')) send({ t: 'lobby', op: 'lobby' }); };

    document.querySelectorAll('.emoji-btn').forEach((b) => { b.onclick = () => send({ t: 'react', emoji: b.dataset.emoji }); });

    $('chat-fab').onclick = () => toggleChat();
    $('chat-close').onclick = () => toggleChat(false);
    const sendChat = () => {
      const i = $('chat-input');
      if (!i.value.trim()) return;
      send({ t: 'chat', text: i.value });
      i.value = '';
    };
    $('chat-send').onclick = sendChat;
    $('chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };

    $('btn-sound-toggle').textContent = window.soundEngine && window.soundEngine.muted ? '🔇' : '🔊';
    $('btn-sound-toggle').onclick = () => { $('btn-sound-toggle').textContent = window.soundEngine.toggleMute() ? '🔇' : '🔊'; };
    $('btn-logo-home').onclick = () => { if (!S.room || confirm('Sair da sala e voltar ao início?')) location.href = location.pathname; };

    window.addEventListener('beforeunload', (e) => {
      if (S.host && S.room && S.room.players.length > 1) { e.preventDefault(); e.returnValue = ''; }
    });

    setInterval(tickTimer, 200);
    showScreen('welcome');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
