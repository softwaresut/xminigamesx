const NaoRespondaGame = require('./games/naoResponda');
const TresDicasGame = require('./games/tresDicas');
const JogoSenhaGame = require('./games/jogoSenha');
const BotaoRapidoGame = require('./games/botaoRapido');

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous 0/O, 1/I
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

class Room {
  constructor(code, hostPlayer, io) {
    this.code = code;
    this.io = io;
    this.hostId = hostPlayer.id;
    this.players = new Map(); // socketId -> { id, nickname, avatar, score, isHost, connected }
    this.selectedGame = 'nao-responda';
    this.settings = {
      rounds: 5,
      timerSeconds: 20,
      difficulty: 'facil'
    };
    this.state = 'LOBBY'; // 'LOBBY' | 'IN_GAME'
    this.activeGameInstance = null;

    this.addPlayer(hostPlayer);
  }

  addPlayer(playerData) {
    const isHost = playerData.id === this.hostId;
    this.players.set(playerData.id, {
      id: playerData.id,
      nickname: playerData.nickname || 'Jogador',
      avatar: playerData.avatar || '🦊',
      score: 0,
      isHost,
      connected: true
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (this.hostId === socketId && this.players.size > 0) {
      // Transfer host to first remaining player
      const nextHost = this.players.values().next().value;
      this.hostId = nextHost.id;
      nextHost.isHost = true;
    }
  }

  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  getActivePlayers() {
    return Array.from(this.players.values()).filter(p => p.connected);
  }

  addScore(socketId, pts) {
    const p = this.players.get(socketId);
    if (p) {
      p.score += pts;
    }
  }

  resetScores() {
    this.players.forEach(p => {
      p.score = 0;
    });
  }

  getScores() {
    return Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        score: p.score,
        isHost: p.isHost
      }))
      .sort((a, b) => b.score - a.score);
  }

  getPodium() {
    const sorted = this.getScores();
    return sorted.slice(0, 3);
  }

  setGame(gameId) {
    const valid = ['nao-responda', 'tres-dicas', 'jogo-senha', 'botao-rapido'];
    if (valid.includes(gameId)) {
      this.selectedGame = gameId;
      return true;
    }
    return false;
  }

  updateSettings(newSettings) {
    if (newSettings.rounds) this.settings.rounds = Math.max(1, Math.min(15, parseInt(newSettings.rounds)));
    if (newSettings.timerSeconds) this.settings.timerSeconds = Math.max(10, Math.min(60, parseInt(newSettings.timerSeconds)));
    if (newSettings.difficulty) this.settings.difficulty = newSettings.difficulty;
  }

  startGame() {
    if (this.activeGameInstance) {
      this.activeGameInstance.destroy();
    }

    this.state = 'IN_GAME';

    switch (this.selectedGame) {
      case 'tres-dicas':
        this.activeGameInstance = new TresDicasGame(this, this.io);
        break;
      case 'jogo-senha':
        this.activeGameInstance = new JogoSenhaGame(this, this.io);
        break;
      case 'botao-rapido':
        this.activeGameInstance = new BotaoRapidoGame(this, this.io);
        break;
      case 'nao-responda':
      default:
        this.activeGameInstance = new NaoRespondaGame(this, this.io);
        break;
    }

    this.activeGameInstance.start();
  }

  returnToLobby() {
    if (this.activeGameInstance) {
      this.activeGameInstance.destroy();
      this.activeGameInstance = null;
    }
    this.state = 'LOBBY';
    this.io.to(this.code).emit('room_returned_to_lobby', this.getRoomSummary());
  }

  getRoomSummary() {
    return {
      code: this.code,
      hostId: this.hostId,
      players: Array.from(this.players.values()),
      selectedGame: this.selectedGame,
      settings: this.settings,
      state: this.state
    };
  }

  destroy() {
    if (this.activeGameInstance) {
      this.activeGameInstance.destroy();
    }
  }
}

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // code -> Room
    this.socketToRoom = new Map(); // socketId -> code
  }

  createRoom(socketId, nickname, avatar) {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = new Room(code, { id: socketId, nickname, avatar }, this.io);
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);

    return room;
  }

  joinRoom(code, socketId, nickname, avatar) {
    const upperCode = (code || '').toUpperCase().trim();
    const room = this.rooms.get(upperCode);
    if (!room) {
      return { success: false, error: 'Sala não encontrada. Verifique o código!' };
    }

    if (room.state === 'IN_GAME') {
      // Allow joining as spectator or participant if supported
    }

    room.addPlayer({ id: socketId, nickname, avatar });
    this.socketToRoom.set(socketId, upperCode);

    return { success: true, room };
  }

  leaveRoom(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (room) {
      room.removePlayer(socketId);
      this.socketToRoom.delete(socketId);

      if (room.players.size === 0) {
        room.destroy();
        this.rooms.delete(code);
      } else {
        this.io.to(code).emit('room_player_left', {
          socketId,
          room: room.getRoomSummary()
        });
      }
      return code;
    }
    return null;
  }

  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : null;
  }
}

module.exports = RoomManager;
