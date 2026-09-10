/** Types partagés entre le serveur et les composants clients. */

/** Ce que le navigateur reçoit : de quoi afficher et choisir, rien de plus. */
export type ClientChoice = {
  /** ID de la page Client. */
  id: string;
  name: string;
};

/**
 * Version serveur : porte en plus le contrat par lequel ce client est rattaché
 * à l'assistante. Cet ID ne quitte jamais le serveur — la déclaration le
 * retrouve elle-même à partir du client choisi.
 */
export type ClientOption = ClientChoice & { contratId: string };

export type DeclarationResult = {
  declarationId: string;
  clientName: string;
  totalMinutes: number;
};
