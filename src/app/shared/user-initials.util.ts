/**
 * Extrae las iniciales de un nombre de usuario o email.
 * Devuelve máximo 2 caracteres en mayúscula.
 * Ejemplos:
 *  - "juan.perez@example.com" -> "JP"
 *  - "maria santos" -> "MS"
 *  - "carlos" -> "C"
 */
export function getUserInitials(username: string | null | undefined): string {
  if (!username) {
    return '';
  }

  const parts = username.split(/[\s@._-]+/).filter((part) => part.length > 0);

  if (parts.length === 0) {
    return '';
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);
}
