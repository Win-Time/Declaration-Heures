/** Types partagés entre le serveur et les composants clients. */

export type ClientOption = { id: string; name: string };

export type DeclarationResult = {
  declarationId: string;
  clientName: string;
  totalMinutes: number;
};
