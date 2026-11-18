import express from "express";
import cors from "cors";
import "dotenv/config";
import routeurSante from "./commun/routes/sante.routes";
import {
  verifierConnexionBdd,
  verifierPostgis,
  ErreurBaseDeDonnees,
  obtenirPool
} from "./configuration/baseDeDonnees";
import { DepotAuthentificationPostgres } from "./authentification/depot";
import { ServiceAuthentification } from "./authentification/service";
import { creerRouteurAuthentification } from "./authentification/routes";
import { creerMiddlewareSession, obtenirUtilisateurCourant } from "./middlewares/authentification";
import { gestionnaireErreurs, routeInconnue } from "./middlewares/gestionErreurs";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

app.use("/api/sante", routeurSante);

// KBE-23 : authentification par sessions stockées en base (jeton opaque)
const serviceAuthentification = new ServiceAuthentification(
  new DepotAuthentificationPostgres(obtenirPool)
);
const middlewareSession = creerMiddlewareSession(serviceAuthentification);
app.use("/api", creerRouteurAuthentification(serviceAuthentification, middlewareSession));

app.put('/api/utilisateurs/moi', middlewareSession, async (req: any, res: any) => {
  const client = await obtenirPool().connect();
  try {
    const { pseudo, email } = req.body;
    const compteId = obtenirUtilisateurCourant(req).compteId;

    await client.query('BEGIN');

    // 1. Mise à jour de l'email dans 'comptes'
    if (email) {
      await client.query('UPDATE comptes SET email = $1, modifie_le = now() WHERE id = $2', [email, compteId]);
    }

    // 2. Mise à jour du pseudo dans 'voyageurs'
    if (pseudo) {
      await client.query('UPDATE voyageurs SET pseudo = $1, modifie_le = now() WHERE compte_id = $2', [pseudo, compteId]);
    }

    await client.query('COMMIT');
    res.json({ message: "Profil mis à jour avec succès." });

  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ erreur: "Cet email ou pseudo est déjà pris." });
    res.status(500).json({ erreur: "Erreur lors de la mise à jour." });
  } finally {
    client.release();
  }
});

app.delete('/api/utilisateurs/moi', middlewareSession, async (req: any, res: any) => {
  const client = await obtenirPool().connect();
  try {
    const compteId = obtenirUtilisateurCourant(req).compteId;

    await client.query('BEGIN');
    
    await client.query('DELETE FROM voyageurs WHERE compte_id = $1', [compteId]);
    await client.query('DELETE FROM sessions WHERE compte_id = $1', [compteId]);
    await client.query('DELETE FROM comptes WHERE id = $1', [compteId]);

    await client.query('COMMIT');
    res.json({ message: "Compte supprimé avec succès." });

  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ erreur: "Erreur lors de la suppression du compte." });
  } finally {
    client.release();
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Bienvenue sur l'API KotBis",
    status: "OK"
  });
});

app.use(routeInconnue);
app.use(gestionnaireErreurs);

// Démarrage du serveur
app.listen(PORT, async () => {
  console.log(`Serveur KotBis démarré sur le port ${PORT}`);

  // Vérification de la connexion PostgreSQL ; aucun secret n'est affiché en cas d'échec
  try {
    await verifierConnexionBdd();
    console.log("[BDD] Connexion PostgreSQL réussie");
    const versionPostgis = await verifierPostgis();
    console.log(`[BDD] PostGIS disponible (version ${versionPostgis})`);
  } catch (erreur) {
    if (erreur instanceof ErreurBaseDeDonnees) {
      console.error(`[BDD] ${erreur.message} (code : ${erreur.code ?? "inconnu"})`);
    } else {
      console.error(`[BDD] ${(erreur as Error).message}`);
    }
  }
});
