import Firecrawl from "@mendable/firecrawl-js"
import dotenv from "dotenv";

dotenv.config({
    path: "../.env"
})
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY
console.log('FIRECRAWL_API_KEY: ', FIRECRAWL_API_KEY);

const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY})
async function firecrawlScrapper(infoUrl) {
    let loadDocument
    let resultMarkdown

    loadDocument = await firecrawl.scrape(infoUrl, {formats : ['markdown']});
    resultMarkdown = loadDocument.markdown;

    console.log('loaded document: ', loadDocument)
    console.log('resultMarkdown: ', resultMarkdown);

    return String(resultMarkdown)
}


firecrawlScrapper('https://ajuda.infinitepay.io/pt-BR/collections/1947792-primeiros-passos');

export default firecrawlScrapper