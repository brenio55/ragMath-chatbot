const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000;

const kbRoutes = require('./routes/kbRoutes');

app.use(cors());

app.get('/', (req, res) => {
    res.send('Hello World!');
})

app.use('/api/KB', kbRoutes);


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})

module.exports = app