// Minijogo: Complete a Música
(function () {
  makeGuessGame({
    id: 'musica',
    name: 'Complete a Música',
    emoji: '🎵',
    cat: 'quiz',
    desc: 'Continue a letra do clássico musical antes que o tempo acabe!',
    deck: () => window.MUSICAS_DATA || [],
    answers: (item) => item.accepted || [item.answer],
    prompt: (item) => ({ intro: item.intro }),
    renderPrompt: (prompt, esc) => `
      <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--magenta-glow); margin-bottom: 8px;">Complete o trecho musical:</div>
      <div style="font-size: 1.35rem; font-weight: 700; line-height: 1.5; margin: 14px 0; text-align: center;">🎵 "${esc(prompt.intro)}" ... 🎶</div>`
  });
})();
