// xMiniGamesx - transporte P2P (PeerJS). Só move mensagens; a lógica fica no engine do anfitrião.
(function () {
  const PEER_PREFIX = 'xmg-';
  const PEER_OPTS = {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };

  class Net {
    constructor() {
      this.peer = null;
      this.id = null;
      this.isHost = false;
      this.conns = new Map(); // host: peerId -> DataConnection
      this.hostConn = null;   // convidado: conexão com o anfitrião
      this.handlers = {};
    }

    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); }
    emit(type, ...args) { (this.handlers[type] || []).forEach((fn) => { try { fn(...args); } catch (e) { console.error(e); } }); }

    // Anfitrião: registra o ID público da sala (xmg-abcd)
    host(code) {
      return new Promise((resolve, reject) => {
        const peer = new Peer(PEER_PREFIX + code.toLowerCase(), PEER_OPTS);
        let opened = false;

        peer.on('open', (id) => {
          opened = true;
          this.peer = peer;
          this.id = id;
          this.isHost = true;
          resolve(id);
        });

        peer.on('error', (err) => {
          if (!opened) { peer.destroy(); reject(err); return; }
          console.warn('[Net] host error', err.type);
        });

        peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });

        peer.on('connection', (conn) => {
          conn.on('open', () => this.conns.set(conn.peer, conn));
          conn.on('data', (msg) => this.emit('msg', conn.peer, msg));
          conn.on('close', () => { this.conns.delete(conn.peer); this.emit('leave', conn.peer); });
          conn.on('error', () => { /* tratado no close */ });
        });
      });
    }

    // Convidado: conecta no ID da sala
    join(code) {
      return new Promise((resolve, reject) => {
        const peer = new Peer(PEER_OPTS);
        let done = false;
        const fail = (msg) => { if (done) return; done = true; peer.destroy(); reject(new Error(msg)); };
        const timeout = setTimeout(() => fail('Tempo esgotado. Confira o código da sala.'), 12000);

        peer.on('open', (id) => {
          this.peer = peer;
          this.id = id;
          const conn = peer.connect(PEER_PREFIX + code.toLowerCase(), { reliable: true });
          conn.on('open', () => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            this.hostConn = conn;
            resolve(id);
          });
          conn.on('data', (msg) => this.emit('msg', 'host', msg));
          conn.on('close', () => this.emit('hostLost'));
          conn.on('error', () => { /* tratado no close/timeout */ });
        });

        peer.on('error', (err) => {
          if (err.type === 'peer-unavailable') fail('Sala não encontrada. Confira o código!');
          else if (!done) fail('Erro de conexão: ' + err.type);
          else console.warn('[Net] guest error', err.type);
        });
      });
    }

    send(peerId, msg) {
      const c = this.conns.get(peerId);
      if (c && c.open) c.send(msg);
    }

    toHost(msg) {
      if (this.hostConn && this.hostConn.open) this.hostConn.send(msg);
    }

    destroy() {
      try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
    }
  }

  window.Net = Net;
})();
