import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit:action';

export interface AuditMetadata {
  /** Ex. 'user.delete' */
  action: string;
  /** Ex. 'USER' */
  entityType?: string;
  /** Nom du paramètre de route portant l'identifiant (défaut : 'id') */
  entityParam?: string;
}

/**
 * 🧾 Marque une route comme auditable.
 *
 * Choix d'implémentation : marquage **explicite et opt-in** plutôt qu'un
 * branchement automatique sur « toutes les méthodes mutantes ». Une route
 * non annotée n'est jamais journalisée et aucun comportement existant n'est
 * modifié → risque de régression quasi nul.
 */
export const Audited = (meta: AuditMetadata) =>
  SetMetadata(AUDIT_METADATA_KEY, meta);
