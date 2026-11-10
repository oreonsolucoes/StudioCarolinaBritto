// Ícones em SVG (sprite img/icones.svg). Uso: ic('unha')  ->  <svg class="ic"><use .../></svg>
// A cor vem do texto ao redor (currentColor); o tamanho, da classe .ic (1.1em).
export const ic = (nome, extra = '') =>
  `<svg class="ic ${extra}" aria-hidden="true"><use href="img/icones.svg#${nome}"/></svg>`;
