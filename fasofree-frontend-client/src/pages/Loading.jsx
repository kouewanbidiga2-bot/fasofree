/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

export default function Loading() {
  return (
    <section className="koliwa-loading" role="status">
      <div className="koliwa-loading-stage">
        <div className="koliwa-loading-title">
          <img src="/koliwa-wordmark.svg" width="175" height="44" alt="Koliwa" />
        </div>
        <div className="koliwa-loading-scene" aria-hidden="true">
          <div className="koliwa-loading-track">
            <img src="/koliwa-courier-splash.svg" width="316" height="188" alt="" />
          </div>
        </div>
        <p className="koliwa-loading-status">Chargement…</p>
      </div>
    </section>
  );
}
