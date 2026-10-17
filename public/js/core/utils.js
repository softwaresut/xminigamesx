// xMiniGamesx - utilitários compartilhados (texto, sorteio, fuzzy match, HTML seguro)
(function () {
  const U = {};

  // Normaliza texto: minúsculas, sem acentos, só letras/números/espaço simples
  U.norm = (s) => (s == null ? '' : String(s))
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Normaliza sem espaços e sem artigos iniciais comuns ("o titanic" == "titanic")
  U.tight = (s) => U.norm(s)
    .replace(/^(o|a|os|as|um|uma|the) /, '')
    .replace(/ /g, '');

  U.lev = (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  };

  // Compara uma resposta com uma lista de respostas aceitas tolerando erros de digitação.
  // ratio = fração do tamanho permitida como erro (0.2 = 20%)
  U.fuzzy = (input, answers, ratio = 0.2) => {
    const t = U.tight(input);
    if (!t) return false;
    return (Array.isArray(answers) ? answers : [answers]).some((ans) => {
      const a = U.tight(ans);
      if (!a) return false;
      if (a === t) return true;
      const allowed = a.length <= 3 ? 0 : Math.max(1, Math.floor(a.length * ratio));
      return U.lev(t, a) <= allowed;
    });
  };

  U.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

  U.roomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  };

  // Escapa HTML: tudo que vem de outro jogador (apelido, respostas, chat) passa por aqui
  U.esc = (s) => (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  U.clip = (s, n) => (s == null ? '' : String(s)).trim().slice(0, n);

  window.U = U;
})();
