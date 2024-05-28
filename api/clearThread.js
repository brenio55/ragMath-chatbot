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

/**
 * @param {Request} request
 * */
export function POST(request) {
    const status = 200;
    const message = "hi from vercel";

    return new Response(message, { status });
}
