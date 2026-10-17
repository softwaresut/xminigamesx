// Minijogo: Adivinhe o Filme pelos Emojis
(function () {
  makeGuessGame({
    id: 'emoji-filme',
    name: 'Emoji → Filme',
    emoji: '🎬',
    cat: 'quiz',
    desc: 'Descubra o filme a partir de uma sequência de emojis. Digite o nome correto o mais rápido possível!',
    deck: () => window.FILMES_EMOJI_DATA || [],
    answers: (item) => item.accepted || [item.answer],
    prompt: (item) => ({ emojis: item.emojis }),
    renderPrompt: (prompt, esc) => `
      <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--cyan-glow); margin-bottom: 8px;">Qual é o filme?</div>
      <div style="font-size: 3.5rem; letter-spacing: 8px; margin: 12px 0; text-align: center;">${prompt.emojis}</div>`
  });
})();
