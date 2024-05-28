


async function logic({ threadId }) {
    const result = {
        body: '',
        status: '',
    }

    console.log('Clearing thread:', threadId);
    if (threads[threadId]) {
        delete threads[threadId];
        console.log('Thread cleared successfully:', threadId);
        res.json({ message: "Thread cleared successfully" });
    } else {
        console.error('Thread not found:', threadId);
        res.status(202).send({ error: "Thread not found" });
    }

    return result;
}

/**
 * @param {Request} request
 * */
export function POST(request) {
    try {
        
    } catch (error) {
        console.error("Error: ", error.message);
        const err = JSON.stringify({ error: error.message });
        return new Response(err, { status: 500 })
    }
}
