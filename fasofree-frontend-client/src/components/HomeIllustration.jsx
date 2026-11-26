import { useId } from 'react';
import { Cloud } from 'lucide-react';

const awningStripes = Array.from({ length: 12 }, (_, index) => {
  const left = 171 + index * 39;
  const right = left + 39;
  const bottom = 233 + index * 3;
  const top = 165 + index * 3.7;
  const topLeft = 174 + index * 31.5;
  return `M${topLeft} ${top}
    L${topLeft + 31.5} ${top + 3.7}
    L${right} ${bottom + 3}
    v10 Q${right} ${bottom + 25} ${left + 20} ${bottom + 24}
    Q${left} ${bottom + 22} ${left} ${bottom + 8}Z`;
});

export default function HomeIllustration() {
  const brickPattern = useId();
  return (
    <figure className="kw-poster-art">
      <div className="kw-poster-ground" aria-hidden="true" />
      <Cloud className="kw-poster-cloud kw-poster-cloud--start" aria-hidden="true" />
      <Cloud className="kw-poster-cloud kw-poster-cloud--end" aria-hidden="true" />
      <svg className="kw-storefront-drawing" viewBox="0 0 700 466" role="img" aria-label="Devanture du relais Koliwa surmontée d’un colis souriant">
        <defs>
          <pattern id={brickPattern} width="62" height="28" patternUnits="userSpaceOnUse" patternTransform="skewY(3)">
            <path d="M0 0H62M0 14H62M0 28H62M31 0V14M0 14V28M62 14V28" fill="none" stroke="currentColor" strokeWidth="2.5" />
          </pattern>
        </defs>

        <g fill="#f8f3e4" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round">
          <path d="M64 269 169 215 621 247 618 432 169 451 66 430Z" />
          <path d="M66 279 168 236 168 445 68 424Z" fill="#eee8d6" />
          <path d="M67 275 169 232 620 260 617 428 170 445 67 424Z" fill={`url(#${brickPattern})`} />
          <path d="M169 230 169 448M178 230 178 447" />
          <path d="M26 436 169 453 648 437 669 441 171 462 22 444Z" />

          <path d="M81 286 151 261 152 401 82 407Z M91 293 141 276 142 392 92 397Z" fill="#fffbf0" />
          <path d="M205 273 394 285 393 388 204 385Z M216 285 383 296 382 376 215 373Z" fill="#fffbf0" />
          <path d="M519 292 604 297 602 411 519 412Z M530 303 593 308 591 399 530 400Z" fill="#fffbf0" />
          <path d="M416 285 502 290 501 438 415 442Z M427 298 490 302 490 427 427 430Z" fill="#fffbf0" />
          <path d="M411 438 501 434 517 445 432 450 404 445Z" />
          <path d="M480 351q9-6 9 3v19q-2 8-9 3z" fill="#e8e0cf" />
          <path d="M104 351l29-32m-24 47 24-26m96-26 25-25m-25 49 44-44m54 68 39-42m-27 42 27-29m177 28 38-39m-39 53 23-24m-121 8 33-35m-34 21 23-24" fill="none" strokeWidth="3.2" />

          <path d="M232 351l36-2 13 9v16l-36 1-13-8zM232 351l13 8 36-1m-36 1v16M289 356l25-1 9 5v16l-25 1-9-5zM289 356l9 6 25-2m-25 2v15" strokeWidth="2.4" fill="#eee6d2" />
          <path className="kw-storefront-accent" d="M251 351l11-1 13 8-11 1zM300 356l7-.5 9 5.5-7 .5z" stroke="none" />

          <path d="M43 264 172 160 557 205 556 215 174 172 43 277Z" />
          <path d="M43 264 174 165 171 233V245Q169 262 149 257Q139 274 121 268Q111 284 97 276Q86 292 72 286Q60 305 48 297Q37 292 41 278Z" fill="#eee8d6" />
          <path d="M43 278 171 233M73 268l94-96M97 259l71-84M121 251l50-78M149 241l25-70M72 271v15m25-24v14m24-22v14m28-23v12" fill="none" strokeWidth="3.6" />
          {awningStripes.map((path, index) => (
            <path key={path} d={path} fill={index % 2 ? '#efe7d4' : '#fffaed'} strokeWidth="4" />
          ))}

          <path d="M197 60 207 62 210 157 195 164Z" fill="#e8dfca" />
          <path d="M207 62 548 129 552 206 195 164Z" />

          <path d="M302 86 308 30 349 9 441 32 432 109 394 125Z" fill="#fffaed" />
          <path d="M308 30 398 50 394 125 302 103Z" />
          <path d="M398 50 441 32 432 109 394 125Z" fill="#e8dfca" />
          <path className="kw-storefront-accent" d="M365 13 387 19 346 38 343 55 335 49 326 52 328 34Z" strokeWidth="2.8" />
          <ellipse cx="327" cy="69" rx="4.3" ry="6" fill="currentColor" stroke="none" />
          <ellipse cx="372" cy="79" rx="4.3" ry="6" fill="currentColor" stroke="none" />
          <path d="M340 79q8 13 18 3m-70-43-11-13m4 27-16-7m188 17 12-10m-9 23 15-3" fill="none" strokeWidth="3.7" />
          <path d="M287 88c7-12 28-8 32 3 1 7-6 11-11 8-4 2-8 0-9-4-8 1-14-1-12-7ZM410 112c7-12 28-7 31 5 1 6-5 9-10 6-5 2-8-1-10-4-6 2-13-1-11-7Z" />

          <path d="M75 92c-21 3-30-12-19-23 4-5 10-6 17-5-1-16 15-24 27-17 9-20 40-16 47 2 15-3 27 7 24 18-3 9-12 12-21 12-12 17-34 17-46 5-9 8-20 11-29 8ZM550 134c-13-4-15-21-3-27 7-4 12-3 18-3 0-15 13-20 25-16 9-21 38-16 45 2 17-3 32 8 29 19-2 9-10 14-21 14-12 16-34 15-46 3-13 7-25 10-47 8Z" />
          <path d="M27 436c-8-7-4-17 3-22-3-10 3-17 12-19-3-12 11-22 20-13 7-12 23-7 24 5 8 2 12 7 11 16 14 2 18 15 14 21 7 4 8 15 1 22zM598 435c-14-5-12-17-6-22-5-11 3-21 12-20-1-13 13-20 21-11 6-15 22-10 27-1 8-2 16 4 15 12 14 0 20 13 13 20 6 8-1 17-10 23z" />
          <path d="M50 423l-5-6m23 10 3-7m22 16-5-4m538-12-5-5m19 6 4-6m16 12-2 5" fill="none" strokeWidth="3.4" />
        </g>
      </svg>
      <span className="kw-poster-sign" aria-hidden="true">Koliwa</span>
    </figure>
  );
}

