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
import { creerRouteurUtilisateurs } from "./utilisateurs/routes";
import { creerMiddlewareSession } from "./middlewares/authentification";
import { gestionnaireErreurs, routeInconnue } from "./middlewares/gestionErreurs";
import { DepotFavorisPostgres } from "./favoris/favoris.depot.postgres";
import { FavorisControleur } from "./favoris/favoris.controleur";
import { creerRoutesFavoris } from "./favoris/favoris.routes";
import { FavorisService } from "./favoris/favoris.service";
import { ReferentielReseauPostgres } from "./favoris/reseau.referentiel.postgres";

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

// KBE-40 : favoris du voyageur connecté
app.use(
  "/api/favoris",
  creerRoutesFavoris(
    middlewareSession,
    new FavorisControleur(
      new FavorisService(new DepotFavorisPostgres(obtenirPool), new ReferentielReseauPostgres())
    )
  )
);

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

app.use("/api/utilisateurs", creerRouteurUtilisateurs(serviceAuthentification, middlewareSession));

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
