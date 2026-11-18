import express from "express";
import { Pool } from 'pg';
import cors from "cors";
import "dotenv/config";
import { administrationRoutes } from './administration';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use('/api/admin', administrationRoutes(pool));

app.get('/', (_req, res) => {
  res.json({ message: "API Backoffice KotBis", status: "OK" });
});

app.listen(PORT, () => {
  console.log(`API Backoffice démarrée sur le port ${PORT}`);
});