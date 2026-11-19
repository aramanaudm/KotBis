# KotBis — Module Transport

Documentation technique du module `src/transport/` du Back-End KotBis.

**Tickets :** KBE-27 — Consulter les lignes et les arrêts ; KBE-28 — Trouver les arrêts proches.

## 1. Présentation

Le module Transport fournit des endpoints HTTP publics permettant à l'application KotBis de consulter les lignes de bus, les arrêts et les arrêts situés à proximité d'une position géographique.

**Technologies :** Node.js, TypeScript, Express.js, PostgreSQL et PostGIS.

Les données sont récupérées depuis la base PostgreSQL. Les calculs de distances géographiques sont réalisés côté serveur avec PostGIS.

## 2. Architecture

Le module suit une séparation en couches :

| Fichier | Responsabilité |
|---|---|
| `transport.routes.ts` | Définition des routes HTTP, validation des paramètres et réponses |
| `transport.service.ts` | Fonctions métier appelées par les routes |
| `transport.repository.ts` | Requêtes SQL et accès à PostgreSQL/PostGIS |
| `transport.types.ts` | Interfaces TypeScript `Ligne`, `Arret` et `ArretProche` |

Flux d'une requête :

**Client → Route Express → Service → Repository → PostgreSQL/PostGIS**

## 3. KBE-27 — Consulter les lignes et les arrêts

### GET `/api/lignes`

Retourne la liste des lignes de bus disponibles.

**Paramètres :** aucun.

**Réponse HTTP 200 :**

```json
{
  "lignes": [
    {
      "id": "1",
      "code": "12A",
      "libelle": "Exemple de ligne"
    }
  ]
}
```

Cet exemple illustre le format de la réponse et ne représente pas nécessairement une ligne réelle de la base.

Chaque ligne possède :

| Champ | Type | Description |
|---|---|---|
| `id` | string | Identifiant PostgreSQL BIGINT représenté en chaîne |
| `code` | string | Code ou numéro de ligne |
| `libelle` | string | Nom ou description de la ligne |

Si aucune ligne n'est disponible, l'API retourne `{ "lignes": [] }`.

**Erreur HTTP 500 :** `{ "erreur": "Impossible de récupérer les lignes." }`

### GET `/api/arrets`

Retourne la liste des arrêts disponibles.

**Paramètres :** aucun.

**Réponse HTTP 200 :**

```json
{
  "arrets": [
    {
      "id": "1",
      "code": "AR001",
      "nom": "Exemple d'arrêt",
      "latitude": -20.3162,
      "longitude": 57.5264,
      "dateMiseAJour": "2026-11-18T10:30:00.000Z"
    }
  ]
}
```

Les données ci-dessus sont illustratives.

| Champ | Type | Description |
|---|---|---|
| `id` | string | Identifiant unique |
| `code` | string | Code de l'arrêt |
| `nom` | string | Nom de l'arrêt |
| `latitude` | number | Latitude géographique |
| `longitude` | number | Longitude géographique |
| `dateMiseAJour` | string | Date de dernière modification, au format UTC ISO 8601 |

Si aucun arrêt n'est disponible, l'API retourne `{ "arrets": [] }`.

**Erreur HTTP 500 :** `{ "erreur": "Impossible de récupérer les arrêts." }`

## 4. KBE-28 — Trouver les arrêts proches

### GET `/api/arrets/proches`

Recherche les arrêts de transport situés dans un rayon défini autour d'une position géographique.

**Exemple de requête :**

`GET http://localhost:3000/api/arrets/proches?latitude=-20.3162&longitude=57.5264&rayon=500`

### Paramètres obligatoires

| Paramètre | Type | Validation |
|---|---|---|
| `latitude` | number | Entre -90 et 90 inclus |
| `longitude` | number | Entre -180 et 180 inclus |
| `rayon` | number | Supérieur à 0 et inférieur ou égal à 10 000 |

Le rayon est exprimé en **mètres**.

La limite maximale de 10 000 mètres est provisoire et doit être confirmée avec l'équipe Front-End.

Les paramètres absents, répétés, non numériques, non finis ou hors limites sont rejetés.

### Réponse HTTP 200

```json
{
  "arrets": [
    {
      "id": "1",
      "code": "AR001",
      "nom": "Exemple d'arrêt",
      "latitude": -20.3162,
      "longitude": 57.5264,
      "dateMiseAJour": "2026-11-18T10:30:00.000Z",
      "distanceMetres": 12.27
    }
  ]
}
```

Cet exemple est illustratif.

Chaque objet retourné possède les champs de l'interface `Arret`, auxquels s'ajoute :

| Champ | Type | Description |
|---|---|---|
| `distanceMetres` | number | Distance géographique entre la position recherchée et l'arrêt, en mètres |

Les résultats sont triés par **distance croissante**, puis par identifiant en cas d'égalité.

Si aucun arrêt ne correspond à la recherche :

```json
{
  "arrets": []
}
```

### Erreurs HTTP 400

Les paramètres invalides produisent une réponse HTTP 400 avec un message adapté.

Exemples :

- Latitude invalide : `{"erreur":"La latitude doit être comprise entre -90 et 90."}`
- Longitude invalide : `{"erreur":"La longitude doit être comprise entre -180 et 180."}`
- Rayon invalide : `{"erreur":"Le rayon doit être supérieur à 0 et inférieur ou égal à 10000 mètres."}`

### Erreur HTTP 500

En cas d'échec de la recherche :

`{"erreur":"Impossible de rechercher les arrêts proches."}`

Les détails techniques PostgreSQL ne sont pas renvoyés au client.

## 5. PostgreSQL et PostGIS

Les données des arrêts proviennent de la table `arrets`.

Le champ `position` est une géométrie PostGIS de type `Point` avec le système de coordonnées **EPSG:4326**.

Convention utilisée :

- X = longitude
- Y = latitude

La recherche utilise notamment :

- `ST_MakePoint` pour construire le point géographique à partir des coordonnées reçues.
- `ST_SetSRID` pour définir le système EPSG:4326.
- `ST_DWithin` pour sélectionner les arrêts dans le rayon demandé.
- `ST_Distance` pour calculer la distance entre la position et chaque arrêt.

Les calculs sont effectués avec le type PostGIS `geography`, afin d'obtenir des distances exprimées en mètres.

La recherche des arrêts proches exclut les arrêts inactifs, archivés ou dépourvus de position géographique.

## 6. Localisation et confidentialité

L'endpoint KBE-28 reçoit les coordonnées fournies par le client dans la requête HTTP.

Il ne déclenche pas lui-même l'accès au GPS du téléphone.

Il n'implémente ni suivi continu de position ni partage de localisation entre utilisateurs.

La gestion des autorisations GPS relève du client mobile.

## 7. Tests

Les commandes suivantes sont exécutées depuis le dossier `backend/`.

### Tests de validation HTTP — KBE-28

```bash
node --import tsx --test tests/transport.arrets-proches.test.ts
```

Vérifie notamment les paramètres absents, invalides, hors limites et répétés.

**Résultat vérifié : 14 tests réussis.**

### Tests d'intégration PostgreSQL/PostGIS — KBE-28

```bash
node --import tsx --test tests/integration/transport.arrets-proches.postgres.test.ts
```

Vérifie :

- Le calcul d'une distance géographique en mètres.
- Une recherche réelle autour d'un arrêt existant.
- Le respect du rayon et le tri des résultats.
- La réponse lorsque aucun arrêt n'est trouvé.

Ces tests nécessitent une base PostgreSQL accessible avec PostGIS et les tables KotBis.

Ils utilisent des requêtes en lecture seule.

**Résultat vérifié : 3 tests réussis.**

### Vérification TypeScript

```bash
npm run typecheck
```

**État lors des dernières vérifications :** la vérification globale échoue sur trois erreurs de typage dans le module `src/localisation/partage-position`, distinct du module Transport. Ces erreurs doivent être résolues avant de considérer la compilation globale comme réussie.

## 8. Points à confirmer

- Valider avec l'équipe Front-End la limite maximale du rayon de recherche.
- Confirmer avec l'équipe projet le périmètre des arrêts à afficher, notamment les éventuels arrêts de métro présents dans les données.
- Vérifier l'intégration des endpoints dans l'interface mobile.

## 9. Tickets associés

- **KBE-27 :** Consultation des lignes et des arrêts.
- **KBE-28 :** Recherche des arrêts proches d'une position géographique.