# KotBis — Documentation du Back-End

## 1. Présentation

Le Back-End de KotBis est responsable du traitement des données,
de la gestion des utilisateurs et de la communication avec la base
de données.

Technologies prévues :
- Node.js 22
- TypeScript
- Express.js (à confirmer par KBE-17)
- PostgreSQL et PostGIS (configuration prévue dans KBE-21)

## 2. Organisation du projet

Le dossier `backend/` contient le code et la configuration du serveur.

### Dossier src/

| Dossier | Rôle |
|---|---|
| configuration | Configuration du serveur et de la base de données |
| middlewares | Vérification des requêtes et gestion des erreurs |
| commun | Fonctions et outils réutilisables |
| authentification | Connexion, inscription et gestion des sessions |
| utilisateurs | Gestion des comptes utilisateurs |
| transport | Gestion des bus et des lignes |
| trajets | Gestion des itinéraires et des trajets |
| localisation | Gestion des positions géographiques |
| estimations | Estimation des temps d'arrivée |
| signalements | Gestion des signalements |
| favoris | Gestion des favoris des utilisateurs |
| alertes | Gestion des alertes et notifications |
| avis | Gestion des avis des utilisateurs |
| administration | Fonctionnalités du Back-Office |

### Autres dossiers

- `tests/` : tests du Back-End.
- `documentation/` : documentation technique du projet.

## 3. Fichiers de configuration

- `package.json` : configuration Node.js et scripts npm.
- `tsconfig.json` : configuration TypeScript.
- `.gitignore` : fichiers exclus du dépôt Git.
- `.env.example` : modèle des variables d'environnement.

## 4. Installation et démarrage

### Prérequis

- Node.js 22 ou supérieur
- npm

### Installation

Depuis le dossier backend :

```bash
npm ci
```

Cette commande installe les dépendances définies dans
package-lock.json.

### Démarrage en développement

```bash
npm run dev
```

Le serveur redémarre automatiquement lorsque le code est modifié.

### Compilation

```bash
npm run build
```

Cette commande compile TypeScript et génère le dossier dist/.

### Démarrage du serveur compilé

```bash
npm start
```

Le serveur démarre par défaut sur le port 3000.

### Vérification

Dans un deuxième terminal :

```bash
curl http://localhost:3000/
```

Réponse attendue :

```json
{
  "message": "Bienvenue sur l'API KotBis",
  "status": "OK"
}
```

Le démarrage et la réponse HTTP ont été testés avec succès
sur l'ordinateur du développeur.

Le test sur un deuxième ordinateur reste à effectuer.

### Configuration

Copier le fichier d'exemple :

```bash
cp .env.example .env
```

Adapter les variables selon l'environnement local.

La connexion PostgreSQL sera configurée dans KBE-21.

## 5. Sécurité

Les mots de passe, jetons et autres informations sensibles
ne doivent jamais être publiés sur GitHub.

Chaque développeur doit utiliser son propre fichier `.env`.

Le fichier `.env.example` sert uniquement de modèle.

## 6. Authentification et sessions

Le module `src/authentification/` fournit l'inscription, la connexion,
la réinitialisation du mot de passe, la déconnexion et le renouvellement
de session. Les routes protégées attendent l'en-tête
`Authorization: Bearer <jeton>`.

### Endpoints disponibles

| Méthode | Endpoint | Accès |
|---|---|---|
| POST | `/api/inscription` | Public |
| POST | `/api/connexion` | Public |
| POST | `/api/mot-de-passe/oublie` | Public |
| POST | `/api/mot-de-passe/reinitialisation` | Public |
| POST | `/api/deconnexion` | Session valide |
| POST | `/api/renouvellement-session` | Session valide |
| GET | `/api/utilisateurs/moi` | Session valide |
| PATCH | `/api/utilisateurs/moi` | Session valide |
| PATCH | `/api/utilisateurs/moi/avatar` | Session valide |
| PATCH | `/api/utilisateurs/moi/email` | Session valide |
| PATCH | `/api/utilisateurs/moi/mot-de-passe` | Session valide |
| DELETE | `/api/utilisateurs/moi` | Session valide + mot de passe |

### Règles d'inscription

- Champs obligatoires : pseudonyme, e-mail, mot de passe, acceptation des conditions.
- Champs facultatifs : ville (`zoneLibre`) et téléphone.
- Pseudonyme : 3 à 20 caractères (lettres, chiffres, `.`, `-`, `_`).
- Mot de passe : 8 à 128 caractères, au moins une lettre et un chiffre.
- Adresse e-mail valide, comparée sans tenir compte de la casse.
- Rôle `voyageur` imposé par le serveur, jamais choisi par le client.
- Doublons d'e-mail ou de pseudonyme refusés en `409`.
- Le mot de passe est haché avec Argon2id et n'est jamais renvoyé.

### Profil personnel

- Le profil est toujours lu depuis la session ; un `compteId` fourni dans le corps est ignoré.
- Champs modifiables : `pseudo`, `zoneLibre`, `telephone` et `avatarRef`.
- `avatarRef` peut être retiré avec `null` via `PATCH /api/utilisateurs/moi/avatar`.
- Les champs `email`, `role`, mot de passe et secrets de session ne sont jamais modifiables via ces routes.
- Un pseudonyme déjà pris renvoie `409 PSEUDO_DEJA_UTILISE`.
- Les réponses ne contiennent ni mot de passe, ni hash, ni empreinte de session.

### Demande de suppression

- `DELETE /api/utilisateurs/moi` exige le mot de passe actuel et un motif facultatif.
- La réponse est `202` avec `{ "demande": { "statut": "en_attente" } }`.
- Aucun compte, profil, session ou historique n'est supprimé immédiatement.
- La demande est conservée dans `demandes_suppression` ; une seule demande en attente
  est autorisée par compte.
- Le traitement et les règles de conservation doivent être validés par le Back-Office
  et la BDD avant toute suppression ou anonymisation.

### Réinitialisation et changement d'accès

- La demande de réinitialisation répond `202` même pour un compte inconnu ou inactif.
- Le code contient six chiffres, expire après `CODE_REINITIALISATION_DUREE_MINUTES`
  (15 minutes par défaut), est à usage unique et n'est stocké que sous forme hachée.
- Les tentatives sont limitées par e-mail (`MAX_TENTATIVES_REINITIALISATION`).
- Une réinitialisation réussie révoque toutes les sessions du compte.
- Le changement d'e-mail exige le mot de passe actuel et refuse un e-mail déjà pris en `409`.
- Le changement de mot de passe exige le mot de passe actuel et révoque les autres sessions.
- `AUTH_EXPOSER_CODE_DEV=true` ne renvoie `devCode` qu'hors production.

### Dépendance BDD

L'inscription utilise les tables `comptes`, `voyageurs`, `roles` et
`sessions`. La réinitialisation utilise `codes_reinitialisation` et la
demande de suppression utilise `demandes_suppression`.
Le téléphone optionnel et ces tables nécessitent la migration BDD
`database/migrations/001_authentification.sql`, gérée par l'équipe BDD.

### Vérifications

```bash
npm run typecheck
npm run test:inscription
npm run test:connexion-sessions
npm run test:mot-de-passe-email
npm run test:profil
npm run test:suppression
npm test

# Scénario réel avec une base migrée
KOTBIS_TEST_DB=1 npm run test:integration
```
