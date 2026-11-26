/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/**
 * Marque Koliwa.
 *
 * Mêmes tracés que les SVG officiels de l'app client
 * (`public/koliwa-wordmark.svg` et `public/koliwa-mark.svg`), mais rendus en
 * React : le wordmark hérite de `currentColor` (donc lisible sur fond craie
 * comme sur fond encre) et le symbole garde ses deux tons crème/sable.
 */

/** Symbole seul — à poser dans une pastille sombre. */
export const KoliwaMark = ({ size = 40, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 140 140"
    className={className}
    role="img"
    aria-label="Koliwa"
    focusable="false"
  >
    <g fill="#FFF1DD">
      <path d="M42 37 L58 25 L58 62 C52 66 46 70 42 76 Z" />
      <path d="M56 68 L62 71 L52 79 L59 87 L58 115 C45 112 37 107 38 98 C39 88 46 77 56 68 Z" />
      <path d="M72 72 C83 78 95 96 111 115 L93 115 C89 115 86 112 83 108 L60 83 Z" />
    </g>
    <g fill="#D5A453">
      <path d="M34 114 C28 99 39 90 54 81 L60 86 C52 93 41 100 34 114 Z" />
      <path d="M57 64 C69 57 79 51 88 39 C91 35 100 34 112 29 C103 47 90 60 74 69 L70 63 L63 61 L58 66 Z" />
    </g>
  </svg>
);

/** Wordmark complet « Koliwa » — prend la couleur du texte parent. */
export const KoliwaWordmark = ({ height = 26, className = '', label = 'Koliwa' }) => (
  <svg
    height={height}
    viewBox="0 0 175 44"
    fill="currentColor"
    className={className}
    role="img"
    aria-label={label}
    focusable="false"
    preserveAspectRatio="xMinYMid meet"
  >
    <g>
      <path d="M 3.4 7.2 L 11.2 5.8 L 11.2 21.1 L 25.4 6.1 L 35.1 6.1 L 19.1 22.6 L 36.2 39.9 L 26.3 39.9 L 11.2 24.6 L 11.2 39.9 L 3.4 39.9 Z" />
      <path
        fillRule="evenodd"
        d="M 51.7 12.1 C 60.2 12.1 65.9 17.7 65.9 25.9 C 65.9 34.8 59.6 40.5 51.1 40.5 C 42.7 40.5 37.1 34.9 37.1 26.7 C 37.1 18.2 43.1 12.1 51.7 12.1 Z M 51.5 18.5 C 47.1 18.5 44.3 21.7 44.3 26.6 C 44.3 31.3 46.9 34.1 51.3 34.1 C 55.8 34.1 58.7 30.8 58.7 25.9 C 58.7 21.3 55.9 18.5 51.5 18.5 Z"
      />
      <path d="M 71.0 5.2 L 78.2 3.9 L 78.2 31.7 C 78.2 33.4 79.1 34.0 80.7 34.0 L 82.2 33.7 L 82.2 39.6 C 80.9 40.1 79.6 40.4 78.1 40.4 C 73.0 40.4 71.0 37.8 71.0 32.6 Z M 86.3 14.4 L 93.5 13.1 L 93.5 39.9 L 86.3 39.9 Z M 86.0 5.1 C 86.0 3.8 86.9 3.0 88.0 2.8 L 91.5 2.1 C 92.9 1.9 93.7 2.8 93.7 4.1 L 93.7 7.3 C 93.7 8.5 92.9 9.3 91.8 9.5 L 88.4 10.1 C 87.0 10.4 86.0 9.5 86.0 8.2 Z M 97.7 13.1 L 105.1 13.1 L 110.1 30.6 L 115.6 13.1 L 122.4 13.1 L 128.0 30.5 L 132.9 13.1 L 140.0 13.1 L 131.5 39.9 L 124.4 39.9 L 118.9 23.3 L 113.4 39.9 L 106.1 39.9 Z" />
    </g>
    <path
      fillRule="evenodd"
      d="M 154.8 12.1 C 159.1 12.1 162.9 13.8 165.4 16.8 L 166.5 13.0 L 172.4 13.0 L 172.4 40.0 L 165.7 40.0 L 165.7 36.8 C 163.0 39.5 159.3 40.6 154.8 40.6 C 146.3 40.6 140.0 34.5 140.0 26.4 C 140.0 18.2 146.3 12.1 154.8 12.1 Z M 146.6 26.5 L 149.0 24.7 L 146.6 24.7 C 145.5 24.7 144.8 23.9 144.8 22.9 L 150.9 22.9 L 152.5 23.7 C 153.6 22.1 156.2 21.8 158.6 23.0 L 157.4 20.2 L 154.4 20.2 L 154.4 18.3 L 158.8 18.3 L 162.0 26.0 C 164.9 25.2 167.8 27.5 167.8 30.5 C 167.8 33.0 165.8 35.0 163.3 35.0 C 160.8 35.0 158.8 33.0 158.8 30.5 C 158.8 29.2 159.3 28.1 160.3 27.2 L 159.6 25.7 L 156.9 28.8 L 152.5 28.8 C 153.7 31.8 151.5 35.0 148.3 35.0 C 145.8 35.0 143.8 33.0 143.8 30.5 C 143.8 28.7 144.9 27.2 146.6 26.5 Z M 146.7 30.5 C 146.7 28.4 149.9 28.4 149.9 30.5 C 149.9 32.6 146.7 32.6 146.7 30.5 Z M 161.7 30.5 C 161.7 28.4 164.9 28.4 164.9 30.5 C 164.9 32.6 161.7 32.6 161.7 30.5 Z"
    />
  </svg>
);

export default KoliwaWordmark;
