import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 5000;


import kbRoutes from './routes/kbRoutes.js';

app.use(cors());
app.use(express.json());

app.use('/api/KB', kbRoutes);


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})

export default app;