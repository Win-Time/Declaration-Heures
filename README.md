# Win Time — déclaration d'heures

Formulaire web multi-étapes qui permet à une assistante Win Time de déclarer
les heures passées chez ses clients. Lecture et écriture Notion, entièrement
côté serveur.

## Stack

- Next.js 16 (App Router) + TypeScript, déployable sur Vercel
- `@notionhq/client` v5 (API Notion 2025-09-03)
- `motion` pour les animations React ; CSS de transitions pour le reste

## Variables d'environnement

```
NOTION_TOKEN=            # token d'intégration interne Notion
NOTION_DB_ASSISTANTES=   # ID de la base Assistantes
NOTION_DB_CLIENTS=       # ID de la base Clients
NOTION_DB_DECLARATIONS=  # ID de la base Déclarations
NOTION_DB_CONTRATS=      # ID de la base Contrats
SESSION_SECRET=          # optionnel — clé HMAC du cookie de session
```

Sans `SESSION_SECRET`, la clé de signature du cookie est dérivée de
`NOTION_TOKEN`. Sur Vercel, définir les cinq premières variables dans les
réglages du projet ; l'intégration Notion doit être partagée avec les quatre
bases.

Le SDK Notion v5 interroge des *data sources*, plus des bases : l'application
résout automatiquement la data source de chaque base au premier appel et la
met en cache. Les variables restent donc des IDs de base.

## Développement

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev
```

`npm run build` pour la vérification de production, `npm run typecheck` pour
TypeScript seul.

## Propriétés Notion attendues

| Base | Propriété | Type | Rôle |
|---|---|---|---|
| Assistantes | `Téléphone` | Rich text (ou téléphone) | identifiant de connexion |
| Assistantes | `Clients` | Relation → Clients | clients assignés |
| Clients | `Contrat` | Relation → Contrats | contrat(s) du client |
| Contrats | `Forfait (h)` | Number | volume mensuel prévu |
| Déclarations | `Période de déclaration` | Date (début + fin) | période déclarée |
| Déclarations | `Assistante déclarante` | Relation → Assistantes | autrice de la déclaration |
| Déclarations | `Client` | Relation → Clients | client concerné |
| Déclarations | `Total minutes` | Number | temps en minutes entières |

Les noms sont centralisés en haut de `src/lib/notion.ts` : c'est le seul
endroit à modifier si une propriété est renommée dans Notion.

## Parcours

1. **Identification** — un champ téléphone. La saisie et la valeur Notion sont
   normalisées avant comparaison (chiffres uniquement, comparaison sur les 9
   derniers, donc `+33` ≡ `0`). Trouvée : l'ID de page de l'assistante part
   dans un cookie httpOnly signé. Non trouvée : message neutre, sans révéler
   si le numéro existe.
2. **Sélection du client** — les clients de l'assistante uniquement, résolus
   depuis la relation `Clients` de sa page. Visuel case à cocher, comportement
   radio : un seul client par déclaration. La liste est mise en cache pour la
   session : revenir à cette étape ou enchaîner une deuxième déclaration ne
   relance pas l'appel.
3. **Saisie** — un seul champ de période, ouvrant un calendrier maison (premier
   clic = début, survol = aperçu de la plage, deuxième clic = fin), et un seul
   champ de temps affiché `HHhMM` qui se remplit par la droite (`215` → 02h15).
4. **Attestation** — case obligatoire avant activation de l'envoi.
5. **Point sur la situation** — cumul du mois calendaire en cours (fuseau
   Europe/Paris, sur la date de début de la période) face au `Forfait (h)` du
   contrat, avec barre de progression animée et état d'alerte en cas de
   dépassement.

## Modèle de sécurité

- Le token Notion ne quitte jamais le serveur ; aucun appel Notion depuis le
  navigateur.
- L'identité de l'assistante vit dans un cookie httpOnly signé en HMAC-SHA256,
  jamais dans le state client.
- `GET /api/clients` n'accepte aucun paramètre : la liste est dérivée de la
  session, il n'existe donc pas de moyen de demander les clients d'une autre
  assistante.
- `POST /api/declaration` revérifie côté serveur que le client déclaré
  appartient bien à l'assistante en session, et revalide période, temps et
  attestation.

## Cas limites

- Téléphone en double dans la base Assistantes : première occurrence retenue,
  avertissement dans les logs serveur.
- Assistante sans client : message clair, pas d'erreur bloquante.
- Client sans contrat ou sans `Forfait (h)` : confirmation affichée sans barre
  de progression, avec un message neutre.
- Rate limit Notion (3 req/s) : toutes les requêtes passent par une file
  d'attente sérialisée avec un écart minimal de 350 ms.
- Échec d'écriture : on reste sur l'étape d'envoi, la saisie est conservée et
  le message propose de réessayer.

## Design et animations

Les tokens `--wt-*` de `src/app/globals.css` reprennent la charte visuelle Win
Time (couleurs, dégradés, Yellowtail / Questrial / Open Sans, rayons). Le logo
est posé sur une pastille blanche : son dégradé framboise → orange est celui du
bandeau, il y disparaîtrait sans fond. `win_time_80_logo.svg` (racine) est la
source ; `public/win-time-logo.svg` en est la copie servie au navigateur, sans
les métadonnées C2PA (10 Ko → 2,6 Ko).

Deux composants sont écrits sur mesure faute d'équivalent dans les repos de
référence :

- `DateRangePicker` — calendrier français (lundi en tête), plage en deux clics
  avec aperçu au survol, déplié dans le flux plutôt qu'en surcouche (la carte
  anime déjà sa hauteur, un panneau flottant y serait rogné). Aucune UI native
  d'OS, dont le rendu varie d'un téléphone à l'autre et qui ne sait pas
  afficher une plage.
- `DurationInput` — champ unique `HHhMM` qui se remplit par la droite, avec
  `00h00` en repère quand il est vide.

Les animations proviennent des deux références imposées, recolorées à la
charte :

- [`Jakubantalik/transitions.dev`](https://github.com/Jakubantalik/transitions.dev)
  (`skills/transitions-dev`, commit `74e5723`) — tokens de mouvement du
  `_root.css`, transition d'étape *page side-by-side* (n°8), *card resize*
  (n°1), *texts reveal* (n°18), *checkbox check* (n°25), *success check*
  (n°10), *error state shake* (n°12), *shimmer text* (n°15). Les gardes
  `prefers-reduced-motion` des snippets sont conservés.
- [`starc007/ui-components`](https://github.com/starc007/ui-components)
  (`components`, commit `04d6f76`) — courbes et ressorts de `lib/ease.ts`
  (`SPRING_PRESS`, `EASE_OUT`), retour tactile des boutons et cases
  (`whileTap`), tracé de la coche par `pathLength`, compteur à colonnes de
  chiffres adapté de `number-ticker`.
