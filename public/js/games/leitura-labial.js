// Minijogo: Desafio da Leitura Labial
(function () {
  makeGuessGame({
    id: 'leitura-labial',
    name: 'Leitura Labial',
    emoji: '👄',
    cat: 'quiz',
    desc: 'O jogador da vez articula a frase sem som (por vídeo ou presencial). Os outros adivinham!',
    speaker: true,
    minPlayers: 2,
    deck: () => window.LEITURA_LABIAL_DATA || [],
    answers: (item) => item.accepted || [item.phrase],
    prompt: (item, meta) => ({ isSpeaker: meta.isSpeaker, phrase: item.phrase }),
    renderPrompt: (prompt, esc) => {
      if (prompt.isSpeaker) {
        return `
          <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--solar-yellow); margin-bottom: 8px;">Você é o Locutor!</div>
          <div style="font-size: 1.5rem; font-weight: 800; margin: 12px 0; color: var(--acid-lime);">Articule sem som: "${esc(prompt.phrase)}"</div>
          <p class="muted small">Olhe para a câmera ou para seus amigos e mexa a boca com clareza!</p>`;
      }
      return `
        <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--cyan-glow); margin-bottom: 8px;">Preste atenção na boca do locutor!</div>
        <div style="font-size: 2.2rem; margin: 12px 0;">👄 🤫 👀</div>
        <p class="muted small">Descubra o que o jogador da vez está falando sem som e digite abaixo!</p>`;
    }
  });
})();
