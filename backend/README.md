# KotBis — Backend API

Ce document décrit l'état actuel du Back-End de l'application **KotBis**, les dépendances installées, la configuration requise, et les procédures pour tester les routes d'authentification.

## 🛠️ Prérequis

Avant de lancer le projet, assurez-vous d'avoir installé :
*   **Node.js** (version 22 ou supérieure)
*   **PostgreSQL** avec l'extension **PostGIS**
*   Un client API comme **Postman**, **Insomnia** ou **Thunder Client** (extension VS Code)

## 📦 Installation des dépendances

Les dépendances suivantes ont été installées pour faire fonctionner le serveur, la base de données et la sécurité :

```bash
# Dépendances principales (Serveur & Base de données)
npm install express pg cors dotenv

# Dépendance pour la sécurité (Hachage Argon2id)
npm install argon2

# Dépendances de développement (Types TypeScript et tests)
npm install --save-dev @types/express @types/pg @types/cors @types/node @types/supertest supertest
```

## ⚙️ Configuration de l'environnement

Créez un fichier `.env` à la racine du dossier `backend/` (ou copiez le fichier `.env.example`) et remplissez les variables suivantes :

```env
# Environnement et port du serveur
NODE_ENV=development
PORT=3000

# Connexion PostgreSQL (toutes les valeurs sont obligatoires)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kotbis
DB_USER=postgres
DB_PASSWORD=changez_moi

# Sessions et limitation des tentatives de connexion
SESSION_DUREE_MINUTES=1440
MAX_TENTATIVES_CONNEXION=5
FENETRE_TENTATIVES_MINUTES=15

# Réinitialisation du mot de passe et changement d'e-mail
CODE_REINITIALISATION_DUREE_MINUTES=15
MAX_TENTATIVES_REINITIALISATION=5
AUTH_EXPOSER_CODE_DEV=false
```

## 🚀 Lancement du serveur

Pour démarrer le serveur en mode développement (avec rechargement automatique à chaque modification) :

```bash
npm run dev
```

Le terminal doit afficher les messages de succès suivants :

```text
Serveur KotBis démarré sur le port 3000
[BDD] Connexion PostgreSQL réussie
[BDD] PostGIS disponible (version 3.6.2)
```

---

## 🧪 Tests de l'API avec Postman

Voici les étapes pour tester les fonctionnalités d'authentification et de gestion de compte.

### 1. Inscription (`POST /api/inscription`)
Cette route valide les données, hache le mot de passe avec Argon2id et insère le compte et le profil voyageur dans une transaction SQL. Le rôle `voyageur` est imposé par le serveur : un rôle envoyé par le client est ignoré.

*   **Méthode :** `POST`
*   **URL :** `http://localhost:3000/api/inscription`
*   **Onglet "Body" (raw -> JSON) :**
```json
{
  "pseudo": "maya974",
  "email": "maya@email.com",
  "motDePasse": "monSuperMotDePasse123",
  "accepteConditions": true,
  "zoneLibre": "Port-Louis",
  "telephone": "+230 5555 1234"
}
```
*   **Champs obligatoires :** `pseudo`, `email`, `motDePasse`, `accepteConditions`.
*   **Champs optionnels :** `zoneLibre` (ou `city`), `telephone` (ou `phone`).
*   **Alias acceptés :** `pseudonyme`, `password`, `conditionsAcceptees`, `city`, `ville`, `phone`.
*   **Validation :** pseudonyme de 3 à 20 caractères (lettres, chiffres, `.`, `-`, `_`) ; mot de passe de 8 à 128 caractères avec au moins une lettre et un chiffre ; e-mail valide ; téléphone facultatif au format souple.
*   **Résultat attendu :** `201 Created` avec `{ "utilisateur": { ... } }`. Aucun mot de passe, hash ou secret n'est renvoyé.
*   **Doublons :** `409 Conflict` avec `EMAIL_DEJA_UTILISE` ou `PSEUDO_DEJA_UTILISE` (comparaison insensible à la casse).
*   **Données invalides :** `422 Unprocessable Entity` avec `DONNEES_INVALIDES` et les détails du champ.

### 2. Connexion (`POST /api/connexion`)
Cette route vérifie les identifiants et crée une session en base. Elle renvoie un jeton opaque valide pendant 24 h par défaut (`SESSION_DUREE_MINUTES`).

*   **Méthode :** `POST`
*   **URL :** `http://localhost:3000/api/connexion`
*   **Onglet "Body" (raw -> JSON) :**
```json
{
  "identifiant": "maya@email.com",
  "motDePasse": "monSuperMotDePasse123"
}
```
*(Note : "identifiant" accepte l'email OU le pseudo. Les alias `email`, `pseudo`, `pseudonyme`, `identifier`, `motDePasse` et `password` sont aussi acceptés.)*

*   **Résultat attendu :** `200 OK` avec les champs `jeton`, `expireLe` et `utilisateur`. **Copiez le jeton** reçu dans la réponse. Il sera nécessaire pour les tests suivants.

### 3. Déconnexion (`POST /api/deconnexion`) 🔒
*Requiert une authentification.*

*   **Méthode :** `POST`
*   **URL :** `http://localhost:3000/api/deconnexion`
*   **Onglet "Authorization" :** Sélectionnez `Bearer Token` et collez votre jeton.
*   **Résultat attendu :** `204 No Content`. La session est révoquée et le jeton ne peut plus être utilisé.

### 4. Renouvellement de session (`POST /api/renouvellement-session`) 🔒
*Requiert une authentification.*

*   **Méthode :** `POST`
*   **URL :** `http://localhost:3000/api/renouvellement-session`
*   **Onglet "Authorization" :** Sélectionnez `Bearer Token` et collez votre jeton.
*   **Résultat attendu :** `200 OK` avec un nouveau `jeton` et sa nouvelle date `expireLe`. L'ancien jeton est révoqué (rotation de session).

### 5. Réinitialisation du mot de passe (`POST /api/mot-de-passe/oublie`, `POST /api/mot-de-passe/reinitialisation`)
*Routes publiques. La demande répond toujours `202` pour ne pas révéler l'existence d'un compte.*

*   **Demande :** `POST /api/mot-de-passe/oublie` avec `{ "email": "maya@email.com" }`.
*   **Réinitialisation :** `POST /api/mot-de-passe/reinitialisation` avec `{ "email": "...", "code": "123456", "nouveauMotDePasse": "..." }`.
*   **Code :** six chiffres, valable 15 minutes par défaut, à usage unique et stocké uniquement sous forme hachée.
*   **Résultat :** `204 No Content` après réinitialisation. Toutes les sessions du compte sont révoquées.
*   **Développement :** avec `AUTH_EXPOSER_CODE_DEV=true` hors production, le code est renvoyé dans `devCode`. En production, il est toujours masqué.

### 6. Changement d'e-mail et de mot de passe (`PATCH /api/utilisateurs/moi/email`, `PATCH /api/utilisateurs/moi/mot-de-passe`)
*Requiert une authentification.*

*   **E-mail :** `PATCH /api/utilisateurs/moi/email` avec `{ "email": "nouvel_email@email.com", "motDePasse": "motDePasseActuel" }`. Réponse `200 OK` avec `{ "utilisateur": { ... } }`.
*   **Mot de passe :** `PATCH /api/utilisateurs/moi/mot-de-passe` avec `{ "motDePasseActuel": "...", "nouveauMotDePasse": "..." }`. Réponse `204 No Content`.
*   **Sécurité :** le mot de passe actuel est obligatoire. Un e-mail déjà utilisé renvoie `409 EMAIL_DEJA_UTILISE` ; un mot de passe incorrect renvoie `401 MOT_DE_PASSE_INCORRECT`.
*   **Sessions :** le changement de mot de passe révoque les autres sessions et conserve la session courante. Une réinitialisation révoque toutes les sessions.

### 7. Consultation et modification du profil (`GET /api/utilisateurs/moi`, `PATCH /api/utilisateurs/moi`)
*Requiert une authentification. Le compte est toujours lu depuis la session : aucun identifiant de compte fourni dans le corps n'est utilisé.*

*   **Consultation :** `GET /api/utilisateurs/moi`. Réponse `200 OK` avec `{ "utilisateur": { ... } }`.
*   **Modification :** `PATCH /api/utilisateurs/moi` avec un ou plusieurs champs parmi `pseudo`, `zoneLibre`, `telephone` et `avatarRef`. Les alias `pseudonyme`, `city` et `phone` sont acceptés. Réponse `200 OK` avec le profil à jour.
*   **Avatar :** `PATCH /api/utilisateurs/moi/avatar` avec `{ "avatarRef": "avatar-01" }`, ou `{ "avatarRef": null }` pour le retirer.
*   **Sécurité :** les champs `compteId`, `email`, `role`, mot de passe et secrets de session sont ignorés ou refusés. Aucun mot de passe, hash ou jeton n'est renvoyé.
*   **Erreurs :** un pseudonyme déjà pris renvoie `409 PSEUDO_DEJA_UTILISE` ; un champ invalide ou un corps sans champ modifiable renvoie `422`.

### 8. Suppression de compte (`DELETE /api/utilisateurs/moi`) 🔒
*Requiert une authentification.*

*   **Méthode :** `DELETE`
*   **URL :** `http://localhost:3000/api/utilisateurs/moi`
*   **Onglet "Authorization" :** Sélectionnez `Bearer Token` et collez votre jeton.
*   **Résultat attendu :** `200 OK`. Supprime le profil `voyageurs`, les sessions associées et le compte `comptes`.

### 9. Tests de sécurité (routes protégées)
Pour vérifier que la sécurité est bien en place :
*   Appelez `GET /api/utilisateurs/moi` ou `PATCH /api/utilisateurs/moi/email` **sans** jeton. Résultat attendu : `401 Unauthorized` avec le code `AUTHENTIFICATION_REQUISE`.
*   Appelez la même route avec un faux jeton (ex: `Bearer faux_jeton`). Résultat attendu : `401 Unauthorized` avec le code `SESSION_INVALIDE`.
*   Appelez `POST /api/connexion` avec un mauvais mot de passe. Résultat attendu : `401 Unauthorized` avec le code `IDENTIFIANTS_INVALIDES`.
*   Répétez la connexion avec un mauvais mot de passe plus de 5 fois en 15 minutes. Résultat attendu : `429 Too Many Requests` avec le code `TROP_DE_TENTATIVES`.
*   Répétez une réinitialisation avec un mauvais code plus de 5 fois en 15 minutes. Résultat attendu : `429 Too Many Requests` avec le code `TROP_DE_TENTATIVES`.

---

## 🔒 Sécurité et Architecture

*   **Hachage Argon2id :** Les mots de passe ne sont jamais stockés en clair. Le hachage est effectué avant insertion en base.
*   **Transactions SQL :** L'inscription et les opérations de session utilisent une transaction (`BEGIN` / `COMMIT` / `ROLLBACK`) pour garantir la cohérence des données.
*   **Inscription :** Le rôle `voyageur` est imposé côté serveur, les conditions d'utilisation sont obligatoires et les doublons d'e-mail/pseudonyme sont refusés en `409`.
*   **Sessions en base :** La connexion génère un jeton opaque de 32 octets. Seule son empreinte SHA-256 est stockée dans la table `sessions` (`empreinte_jeton`). Le middleware de session vérifie l'expiration, la révocation et l'état du compte, puis expose le `compteId` courant aux routes protégées. Le renouvellement révoque l'ancienne session et en crée une nouvelle.
*   **Limitation des tentatives :** Les échecs de connexion sont limités par adresse IP et identifiant (`MAX_TENTATIVES_CONNEXION` sur `FENETRE_TENTATIVES_MINUTES`). Les tentatives de réinitialisation sont limitées par e-mail (`MAX_TENTATIVES_REINITIALISATION`).
*   **Réinitialisation :** Le code à six chiffres est haché avec SHA-256, expire après `CODE_REINITIALISATION_DUREE_MINUTES`, est à usage unique et n'est jamais renvoyé en production. La demande répond `202` même si le compte est inconnu ou inactif.
*   **Erreurs normalisées :** Les réponses d'erreur utilisent un format commun `{ "erreur": { "code": "...", "message": "..." } }` et ne révèlent aucun secret.
*   **Alignement BDD :** Le code utilise les tables `comptes`, `voyageurs`, `sessions` et `codes_reinitialisation` définies dans le script `kotbis_schema.sql` fourni par l'équipe Back-Office. Le téléphone optionnel et la réinitialisation nécessitent la migration BDD `database/migrations/001_authentification.sql`.

## 📂 Structure du projet

*   `src/index.ts` : Point d'entrée de l'application (Express) et montage des routeurs.
*   `src/authentification/` : Inscription, connexion, réinitialisation, validation, service, dépôt PostgreSQL, jetons et mots de passe.
*   `src/utilisateurs/` : Routes de consultation/modification du profil, de l'avatar, de l'e-mail et du mot de passe du compte connecté.
*   `src/middlewares/` : Middleware de session, limitation des tentatives et gestion des erreurs.
*   `src/commun/erreurs.ts` : Erreurs métier et codes HTTP associés.
*   `src/configuration/baseDeDonnees.ts` : Configuration et vérification de la connexion à PostgreSQL/PostGIS.
*   `src/commun/crud-reflect.ts` : Module de génération de requêtes SQL par réflexion (utilisé pour l'administration et les tests).
*   `documentation/` : Contient les cahiers des charges et guides de l'équipe.
*   `tests/` : Tests unitaires et d'intégration (`npm test`, `npm run test:inscription`, `npm run test:connexion-sessions`, `npm run test:mot-de-passe-email`, `npm run test:profil`, `npm run typecheck`).
