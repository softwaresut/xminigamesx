// xMiniGamesx - Client Application Logic

const AVATARS = ['🦊', '🤖', '🦁', '🐯', '🐼', '🦄', '🚀', '👑', '👻', '👾', '🍕', '🎯', '🔥', '⚡', '💎', '🐉', '🥑', '🎮'];

// State
let socket = null;
let currentUser = {
  nickname: localStorage.getItem('x_nickname') || `Jogador_${Math.floor(Math.random() * 899 + 100)}`,
  avatar: localStorage.getItem('x_avatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)]
};
let currentRoom = null;
let isHost = false;
let myId = null;

// DOM Elements
const screens = {
  welcome: document.getElementById('screen-welcome'),
  lobby: document.getElementById('screen-lobby'),
  game: document.getElementById('screen-game'),
  podium: document.getElementById('screen-podium')
};

const toastEl = document.getElementById('toast');
const soundBtn = document.getElementById('btn-sound-toggle');
const nicknameInput = document.getElementById('input-nickname');
const avatarPreview = document.getElementById('user-avatar-preview');
const avatarGrid = document.getElementById('avatar-picker-grid');

// Show Screen Helper
function showScreen(screenKey) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (screens[screenKey]) {
    screens[screenKey].classList.add('active');
  }
}

// Toast Helper
let toastTimeout = null;
function showToast(msg) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2600);
}

// Init Setup
function initApp() {
  nicknameInput.value = currentUser.nickname;
  avatarPreview.textContent = currentUser.avatar;

  // Render avatar picker
  avatarGrid.innerHTML = '';
  AVATARS.forEach(av => {
    const btn = document.createElement('div');
    btn.className = `avatar-opt ${av === currentUser.avatar ? 'selected' : ''}`;
    btn.textContent = av;
    btn.addEventListener('click', () => {
      currentUser.avatar = av;
      avatarPreview.textContent = av;
      localStorage.setItem('x_avatar', av);
      document.querySelectorAll('.avatar-opt').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      if (window.soundEngine) window.soundEngine.playPop();
    });
    avatarGrid.appendChild(btn);
  });

  nicknameInput.addEventListener('input', (e) => {
    currentUser.nickname = e.target.value.trim() || 'Jogador';
    localStorage.setItem('x_nickname', currentUser.nickname);
  });

  // Sound toggle button
  soundBtn.addEventListener('click', () => {
    const muted = window.soundEngine.toggleMute();
    soundBtn.textContent = muted ? '🔇' : '🔊';
  });

  // Check URL query for room code (?sala=CODE or ?code=CODE)
  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get('sala') || params.get('code');
  if (codeParam) {
    const inputCode = document.getElementById('input-room-code');
    if (inputCode) inputCode.value = codeParam.toUpperCase().slice(0, 4);
  }

  // Connect to Socket.io
  setupSocket();
}

// Socket Connection & Events
function setupSocket() {
  socket = io();

  socket.on('connect', () => {
    myId = socket.id;
    console.log('[Socket] Connected, ID:', myId);
  });

  socket.on('disconnect', () => {
    showToast('Desconectado do servidor. Tentando reconectar...');
  });

  // Room Events
  socket.on('room_created', (room) => {
    handleRoomJoined(room);
    showToast('Sala criada com sucesso!');
  });

  socket.on('room_joined', (room) => {
    handleRoomJoined(room);
    showToast(`Você entrou na sala ${room.code}!`);
  });

  socket.on('room_player_joined', ({ player, room }) => {
    currentRoom = room;
    renderLobby(room);
    showToast(`${player.avatar} ${player.nickname} entrou na sala!`);
    if (window.soundEngine) window.soundEngine.playPop();
  });

  socket.on('room_player_left', ({ room }) => {
    currentRoom = room;
    renderLobby(room);
  });

  socket.on('game_selected', ({ selectedGame, room }) => {
    currentRoom = room;
    renderGameCards(selectedGame);
    showToast('Jogo alterado pelo líder!');
    if (window.soundEngine) window.soundEngine.playClick();
  });

  socket.on('settings_updated', ({ settings }) => {
    if (currentRoom) currentRoom.settings = settings;
    updateSettingsDisplay(settings);
  });

  socket.on('room_returned_to_lobby', (room) => {
    currentRoom = room;
    showScreen('lobby');
    renderLobby(room);
    showToast('Retornaram ao Lobby!');
  });

  socket.on('error_message', (msg) => {
    showToast(msg);
  });

  // Global Timer Tick
  socket.on('game_timer_tick', ({ timeLeft }) => {
    const timerDisplay = document.getElementById('game-timer-display');
    const timerVal = document.getElementById('game-timer-val');
    if (timerVal) timerVal.textContent = timeLeft;
    if (timerDisplay) {
      if (timeLeft <= 5) {
        timerDisplay.classList.add('warning');
        if (window.soundEngine && timeLeft > 0) window.soundEngine.playTick();
      } else {
        timerDisplay.classList.remove('warning');
      }
    }
  });

  // Emojis & Reactions
  socket.on('player_reaction', ({ emoji, nickname, avatar }) => {
    spawnFloatingReaction(emoji);
    if (window.soundEngine) window.soundEngine.playPop();
  });

  // GAME 1: NÃO RESPONDA
  socket.on('game_round_start', (data) => {
    showScreen('game');
    renderNaoRespondaRound(data);
  });

  socket.on('game_answered_update', ({ answeredCount, totalPlayers }) => {
    const countEl = document.getElementById('nr-answered-count');
    const totalEl = document.getElementById('nr-total-count');
    if (countEl) countEl.textContent = answeredCount;
    if (totalEl) totalEl.textContent = totalPlayers;
  });

  socket.on('game_round_result', (data) => {
    renderNaoRespondaResults(data);
  });

  // GAME 2: 3 DICAS
  socket.on('tres_dicas_clue', (data) => {
    showScreen('game');
    renderTresDicasClue(data);
  });

  socket.on('tres_dicas_wrong_guess', ({ player, guess }) => {
    const fb = document.getElementById('td-guess-feedback');
    if (fb) {
      fb.innerHTML = `<span style="color: var(--rose-glow);">${player.avatar} ${player.nickname} chutou: "<b>${guess}</b>" (Incorreto!)</span>`;
    }
  });

  socket.on('tres_dicas_round_result', (data) => {
    renderTresDicasResult(data);
  });

  // GAME 3: JOGO DA SENHA
  socket.on('senha_round_start', (data) => {
    showScreen('game');
    renderSenhaRound(data);
  });

  socket.on('senha_guess_feedback', (data) => {
    renderSenhaFeedback(data);
  });

  socket.on('senha_activity', ({ player, attemptsCount }) => {
    showToast(`${player.avatar} ${player.nickname} fez uma tentativa (${attemptsCount}/8)`);
  });

  socket.on('senha_round_result', (data) => {
    renderSenhaResult(data);
  });

  // GAME 4: BOTÃO RÁPIDO
  socket.on('botao_round_start', (data) => {
    showScreen('game');
    renderBotaoRound(data);
  });

  socket.on('botao_buzzed', (data) => {
    handleBotaoBuzzed(data);
  });

  socket.on('botao_player_failed', ({ player, reason }) => {
    if (player) {
      showToast(`${player.avatar} ${player.nickname} errou! (${reason})`);
    }
    if (window.soundEngine) window.soundEngine.playBuzzer();
  });

  socket.on('botao_reopened', ({ questionTimeLeft, lockedOutIds }) => {
    handleBotaoReopened(lockedOutIds);
  });

  socket.on('botao_round_result', (data) => {
    renderBotaoResult(data);
  });

  // PODIUM
  socket.on('game_podium', (data) => {
    renderPodium(data);
  });
}

// Room Joined Handler
function handleRoomJoined(room) {
  currentRoom = room;
  isHost = room.hostId === socket.id;
  showScreen('lobby');
  renderLobby(room);

  // Update URL without page reload
  const newUrl = `${window.location.origin}${window.location.pathname}?sala=${room.code}`;
  window.history.pushState({ path: newUrl }, '', newUrl);
}

// Render Room Lobby
function renderLobby(room) {
  document.getElementById('lobby-room-code').textContent = room.code;
  document.getElementById('lobby-player-count').textContent = room.players.length;

  isHost = room.hostId === socket.id;
  const hostIndicator = document.getElementById('lobby-host-indicator');
  const startBtn = document.getElementById('btn-start-game');
  const pickerHint = document.getElementById('lobby-game-picker-hint');

  if (isHost) {
    hostIndicator.textContent = '👑 Você é o Líder da Sala';
    startBtn.style.display = 'block';
    startBtn.textContent = '🚀 INICIAR JOGO';
    pickerHint.textContent = 'Você é o líder: clique em um jogo para selecionar';
  } else {
    hostIndicator.textContent = 'Aguardando o Líder iniciar...';
    startBtn.style.display = 'none';
    pickerHint.textContent = 'Aguardando líder escolher o jogo';
  }

  // Render Players
  const listEl = document.getElementById('lobby-player-list');
  listEl.innerHTML = '';
  room.players.forEach(p => {
    const pill = document.createElement('div');
    pill.className = 'player-pill';
    pill.innerHTML = `
      <div class="left-info">
        <span class="avatar">${p.avatar}</span>
        <span style="font-weight: 700;">${p.nickname} ${p.id === socket.id ? '(Você)' : ''}</span>
      </div>
      <div>
        ${p.isHost ? '<span class="host-crown">👑 Líder</span>' : '<span style="color: var(--emerald-glow); font-size: 0.85rem;">Pronto</span>'}
      </div>
    `;
    listEl.appendChild(pill);
  });

  renderGameCards(room.selectedGame);
  updateSettingsDisplay(room.settings);
}

// Render Game Select Cards
function renderGameCards(selectedGameId) {
  const cards = document.querySelectorAll('.game-select-card');
  cards.forEach(card => {
    const gameId = card.getAttribute('data-game-id');
    if (gameId === selectedGameId) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }

    // Only host can click to select
    card.onclick = () => {
      if (!isHost) {
        showToast('Apenas o líder da sala pode escolher o jogo!');
        return;
      }
      socket.emit('select_game', { gameId });
    };
  });
}

function updateSettingsDisplay(settings) {
  const roundsSel = document.getElementById('setting-rounds');
  const timerSel = document.getElementById('setting-timer');
  const diffSel = document.getElementById('setting-difficulty');

  if (roundsSel && settings.rounds) roundsSel.value = settings.rounds;
  if (timerSel && settings.timerSeconds) timerSel.value = settings.timerSeconds;
  if (diffSel && settings.difficulty) diffSel.value = settings.difficulty;

  // Disable dropdowns for non-hosts
  [roundsSel, timerSel, diffSel].forEach(el => {
    if (el) el.disabled = !isHost;
  });
}

// Update Live Scoreboard
function updateLiveScoreboard(scores) {
  const bar = document.getElementById('game-live-scoreboard');
  if (!bar || !scores) return;
  bar.innerHTML = '';
  scores.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip-answer';
    chip.innerHTML = `
      <span>${s.avatar}</span>
      <span style="font-weight: 800;">${s.nickname}:</span>
      <span style="color: var(--solar-yellow); font-family: var(--font-mono); font-weight: 900;">${s.score} pts</span>
    `;
    bar.appendChild(chip);
  });
}

// -------------------------------------------------------------
// JOGO 1: NÃO RESPONDA A MESMA RESPOSTA
// -------------------------------------------------------------
function renderNaoRespondaRound(data) {
  switchGameView('view-nao-responda');
  document.getElementById('game-active-title').textContent = '💡 Não Responda Igual';
  document.getElementById('game-round-counter').textContent = `Rodada ${data.round} de ${data.totalRounds}`;
  document.getElementById('nr-question-text').textContent = data.question;

  // Answering controls
  document.getElementById('nr-answering-box').style.display = 'block';
  document.getElementById('nr-results-box').style.display = 'none';

  const inputAnswer = document.getElementById('input-nr-answer');
  const btnSubmit = document.getElementById('btn-nr-submit');
  inputAnswer.value = '';
  inputAnswer.disabled = false;
  btnSubmit.disabled = false;
  btnSubmit.textContent = 'Enviar ➔';
  inputAnswer.focus();

  document.getElementById('nr-answered-count').textContent = '0';
  document.getElementById('nr-total-count').textContent = Object.keys(data.scores || {}).length || currentRoom.players.length;

  updateLiveScoreboard(data.scores);
  if (window.soundEngine) window.soundEngine.playPop();
}

function renderNaoRespondaResults(data) {
  document.getElementById('nr-answering-box').style.display = 'none';
  const resultsBox = document.getElementById('nr-results-box');
  resultsBox.style.display = 'flex';

  const uniquesList = document.getElementById('nr-uniques-list');
  const duplicatesList = document.getElementById('nr-duplicates-list');
  const noAnswersList = document.getElementById('nr-noanswers-list');

  uniquesList.innerHTML = '';
  duplicatesList.innerHTML = '';
  noAnswersList.innerHTML = '';

  // Uniques (+10 pts)
  if (data.results.uniques.length === 0) {
    uniquesList.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.95rem;">Ninguém conseguiu resposta única nesta rodada!</span>';
  } else {
    data.results.uniques.forEach(item => {
      const chip = document.createElement('div');
      chip.className = 'chip-answer';
      chip.style.border = '2px solid #000';
      chip.style.boxShadow = '3px 3px 0 var(--acid-lime)';
      chip.innerHTML = `
        <span>${item.player.avatar} <b>${item.player.nickname}</b>:</span>
        <span style="color: var(--acid-lime); font-family: var(--font-display); font-size: 1.15rem;">"${item.rawAnswer}"</span>
        <span class="badge" style="background: var(--acid-lime); color: #000; font-weight: 900; border: 1.5px solid #000; padding: 2px 8px; border-radius: 6px;">+10 PTS</span>
      `;
      uniquesList.appendChild(chip);
    });
  }

  // Duplicates (+5 pts)
  if (data.results.duplicates.length === 0) {
    duplicatesList.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.95rem;">Nenhuma resposta foi repetida!</span>';
  } else {
    data.results.duplicates.forEach(grp => {
      const chip = document.createElement('div');
      chip.className = 'chip-answer';
      chip.style.border = '2px solid #000';
      chip.style.boxShadow = '3px 3px 0 var(--solar-yellow)';
      const names = grp.players.map(p => `${p.avatar} ${p.nickname}`).join(' e ');
      chip.innerHTML = `
        <span style="color: var(--solar-yellow); font-family: var(--font-display); font-size: 1.15rem;">"${grp.sampleAnswer}"</span>
        <span style="color: var(--text-secondary); font-size: 0.85rem;">(pensaram igual: ${names})</span>
        <span class="badge" style="background: var(--solar-yellow); color: #000; font-weight: 900; border: 1.5px solid #000; padding: 2px 8px; border-radius: 6px;">+5 PTS</span>
      `;
      duplicatesList.appendChild(chip);
    });
  }

  // No answers (0 pts)
  if (data.results.noAnswers.length === 0) {
    noAnswersList.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.95rem;">Todos responderam a tempo! 🎉</span>';
  } else {
    data.results.noAnswers.forEach(item => {
      const chip = document.createElement('div');
      chip.className = 'chip-answer';
      chip.style.border = '2px solid #000';
      chip.style.boxShadow = '3px 3px 0 var(--punch-pink)';
      chip.innerHTML = `
        <span>${item.player.avatar} <b>${item.player.nickname}</b>:</span>
        <span style="color: var(--punch-pink); font-style: italic;">${item.rawAnswer}</span>
        <span class="badge" style="background: var(--punch-pink); color: #fff; font-weight: 900; border: 1.5px solid #000; padding: 2px 8px; border-radius: 6px;">0 PTS</span>
      `;
      noAnswersList.appendChild(chip);
    });
  }

  updateLiveScoreboard(data.scores);
  if (window.soundEngine) window.soundEngine.playSuccess();
}

// -------------------------------------------------------------
// JOGO 2: JOGO DAS 3 DICAS
// -------------------------------------------------------------
function renderTresDicasClue(data) {
  switchGameView('view-tres-dicas');
  document.getElementById('game-active-title').textContent = '🔍 Jogo das 3 Dicas';
  document.getElementById('game-round-counter').textContent = `Rodada ${data.round} de ${data.totalRounds}`;
  document.getElementById('td-points-badge').textContent = `Acerto agora vale ${data.pointsAvailable} Pontos!`;

  document.getElementById('td-input-box').style.display = 'block';
  document.getElementById('td-result-box').style.display = 'none';

  const container = document.getElementById('td-clues-container');
  container.innerHTML = '';

  data.clues.forEach((clueText, idx) => {
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '16px';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '14px';
    card.innerHTML = `
      <span class="badge badge-cyan" style="font-size: 1rem; padding: 6px 12px;">Dica ${idx + 1}</span>
      <span style="font-size: 1.15rem; font-weight: 700; color: #fff;">${clueText}</span>
    `;
    container.appendChild(card);
  });

  const inputGuess = document.getElementById('input-td-guess');
  inputGuess.value = '';
  inputGuess.focus();
  document.getElementById('td-guess-feedback').textContent = '';

  updateLiveScoreboard(data.scores);
  if (window.soundEngine) window.soundEngine.playPop();
}

function renderTresDicasResult(data) {
  document.getElementById('td-input-box').style.display = 'none';
  const resultBox = document.getElementById('td-result-box');
  resultBox.style.display = 'block';

  const winnerEl = document.getElementById('td-winner-text');
  const secretEl = document.getElementById('td-secret-reveal');

  if (data.winner) {
    winnerEl.innerHTML = `🎉 ${data.winner.player.avatar} <b>${data.winner.player.nickname}</b> acertou com palpite "${data.winner.guess}" (+${data.winner.points} pts)!`;
    winnerEl.style.color = 'var(--emerald-glow)';
    if (window.soundEngine) window.soundEngine.playSuccess();
  } else {
    winnerEl.innerHTML = `⏳ Ninguém adivinhou a tempo!`;
    winnerEl.style.color = 'var(--amber-glow)';
    if (window.soundEngine) window.soundEngine.playBuzzer();
  }

  secretEl.innerHTML = `A resposta certa era: <b style="color: var(--cyan-glow); font-size: 1.4rem;">${data.answer}</b>`;
  updateLiveScoreboard(data.scores);
}

// -------------------------------------------------------------
// JOGO 3: JOGO DA SENHA
// -------------------------------------------------------------
function renderSenhaRound(data) {
  switchGameView('view-jogo-senha');
  document.getElementById('game-active-title').textContent = '🔐 Jogo da Senha';
  document.getElementById('game-round-counter').textContent = `Rodada ${data.round} de ${data.totalRounds}`;
  
  const modeLabel = document.getElementById('senha-mode-label');
  if (data.mode === 'facil') {
    modeLabel.textContent = 'Modo Fácil: Verde (lugar certo), Amarelo (existe no código), Vermelho (não existe).';
  } else {
    modeLabel.textContent = 'Modo Difícil: Apenas contagem de dígitos certos sem dizer as posições!';
  }

  document.getElementById('senha-attempts-history').innerHTML = '';
  document.getElementById('senha-result-box').style.display = 'none';

  const inputGuess = document.getElementById('input-senha-guess');
  inputGuess.value = '';
  inputGuess.disabled = false;
  inputGuess.focus();
  document.getElementById('btn-senha-submit').disabled = false;

  updateLiveScoreboard(data.scores);
  if (window.soundEngine) window.soundEngine.playPop();
}

function renderSenhaFeedback(data) {
  const history = document.getElementById('senha-attempts-history');
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.justifyContent = 'space-between';
  row.style.padding = '8px 12px';
  row.style.background = 'rgba(0,0,0,0.3)';
  row.style.borderRadius = 'var(--radius-sm)';
  row.style.border = '1px solid var(--bg-card-border)';

  const attempt = data.attempt;

  if (attempt.feedback) {
    // Easy mode chips
    let boxesHtml = '<div style="display: flex; gap: 6px;">';
    attempt.feedback.forEach(f => {
      boxesHtml += `<span class="code-digit-box ${f.status}" style="width: 38px; height: 44px; font-size: 1.3rem;">${f.digit}</span>`;
    });
    boxesHtml += '</div>';

    row.innerHTML = `
      <span style="color: var(--text-muted); font-size: 0.85rem;">#${data.attemptsCount}</span>
      ${boxesHtml}
      <span style="font-size: 0.85rem; color: ${attempt.isCorrect ? 'var(--emerald-glow)' : 'var(--text-muted)'};">${attempt.isCorrect ? 'ACERTOU! 🏆' : 'Tente novamente'}</span>
    `;
  } else if (attempt.hardFeedback) {
    // Hard mode
    row.innerHTML = `
      <span style="color: var(--text-muted); font-size: 0.85rem;">#${data.attemptsCount}</span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 1.2rem; font-weight: 800; letter-spacing: 4px;">${attempt.guess}</span>
      <span style="font-size: 0.85rem; color: var(--amber-glow);">
        🎯 ${attempt.hardFeedback.exactMatches} na posição | 🔄 ${attempt.hardFeedback.existingMatches} no código
      </span>
    `;
  }

  history.prepend(row);
  if (window.soundEngine) {
    if (attempt.isCorrect) window.soundEngine.playSuccess();
    else window.soundEngine.playClick();
  }
}

function renderSenhaResult(data) {
  const resultBox = document.getElementById('senha-result-box');
  resultBox.style.display = 'block';

  const winnerEl = document.getElementById('senha-winner-text');
  const codeEl = document.getElementById('senha-code-reveal');

  if (data.winner) {
    winnerEl.innerHTML = `🏆 ${data.winner.player.avatar} <b>${data.winner.player.nickname}</b> quebrou a senha em ${data.winner.attempts} tentativas (+${data.winner.points} pts)!`;
    if (window.soundEngine) window.soundEngine.playSuccess();
  } else {
    winnerEl.innerHTML = `Ninguém descobriu a senha a tempo!`;
    if (window.soundEngine) window.soundEngine.playBuzzer();
  }

  codeEl.textContent = `A senha secreta era: [ ${data.secretCode} ]`;
  updateLiveScoreboard(data.scores);
}

// -------------------------------------------------------------
// JOGO 4: BOTÃO RÁPIDO (TORTA NA CARA)
// -------------------------------------------------------------
function renderBotaoRound(data) {
  switchGameView('view-botao-rapido');
  document.getElementById('game-active-title').textContent = '🚨 Botão Rápido';
  document.getElementById('game-round-counter').textContent = `Rodada ${data.round} de ${data.totalRounds}`;
  document.getElementById('br-question-text').textContent = data.question;

  document.getElementById('br-buzzer-wrapper').style.display = 'flex';
  document.getElementById('br-options-container').style.display = 'none';
  document.getElementById('br-round-result').style.display = 'none';

  const buzzerBtn = document.getElementById('btn-giant-buzzer');
  buzzerBtn.disabled = false;
  document.getElementById('br-buzzer-status').textContent = 'Seja o primeiro a bater no botão!';

  // Populate options
  const optionBtns = document.querySelectorAll('.br-option-btn');
  optionBtns.forEach((btn, idx) => {
    btn.textContent = data.options[idx] || '';
    btn.disabled = false;
    btn.style.borderColor = 'var(--bg-card-border)';
  });

  updateLiveScoreboard(data.scores);
  if (window.soundEngine) window.soundEngine.playPop();
}

function handleBotaoBuzzed(data) {
  if (window.soundEngine) window.soundEngine.playBuzzer();

  const isMe = data.player.id === socket.id;
  const statusEl = document.getElementById('br-buzzer-status');
  const buzzerBtn = document.getElementById('btn-giant-buzzer');
  buzzerBtn.disabled = true;

  if (isMe) {
    statusEl.innerHTML = `<span style="color: var(--emerald-glow);">VOCÊ BATEU PRIMEIRO! Escolha a resposta rápida! (${data.buzzerTimeLeft}s)</span>`;
    document.getElementById('br-options-container').style.display = 'grid';
  } else {
    statusEl.innerHTML = `<span style="color: var(--amber-glow);">${data.player.avatar} <b>${data.player.nickname}</b> bateu no botão! Aguardando resposta...</span>`;
    document.getElementById('br-options-container').style.display = 'none';
  }
}

function handleBotaoReopened(lockedOutIds) {
  const isLocked = lockedOutIds.includes(socket.id);
  const buzzerBtn = document.getElementById('btn-giant-buzzer');
  const statusEl = document.getElementById('br-buzzer-status');

  document.getElementById('br-options-container').style.display = 'none';

  if (isLocked) {
    buzzerBtn.disabled = true;
    statusEl.innerHTML = `<span style="color: var(--rose-glow);">Você errou nesta rodada! Bloqueado.</span>`;
  } else {
    buzzerBtn.disabled = false;
    statusEl.innerHTML = `<span style="color: var(--cyan-glow);">Botão liberado novamente! BATA AGORA!</span>`;
  }
}

function renderBotaoResult(data) {
  document.getElementById('br-buzzer-wrapper').style.display = 'none';
  document.getElementById('br-options-container').style.display = 'none';

  const resultBox = document.getElementById('br-round-result');
  resultBox.style.display = 'block';

  const msgEl = document.getElementById('br-round-winner-msg');
  if (data.winner) {
    msgEl.innerHTML = `🎉 ${data.winner.player.avatar} <b>${data.winner.player.nickname}</b> acertou: "<b>${data.correctOption}</b>" (+10 pts)!`;
    msgEl.style.color = 'var(--emerald-glow)';
    if (window.soundEngine) window.soundEngine.playSuccess();
  } else {
    msgEl.innerHTML = `❌ Resposta certa era: "<b>${data.correctOption}</b>" (${data.reason})`;
    msgEl.style.color = 'var(--rose-glow)';
  }

  updateLiveScoreboard(data.scores);
}

// -------------------------------------------------------------
// PODIUM & VENCEDORES
// -------------------------------------------------------------
function renderPodium(data) {
  showScreen('podium');
  if (window.soundEngine) window.soundEngine.playVictory();
  triggerConfetti();

  const podium = data.podium || [];
  
  // 1st place
  const p1 = podium[0];
  document.getElementById('podium-avatar-1').textContent = p1 ? p1.avatar : '👑';
  document.getElementById('podium-name-1').textContent = p1 ? p1.nickname : '-';
  document.getElementById('podium-score-1').textContent = p1 ? `${p1.score} pts` : '0 pts';

  // 2nd place
  const p2 = podium[1];
  document.getElementById('podium-avatar-2').textContent = p2 ? p2.avatar : '🥈';
  document.getElementById('podium-name-2').textContent = p2 ? p2.nickname : '-';
  document.getElementById('podium-score-2').textContent = p2 ? `${p2.score} pts` : '0 pts';

  // 3rd place
  const p3 = podium[2];
  document.getElementById('podium-avatar-3').textContent = p3 ? p3.avatar : '🥉';
  document.getElementById('podium-name-3').textContent = p3 ? p3.nickname : '-';
  document.getElementById('podium-score-3').textContent = p3 ? `${p3.score} pts` : '0 pts';

  // Full list
  const fullList = document.getElementById('podium-full-list');
  fullList.innerHTML = '';
  data.scores.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = 'player-pill';
    item.innerHTML = `
      <div class="left-info">
        <span style="font-weight: 800; width: 24px;">#${idx + 1}</span>
        <span class="avatar">${p.avatar}</span>
        <span style="font-weight: 700;">${p.nickname}</span>
      </div>
      <div style="font-weight: 800; color: var(--cyan-glow);">${p.score} pts</div>
    `;
    fullList.appendChild(item);
  });

  // Action buttons
  const playAgainBtn = document.getElementById('btn-play-again');
  if (playAgainBtn) {
    playAgainBtn.style.display = isHost ? 'inline-flex' : 'none';
  }
}

// Helper: Switch Active Game View
function switchGameView(viewId) {
  document.querySelectorAll('.game-view').forEach(v => v.style.display = 'none');
  const target = document.getElementById(viewId);
  if (target) target.style.display = 'block';
}

// Spawn Floating Reaction Emoji
function spawnFloatingReaction(emoji) {
  const el = document.createElement('div');
  el.className = 'floating-reaction';
  el.textContent = emoji;
  el.style.left = `${Math.random() * 60 + 20}%`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// Confetti Effect
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#ff0080', '#7928ca', '#00f0ff', '#10b981', '#f59e0b', '#ffffff'];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.8) * 18,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 0.4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10
    });
  }

  let animationFrame;
  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      if (p.y < canvas.height) alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (alive) {
      animationFrame = requestAnimationFrame(update);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  update();
}

// -------------------------------------------------------------
// EVENT LISTENERS
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initApp();

  // Create Room
  document.getElementById('btn-create-room').addEventListener('click', () => {
    if (!currentUser.nickname) {
      showToast('Digite um apelido!');
      return;
    }
    socket.emit('create_room', {
      nickname: currentUser.nickname,
      avatar: currentUser.avatar
    });
  });

  // Join Room
  document.getElementById('btn-join-room').addEventListener('click', () => {
    const code = document.getElementById('input-room-code').value.trim();
    if (!code) {
      showToast('Digite o código da sala!');
      return;
    }
    if (!currentUser.nickname) {
      showToast('Digite um apelido!');
      return;
    }
    socket.emit('join_room', {
      code,
      nickname: currentUser.nickname,
      avatar: currentUser.avatar
    });
  });

  // Copy Code
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.code).then(() => {
      showToast(`Código ${currentRoom.code} copiado!`);
    });
  });

  // Copy Invite Link
  document.getElementById('btn-copy-link').addEventListener('click', () => {
    if (!currentRoom) return;
    const link = `${window.location.origin}/?sala=${currentRoom.code}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('Link de convite copiado! Envie no WhatsApp ou Discord 🚀');
    });
  });

  // Host Change Settings
  const settingRounds = document.getElementById('setting-rounds');
  const settingTimer = document.getElementById('setting-timer');
  const settingDiff = document.getElementById('setting-difficulty');

  [settingRounds, settingTimer, settingDiff].forEach(el => {
    el.addEventListener('change', () => {
      if (!isHost) return;
      socket.emit('update_settings', {
        rounds: settingRounds.value,
        timerSeconds: settingTimer.value,
        difficulty: settingDiff.value
      });
    });
  });

  // Host Start Game
  document.getElementById('btn-start-game').addEventListener('click', () => {
    if (!isHost) return;
    socket.emit('start_game');
  });

  // Jogo 1 (Não Responda): Submit Answer
  const inputNrAnswer = document.getElementById('input-nr-answer');
  const btnNrSubmit = document.getElementById('btn-nr-submit');

  function submitNrAnswer() {
    const val = inputNrAnswer.value.trim();
    if (!val) {
      showToast('Digite uma resposta antes de enviar!');
      return;
    }
    socket.emit('submit_answer', { answer: val });
    inputNrAnswer.disabled = true;
    btnNrSubmit.disabled = true;
    btnNrSubmit.textContent = 'Enviado! ✔';
    showToast('Resposta enviada! Torça para ninguém responder igual.');
    if (window.soundEngine) window.soundEngine.playPop();
  }

  btnNrSubmit.addEventListener('click', submitNrAnswer);
  inputNrAnswer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitNrAnswer();
  });

  // Jogo 2 (3 Dicas): Submit Guess
  const inputTdGuess = document.getElementById('input-td-guess');
  const btnTdSubmit = document.getElementById('btn-td-submit');

  function submitTdGuess() {
    const val = inputTdGuess.value.trim();
    if (!val) return;
    socket.emit('submit_guess', { guess: val }, (res) => {
      if (res && !res.success) {
        showToast(res.message);
      }
    });
    inputTdGuess.value = '';
  }

  btnTdSubmit.addEventListener('click', submitTdGuess);
  inputTdGuess.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTdGuess();
  });

  // Jogo 3 (Senha): Submit Guess
  const inputSenhaGuess = document.getElementById('input-senha-guess');
  const btnSenhaSubmit = document.getElementById('btn-senha-submit');

  function submitSenhaGuess() {
    const val = inputSenhaGuess.value.trim();
    if (!/^\d{4}$/.test(val)) {
      showToast('A senha precisa ter exatamente 4 números!');
      return;
    }
    socket.emit('submit_guess', { guess: val }, (res) => {
      if (res && !res.success) {
        showToast(res.message);
      }
    });
    inputSenhaGuess.value = '';
    inputSenhaGuess.focus();
  }

  btnSenhaSubmit.addEventListener('click', submitSenhaGuess);
  inputSenhaGuess.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitSenhaGuess();
  });

  // Jogo 4 (Botão Rápido): Buzzer press & Option selection
  document.getElementById('btn-giant-buzzer').addEventListener('click', () => {
    socket.emit('press_buzzer');
  });

  document.querySelectorAll('.br-option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      socket.emit('submit_buzzer_answer', { optionIndex: idx });
      document.querySelectorAll('.br-option-btn').forEach(b => b.disabled = true);
    });
  });

  // Reactions buttons
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const emoji = e.currentTarget.getAttribute('data-emoji');
      socket.emit('send_reaction', { emoji });
    });
  });

  // Podium Buttons
  document.getElementById('btn-play-again').addEventListener('click', () => {
    if (!isHost) return;
    socket.emit('start_game');
  });

  document.getElementById('btn-back-lobby').addEventListener('click', () => {
    if (isHost) {
      socket.emit('return_to_lobby');
    } else {
      showScreen('lobby');
    }
  });

  // Brand Logo Click
  document.getElementById('btn-logo-home').addEventListener('click', () => {
    if (confirm('Deseja voltar para a tela inicial?')) {
      window.location.href = '/';
    }
  });
});
