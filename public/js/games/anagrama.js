// Minijogo: Anagrama Insano (Palavras Embaralhadas)
(function () {
  function scramble(word) {
    const arr = word.split('');
    let s;
    for (let i = 0; i < 10; i++) {
      s = U.shuffle(arr).join('');
      if (s !== word) return s;
    }
    return arr.reverse().join('');
  }

  makeGuessGame({
    id: 'anagrama',
    name: 'Anagrama Insano',
    emoji: '🔤',
    cat: 'quiz',
    desc: 'Desembaralhe as letras da palavra secreta com base na dica!',
    deck: () => (window.ANAGRAMAS_DATA || []).map((item) => ({
      word: item.word,
      clue: item.clue,
      scrambled: scramble(item.word)
    })),
    answers: (item) => [item.word],
    prompt: (item) => ({ scrambled: item.scrambled, clue: item.clue }),
    renderPrompt: (prompt, esc) => `
      <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--amber-glow); margin-bottom: 8px;">Dica: ${esc(prompt.clue)}</div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 2.8rem; font-weight: 900; letter-spacing: 10px; margin: 14px 0; text-align: center; color: var(--cyan-glow);">${esc(prompt.scrambled)}</div>`
  });
})();
