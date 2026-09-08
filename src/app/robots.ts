import type { MetadataRoute } from "next";

/**
 * On autorise l'exploration tout en interdisant l'indexation.
 *
 * C'est volontaire : un `Disallow` empêche le robot de lire la page, donc de
 * voir la directive `noindex`, et Google peut alors indexer l'URL seule si un
 * lien pointe dessus. Laisser explorer garantit au contraire que le `noindex`
 * (balise meta + en-tête `X-Robots-Tag`) est bien reçu et respecté.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
  };
}
