// Mascote do HiperNotes — mesmo traço da lupinha do Lupa Redação (círculo,
// olhinhos, sorriso), com o capelo de formatura como detalhe que identifica
// o produto. Cores fixas (não usa currentColor) porque tem dois tons: o
// accent do app pro círculo/rosto e um marrom pro capelo.
export function Mascot({ size = 96, cls = "" } = {}) {
  return `<svg class="mascot ${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="46" r="28" stroke="var(--accent)" stroke-width="5"/>
    <path d="M50 12 L78 22 L50 32 L22 22 Z" stroke="#6b4a35" stroke-width="5" stroke-linejoin="round"/>
    <path d="M50 32 L50 40" stroke="#6b4a35" stroke-width="4" stroke-linecap="round"/>
    <path d="M39 44 q5 -6 10 0" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
    <path d="M53 44 q5 -6 10 0" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
    <path d="M41 54 q9 8 18 0" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
  </svg>`;
}
