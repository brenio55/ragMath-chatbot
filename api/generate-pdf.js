import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cors = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
}

const apiKey = process.env.VITE_LastSecondTeacherAPIKEY;
if (!apiKey) {
    console.error("API key not found. Please make sure to set the VITE_LastSecondTeacherAPIKEY environment variable.");
    process.exit(1);
}

const openAI = new OpenAI({ apiKey });

async function logic({ thread, role }) {
    console.log('Messages to be included in PDF:', thread);

    const conversationHistory = thread.map(message => `${message.role === 'user' ? 'User' : 'System'}: ${message.content}`).join('\n');

    const response = await openAI.chat.completions.create({
        model: "gpt-4",
        max_tokens: 1000,
        temperature: 1,
        messages: [
            { role: "system", content: "You are an AI that generates detailed worksheets based on user inquiries. Create a comprehensive worksheet including explanations, questions, and exercises based on the following conversation history:" },
            { role: "user", content: conversationHistory }
        ]
    });

    const worksheetContent = response.choices[0].message.content ?? '';
    console.log('Generated worksheet content:', worksheetContent);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const fontSize = 12;

    const fontPath = resolve(__dirname, '../public/Ubuntu-Regular.ttf');
    const fontBytes = readFileSync(fontPath);
    const ubuntuFont = await pdfDoc.embedFont(fontBytes);

    page.setFont(ubuntuFont);
    page.setFontSize(fontSize);

    const textWidth = width - 100;
    const textHeight = height - 100;

    const wrapText = (text, maxWidth, font, fontSize) => {
        const words = text.split(' ');
        let lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ubuntuFont.widthOfTextAtSize(`${currentLine} ${word}`, fontSize);
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

    const paragraphs = worksheetContent.split('\n').map(paragraph => wrapText(paragraph, textWidth, ubuntuFont, fontSize)).flat();

    let y = textHeight;

    if (role === 'teacher') {
        const explanationResponse = await openAI.chat.completions.create({
            model: "gpt-4",
            max_tokens: 500,
            temperature: 1,
            messages: [
                { role: "system", content: "Provide an explanation of the main purpose of this activity and the correct answers." },
                { role: "user", content: worksheetContent }
            ]
        });

        const explanation = explanationResponse.choices[0].message.content ?? '';
        console.log('Generated explanation for teacher:', explanation);

        const explanationParagraphs = explanation.split('\n').map(paragraph => wrapText(paragraph, textWidth, ubuntuFont, fontSize)).flat();
        for (const paragraph of explanationParagraphs) {
            if (y - fontSize < 0) {
                page = pdfDoc.addPage();
                y = textHeight;
            }
            page.drawText(paragraph, {
                x: 50,
                y,
                size: fontSize,
                font: ubuntuFont,
                color: rgb(0, 0, 0),
            });
            y -= fontSize + 5;
        }

        y -= 20;
    }

    for (const paragraph of paragraphs) {
        if (y - fontSize < 0) {
            page = pdfDoc.addPage();
            y = textHeight;
        }
        page.drawText(paragraph, {
            x: 50,
            y,
            size: fontSize,
            font: ubuntuFont,
            color: rgb(0, 0, 0),
        });
        y -= fontSize + 5;
    }

    if (role === 'student') {
        y = textHeight - 50;
        const answersResponse = await openAI.chat.completions.create({
            model: "gpt-4",
            max_tokens: 500,
            temperature: 1,
            messages: [
                { role: "system", content: "Provide the correct answers for the following worksheet content." },
                { role: "user", content: worksheetContent }
            ]
        });

        const answers = answersResponse.choices[0].message.content ?? '';
        console.log('Generated answers for student:', answers);

        const answersParagraphs = answers.split('\n').map(paragraph => wrapText(paragraph, textWidth, ubuntuFont, fontSize)).flat();
        for (const paragraph of answersParagraphs) {
            if (y - fontSize < 0) {
                page = pdfDoc.addPage();
                y = textHeight;
            }
            page.drawText(paragraph, {
                x: 50,
                y,
                size: fontSize,
                font: ubuntuFont,
                color: rgb(0.5, 0.5, 0.5),
            });
            y -= fontSize + 5;
        }
    }

    page.drawText('Generated by Last Second Teacher - visit lastsecondteacher.com', {
        x: 50,
        y: 20,
        size: 10,
        font: ubuntuFont,
        color: rgb(0, 0, 0),
    });

   return await pdfDoc.save();
}

/**
 * @param {Request} req
 */
export async function POST(req) {
    const body = await req.json();
    console.log('Generating PDF for thread:', body.threadId);

    try {
        const pdfBytes = await logic(body)
        const pdf = Buffer.from(pdfBytes)
        console.log("PDF generated successfully");

        return new Response(pdf, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename=worksheet.pdf',
                ...cors
            },
        });

    } catch (error) {
        console.error("Error: ", error.message);
        const err = JSON.stringify({ error: error.message });
        return new Response(err, { status: 500, headers: cors })
    }
}
