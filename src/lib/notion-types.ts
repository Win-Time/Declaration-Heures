/** Types partagés entre le serveur et les composants clients. */

export type ClientOption = { id: string; name: string };

export type DeclarationResult = {
  declarationId: string;
  clientName: string;
  totalMinutes: number;
  /** Forfait mensuel en heures, null si le client n'a pas de contrat exploitable. */
  forfaitHours: number | null;
  /** Minutes cumulées sur le mois en cours, déclaration créée incluse. */
  consumedMinutes: number;
};
