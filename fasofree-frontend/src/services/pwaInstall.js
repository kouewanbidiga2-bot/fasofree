/**
 * Capture GLOBALE de l'événement `beforeinstallprompt` (installation PWA).
 *
 * ⚠️ Pourquoi un MODULE et pas un `useEffect` de composant :
 * `beforeinstallprompt` n'est émis qu'UNE SEULE FOIS par chargement de page, et
 * très tôt (dès que le manifeste est validé). Si aucun écouteur n'est branché à
 * cet instant — cas réel : l'utilisateur est sur /login (aucun bouton monté) —
 * l'événement est PERDU DÉFINITIVEMENT : Chrome ne le réémet pas après une
 * navigation SPA. Résultat observé : « le bouton Installer n'apparaît jamais ».
 *
 * On capture donc au tout début du chargement (importé depuis `main.jsx`) et les
 * composants ne font que s'abonner à cet état.
 */

let deferredPrompt = null;
let installed = false;
let snapshot = { canInstall: false, installed: false };
const listeners = new Set();

function isStandalone() {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

function refresh() {
  snapshot = { canInstall: !!deferredPrompt, installed };
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  installed = isStandalone();
  snapshot = { canInstall: false, installed };

  window.addEventListener('beforeinstallprompt', (event) => {
    // Indispensable : empêche la mini-infobar native de Chrome et permet
    // d'afficher notre propre bouton « Installer l'app ».
    event.preventDefault();
    deferredPrompt = event;
    refresh();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    refresh();
  });
}

/** État courant (snapshot stable — requis par `useSyncExternalStore`). */
export function getInstallState() {
  return snapshot;
}

/** S'abonner aux changements d'état. Retourne une fonction de désabonnement. */
export function subscribeInstall(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Déclenche le prompt d'installation natif. Consommé après usage. */
export async function promptInstall() {
  if (!deferredPrompt) return null;
  deferredPrompt.prompt();
  let outcome = null;
  try {
    const choice = await deferredPrompt.userChoice;
    outcome = choice?.outcome ?? null;
  } catch {
    outcome = null;
  } finally {
    // Un prompt ne peut jamais être rejoué : on le consomme dans tous les cas.
    deferredPrompt = null;
    refresh();
  }
  return outcome;
}
