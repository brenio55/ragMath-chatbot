import express from 'express';
import { createRequire } from "module";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'; // Import StandardFonts from pdf-lib
import { OpenAI } from 'openai';
import cors from 'cors';
import fetch from 'node-fetch'; // Add this if you don't have fetch available globally

const require = createRequire(import.meta.url);

require('dotenv').config({ path: './../.env' });

const app = express();
app.use(express.json());

const apiKey = process.env.VITE_LastSecondTeacherAPIKEY;
console.log(apiKey);
if (!apiKey) {
    console.error("API key not found. Please make sure to set the VITE_LastSecondTeacherAPIKEY environment variable.");
    process.exit(1);
}

const openAI = new OpenAI({ apiKey });

const corsOptions = {
   origin: '*', 
   credentials: true,
   optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Store thread information
const threads = {};

app.post('/api/requireResponseOpenAI', async (req, res) => {
    const { inputText, threadId, role } = req.body;
    console.log('Received request:', { inputText, threadId, role });

    try {
        const messages = threads[threadId] || [
            { "role": "system", "content": `You are a ${role} using a system that generates Worksheets for teachers and students. If you receive an inquiry about generating a worksheet, don't generate it directly as a response. Instead, await for the front-end to send an inquiry to generate a PDF. Say to the user to click Generate PDF.` }
        ];
        console.log('Current thread messages:', messages);

        messages.push({ "role": "user", "content": inputText });
        console.log('Updated thread messages:', messages);

        const response = await openAI.chat.completions.create({
            model: "gpt-4",
            max_tokens: 1000,
            temperature: 1,
            messages: messages
        });

        const systemMessage = response.choices[0].message;
        console.log('System response:', systemMessage);

        // Save system response in thread
        if (!threads[threadId]) {
            threads[threadId] = [
                { "role": "system", "content": `You are a ${role} using a system that generates Worksheets for teachers and students. If you receive an inquiry about generating a worksheet, don't generate it directly as a response. Instead, await for the front-end to send an inquiry to generate a PDF. Say to the user to click Generate PDF.` }
            ];
        }
        threads[threadId].push(systemMessage);

        res.json({ message: systemMessage.content });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send({ error: error.message });
    }
});

app.post('/api/requireResponseOpenAI/clearThread', (req, res) => {
    const { threadId } = req.body;
    console.log('Clearing thread:', threadId);

    if (threads[threadId]) {
        delete threads[threadId];
        console.log('Thread cleared successfully:', threadId);
        res.json({ message: "Thread cleared successfully" });
    } else {
        console.error('Thread not found:', threadId);
        res.status(404).send({ error: "Thread not found" });
    }
});

app.post('/api/requireResponseOpenAI/generatePDF', async (req, res) => {
    const { threadId } = req.body;
    console.log('Generating PDF for thread:', threadId);

    try {
        const messages = threads[threadId];
        if (!messages) {
            throw new Error("Thread not found");
        }
        console.log('Messages to be included in PDF:', messages);

        const content = messages.map(msg => msg.content.replace(/\n/g, ' ')).join('\n\n');

        const pdfDoc = await PDFDocument.create();

        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const fontSize = 12;

        // Use the default font provided by pdf-lib
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        page.setFont(font);
        page.setFontSize(fontSize);

        const textWidth = width - 100;
        const textHeight = height - 100;

        const wrapText = (text, maxWidth, font, fontSize) => {
            const words = text.split(' ');
            let lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = font.widthOfTextAtSize(`${currentLine} ${word}`, fontSize);
                if (width < maxWidth) {
                    currentLine += ` ${word}`;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        const paragraphs = wrapText(content, textWidth, font, fontSize);

        let y = textHeight;
        for (const paragraph of paragraphs) {
            if (y - fontSize < 0) {
                page = pdfDoc.addPage();
                y = textHeight;
            }
            page.drawText(paragraph, {
                x: 50,
                y,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });
            y -= fontSize + 5;
        }

        page.drawText('Generated by Last Second Teacher - visit lastsecondteacher.com', {
            x: 50,
            y: 20,
            size: 10,
            font: font,
            color: rgb(0, 0, 0),
        });

        const pdfBytes = await pdfDoc.save();
        
        res.setHeader('Content-Disposition', 'attachment; filename=worksheet.pdf');
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(pdfBytes));

        console.log("PDF generated successfully");
    } catch (error) {
        console.error("Error generating PDF:", error.message);
        res.status(500).send({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
