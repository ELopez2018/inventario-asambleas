interface ProblemViolation {
  field?: string;
  name?: string;
  message?: string;
  userMessage?: string;
}

interface ProblemDetail {
  userMessage?: string;
  detail?: string;
  message?: string;
  title?: string;
  violations?: ProblemViolation[] | Record<string, string>;
}

/**
 * Obtiene el mensaje para el usuario de una respuesta `application/problem+json`,
 * incluyendo las `violations` de campos. Usa `fallback` si el backend no envía mensaje.
 */
export function resolveProblemMessage(err: unknown, fallback: string): string {
  const problem = (err as { error?: ProblemDetail | null } | null)?.error;
  if (!problem || typeof problem !== 'object') return fallback;

  const main = problem.userMessage ?? problem.detail ?? problem.message ?? problem.title ?? fallback;
  const violations = Array.isArray(problem.violations)
    ? problem.violations
        .map((v) => {
          const text = v.userMessage ?? v.message;
          const field = v.field ?? v.name;
          return text ? (field ? `${field}: ${text}` : text) : null;
        })
        .filter((text): text is string => !!text)
    : problem.violations
      ? Object.entries(problem.violations).map(([field, text]) => `${field}: ${text}`)
      : [];

  return violations.length ? `${main} ${violations.join('. ')}` : main;
}
