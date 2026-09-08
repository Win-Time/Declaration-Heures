/**
 * Trait de coche dessiné au stroke-dashoffset.
 *
 * Repris de transitions.dev n°25 (checkbox check) : `--check-len` doit valoir
 * la longueur réelle du chemin (`path.getTotalLength()`, arrondie au supérieur)
 * pour que le trait ne se pré-révèle pas ni ne dépasse.
 */
export function CheckMark() {
  return (
    <span className="wt-check" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 10.1668 10.1668">
        {/* getTotalLength() ≈ 14.3 → --check-len: 15 (valeur par défaut du CSS) */}
        <path d="M1 5.52L3.92 9.17L9.17 1" />
      </svg>
    </span>
  );
}
