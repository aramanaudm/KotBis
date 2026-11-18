# Configuration — Connexion PostgreSQL / PostGIS (KBE-21)

## Rôle

`baseDeDonnees.ts` gère la connexion du serveur à la base KotBis (PostgreSQL + PostGIS).
Requêtes en SQL simple avec la bibliothèque `pg` (pas d'ORM).

## Variables d'environnement

À définir dans `backend/.env` (modèle : `backend/.env.example`). Toutes sont obligatoires.

| Variable | Exemple | Rôle |
|---|---|---|
| DB_HOST | localhost | Adresse du serveur PostgreSQL |
| DB_PORT | 5432 | Port |
| DB_NAME | kotbis | Nom de la base |
| DB_USER | — | Utilisateur PostgreSQL |
| DB_PASSWORD | — | Mot de passe (jamais publié sur GitHub) |

## Fonctions disponibles

| Fonction | Rôle |
|---|---|
| `lireConfigurationBdd()` | Lit et vérifie les variables (noms des variables manquantes uniquement) |
| `obtenirPool()` | Pool de connexions partagé, créé au premier appel |
| `verifierConnexionBdd()` | Vérifie la connexion (`SELECT 1`) |
| `verifierLectureBdd()` | CA-004 : lit la table `roles` |
| `verifierPostgis()` | CA-005 : vérifie que PostGIS est activé et fonctionne |
| `fermerConnexionBdd()` | Ferme le pool |

Au démarrage (`npm run dev`), le serveur vérifie la connexion et PostGIS.

## Erreurs et sécurité

Aucune erreur ne révèle de secret (mot de passe, utilisateur, hôte).
Toute erreur PostgreSQL devient « Base de données indisponible » avec un code technique :

| Code | Signification |
|---|---|
| 28P01 | Utilisateur ou mot de passe incorrect |
| 3D000 | La base indiquée dans DB_NAME n'existe pas |
| 42P01 | Table absente (schéma BDD non chargé) |
| ECONNREFUSED | PostgreSQL arrêté, ou hôte/port incorrect |

Une variable manquante donne : « Configuration BDD incomplète : NOM_DE_LA_VARIABLE ».

## Prérequis

- PostgreSQL avec l'extension PostGIS installée.
- Base `kotbis` créée avec le script de l'équipe BDD : `database/kotbis_schema.sql`.

## Tests

Depuis `backend/` : `npm test`

- `tests/baseDeDonnees.test.ts` : variables, connexion, lecture (CA-004), PostGIS (CA-005),
  erreur de connexion sans secret.
- `tests/schemaBdd.test.ts` : extensions, tables, clés primaires, colonnes spatiales,
  contraintes. Les essais d'insertion sont annulés (ROLLBACK) : rien n'est enregistré.