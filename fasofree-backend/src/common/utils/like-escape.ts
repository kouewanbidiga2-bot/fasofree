/**
 * Échappe les wildcards SQL LIKE (`%`, `_`, `\`) dans un terme de recherche.
 *
 * Sans échappement, un identifiant saisi par l'utilisateur tel que "%" ou "_"
 * se comporterait comme un masque LIKE et matcherait toutes les lignes
 * (injection de masque / fuite de données).
 *
 * À utiliser conjointement avec `ESCAPE '\'` dans la requête :
 *   ... WHERE LOWER(name) LIKE LOWER(:name) ESCAPE '\'
 */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (m) => `\\${m}`);
}