import express from 'express';

const router = express.Router();
const threads = {};

router.get('/', async (req, res) => {
    console.log("Received request");
    res.status(200).json({ message: "GET Request successfully made to ClearThread API" });
});

router.post('/', (req, res) => {
    const { threadId } = req.body;
    console.log('Clearing thread:', threadId);

    if (threads[threadId]) {
        delete threads[threadId];
        console.log('Thread cleared successfully:', threadId);
        res.json({ message: "Thread cleared successfully" });
    } else {
        console.error('Thread not found:', threadId);
        res.status(202).send({ error: "Thread not found" });
    }
});

export default router;
