const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const RoomManager = require('./roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const roomManager = new RoomManager(io);

// Anti-cache headers to purge old project files from browser cache
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Self-destructing Service Worker handler to unregister old SW from "GAME ABDUÇÃO"
app.get(['/sw.js', '/service-worker.js'], (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (event) => {
      event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .then(() => self.registration.unregister())
          .then(() => self.clients.matchAll())
          .then((clients) => clients.forEach((c) => c.navigate(c.url)))
      );
    });
  `);
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Socket.io Real-time Handlers
io.on('connection', (socket) => {
  console.log(`[Connect] Socket connected: ${socket.id}`);

  // Create room
  socket.on('create_room', ({ nickname, avatar }, callback) => {
    try {
      const room = roomManager.createRoom(socket.id, nickname, avatar);
      socket.join(room.code);
      const summary = room.getRoomSummary();
      if (typeof callback === 'function') callback({ success: true, room: summary });
      socket.emit('room_created', summary);
    } catch (err) {
      console.error(err);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro ao criar sala' });
    }
  });

  // Join room
  socket.on('join_room', ({ code, nickname, avatar }, callback) => {
    try {
      const result = roomManager.joinRoom(code, socket.id, nickname, avatar);
      if (!result.success) {
        if (typeof callback === 'function') callback(result);
        socket.emit('error_message', result.error);
        return;
      }

      socket.join(result.room.code);
      const summary = result.room.getRoomSummary();
      if (typeof callback === 'function') callback({ success: true, room: summary });
      socket.emit('room_joined', summary);

      // Notify others in room
      socket.to(result.room.code).emit('room_player_joined', {
        player: result.room.getPlayer(socket.id),
        room: summary
      });
    } catch (err) {
      console.error(err);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro ao entrar na sala' });
    }
  });

  // Change selected game
  socket.on('select_game', ({ gameId }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (room.setGame(gameId)) {
      io.to(room.code).emit('game_selected', {
        selectedGame: room.selectedGame,
        room: room.getRoomSummary()
      });
    }
  });

  // Update room settings (rounds, timer, difficulty)
  socket.on('update_settings', (settings) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    room.updateSettings(settings);
    io.to(room.code).emit('settings_updated', {
      settings: room.settings
    });
  });

  // Start the selected game
  socket.on('start_game', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    room.startGame();
  });

  // "Não Responda" answer submission
  socket.on('submit_answer', ({ answer }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || !room.activeGameInstance) return;
    if (typeof room.activeGameInstance.submitAnswer === 'function') {
      room.activeGameInstance.submitAnswer(socket.id, answer);
    }
  });

  // Guess submission (Tres Dicas / Jogo Senha)
  socket.on('submit_guess', ({ guess }, callback) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || !room.activeGameInstance) return;
    if (typeof room.activeGameInstance.submitGuess === 'function') {
      const res = room.activeGameInstance.submitGuess(socket.id, guess);
      if (typeof callback === 'function') callback(res);
    }
  });

  // Buzzer press (Botão Rápido)
  socket.on('press_buzzer', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || !room.activeGameInstance) return;
    if (typeof room.activeGameInstance.pressBuzzer === 'function') {
      room.activeGameInstance.pressBuzzer(socket.id);
    }
  });

  // Buzzer answer option submission
  socket.on('submit_buzzer_answer', ({ optionIndex }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || !room.activeGameInstance) return;
    if (typeof room.activeGameInstance.submitAnswer === 'function') {
      room.activeGameInstance.submitAnswer(socket.id, optionIndex);
    }
  });

  // Return to lobby
  socket.on('return_to_lobby', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    room.returnToLobby();
  });

  // Chat message
  socket.on('send_chat', ({ message }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    if (!player || !message || !message.trim()) return;

    io.to(room.code).emit('chat_message', {
      sender: {
        id: player.id,
        nickname: player.nickname,
        avatar: player.avatar
      },
      text: message.trim().slice(0, 140),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Quick Emoji reaction
  socket.on('send_reaction', ({ emoji }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    if (!player) return;

    io.to(room.code).emit('player_reaction', {
      playerId: player.id,
      avatar: player.avatar,
      nickname: player.nickname,
      emoji: emoji || '🎉'
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[Disconnect] Socket disconnected: ${socket.id}`);
    roomManager.leaveRoom(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🎮 xMiniGamesx Party Platform ONLINE!`);
  console.log(`🚀 Acesse: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
