import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

dotenv.config({ path: './../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use((req, res, next) => {
    const origin = req.get('referer');
    if (origin && origin.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization');
        res.setHeader('Access-Control-Allow-Credentials', true);
    }
    if (req.method === 'OPTIONS') res.sendStatus(200);
    else next();
});

import requireResponseOpenAIRoutes from './requireResponseOpenAI.js';
import clearThreadRoutes from './clearThread.js';
import generatePDFRoutes from './generatePDF.js';

app.use('/api/requireResponseOpenAI', requireResponseOpenAIRoutes);
app.use('/api/requireResponseOpenAI/clearThread', clearThreadRoutes);
app.use('/api/requireResponseOpenAI/generatePDF', generatePDFRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
