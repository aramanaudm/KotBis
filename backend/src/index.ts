import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

const PORT = Number(process.env.PORT) || 3000;

// Configuration des middlewares
app.use(cors());
app.use(express.json());

// Route de vérification du serveur
app.get("/", (req, res) => {
  res.json({
    message: "Bienvenue sur l'API KotBis",
    status: "OK"
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur KotBis démarré sur le port ${PORT}`);
});
