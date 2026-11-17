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
Cette route insère les données dans les tables `comptes` et `voyageurs` de manière sécurisée (transaction SQL). Le mot de passe est haché avec Argon2id.

*   **Méthode :** `POST`
*   **URL :** `http://localhost:3000/api/inscription`
*   **Onglet "Body" (raw -> JSON) :**
```json
{
  "pseudo": "maya974",
  "email": "maya@email.com",
  "motDePasse": "monSuperMotDePasse123"
}
```
*   **Résultat attendu :** `201 Created` avec un JSON contenant l'ID, le pseudo et l'email.
*   **Test d'erreur :** Relancez la requête avec le même email. Vous devez recevoir une erreur `409 Conflict`.

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

### 5. Modification de profil (`PUT /api/utilisateurs/moi`) 🔒
*Requiert une authentification.*

*   **Méthode :** `PUT`
*   **URL :** `http://localhost:3000/api/utilisateurs/moi`
*   **Onglet "Authorization" :** Sélectionnez `Bearer Token` et collez votre jeton.
*   **Onglet "Body" (raw -> JSON) :**
```json
{
  "pseudo": "maya_nouveau_pseudo",
  "email": "nouvel_email@email.com"
}
```
*   **Résultat attendu :** `200 OK`. Modifie les données dans `comptes` (email) et `voyageurs` (pseudo).

### 6. Suppression de compte (`DELETE /api/utilisateurs/moi`) 🔒
*Requiert une authentification.*

*   **Méthode :** `DELETE`
*   **URL :** `http://localhost:3000/api/utilisateurs/moi`
*   **Onglet "Authorization" :** Sélectionnez `Bearer Token` et collez votre jeton.
*   **Résultat attendu :** `200 OK`. Supprime le profil `voyageurs`, les sessions associées et le compte `comptes`.

### 7. Tests de sécurité (routes protégées)
Pour vérifier que la sécurité est bien en place :
*   Appelez `PUT /api/utilisateurs/moi` **sans** jeton. Résultat attendu : `401 Unauthorized` avec le code `AUTHENTIFICATION_REQUISE`.
*   Appelez la même route avec un faux jeton (ex: `Bearer faux_jeton`). Résultat attendu : `401 Unauthorized` avec le code `SESSION_INVALIDE`.
*   Appelez `POST /api/connexion` avec un mauvais mot de passe. Résultat attendu : `401 Unauthorized` avec le code `IDENTIFIANTS_INVALIDES`.
*   Répétez la connexion avec un mauvais mot de passe plus de 5 fois en 15 minutes. Résultat attendu : `429 Too Many Requests` avec le code `TROP_DE_TENTATIVES`.

---

## 🔒 Sécurité et Architecture

*   **Hachage Argon2id :** Les mots de passe ne sont jamais stockés en clair. Le hachage est effectué avant insertion en base.
*   **Transactions SQL :** L'inscription et les opérations de session utilisent une transaction (`BEGIN` / `COMMIT` / `ROLLBACK`) pour garantir la cohérence des données.
*   **Sessions en base :** La connexion génère un jeton opaque de 32 octets. Seule son empreinte SHA-256 est stockée dans la table `sessions` (`empreinte_jeton`). Le middleware de session vérifie l'expiration, la révocation et l'état du compte, puis expose le `compteId` courant aux routes protégées. Le renouvellement révoque l'ancienne session et en crée une nouvelle.
*   **Limitation des tentatives :** Les échecs de connexion sont limités par adresse IP et identifiant (`MAX_TENTATIVES_CONNEXION` sur `FENETRE_TENTATIVES_MINUTES`).
*   **Erreurs normalisées :** Les réponses d'erreur utilisent un format commun `{ "erreur": { "code": "...", "message": "..." } }` et ne révèlent aucun secret.
*   **Alignement BDD :** Le code utilise les tables `comptes`, `voyageurs` et `sessions` définies dans le script `kotbis_schema.sql` fourni par l'équipe Back-Office.

## 📂 Structure du projet

*   `src/index.ts` : Point d'entrée de l'application (Express), montage des routeurs et routes d'inscription/profil.
*   `src/authentification/` : Logique KBE-23 (validation, service, dépôt PostgreSQL, jetons et mots de passe).
*   `src/middlewares/` : Middleware de session, limitation des tentatives et gestion des erreurs.
*   `src/commun/erreurs.ts` : Erreurs métier et codes HTTP associés.
*   `src/configuration/baseDeDonnees.ts` : Configuration et vérification de la connexion à PostgreSQL/PostGIS.
*   `src/commun/crud-reflect.ts` : Module de génération de requêtes SQL par réflexion (utilisé pour l'administration et les tests).
*   `documentation/` : Contient les cahiers des charges et guides de l'équipe.
*   `tests/` : Tests unitaires et d'intégration (`npm test`, `npm run test:connexion-sessions`, `npm run typecheck`).
