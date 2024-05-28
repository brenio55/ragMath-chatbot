import {} from 'vercel';

// const { threadId } = req.body;
// console.log('Clearing thread:', threadId);

// if (threads[threadId]) {
//     delete threads[threadId];
//     console.log('Thread cleared successfully:', threadId);
//     res.json({ message: "Thread cleared successfully" });
// } else {
//     console.error('Thread not found:', threadId);
//     res.status(202).send({ error: "Thread not found" });
// }

export function POST(req, res) {
    res.send({
        status: 200,
        message: "hi from vercel",
    });
}
