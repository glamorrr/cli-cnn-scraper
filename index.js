const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs').promises;

const CONFIG = {
    SEARCH: process.argv[2],
    TOTAL_PAGES: process.argv[3],
};

main();

function main() {
    if (!CONFIG.SEARCH) {
        throw new Error('please input SEARCH argument');
    }

    if (!CONFIG.TOTAL_PAGES) {
        throw new Error('please input TOTAL_PAGES argument');
    }

    if (Number.isNaN(Number(CONFIG.TOTAL_PAGES))) {
        throw new Error('TOTAL_PAGES only accept number');
    }

    runScraper({ totalPages: CONFIG.TOTAL_PAGES, search: CONFIG.SEARCH });
}

async function runScraper({ totalPages = 1, search = '' }) {
    log(`crawling ${totalPages} pages to collect articles related to ${search}...`);

    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const articles = await getArticles({ page, totalPages, query: encodeURIComponent(search) });

    await browser.close();

    await writeCSV({ records: articles });

    log('done');
}

async function writeCSV({ records }) {
    const fileName = `articles-${CONFIG.SEARCH.replace(' ', '-')}-${CONFIG.TOTAL_PAGES}-page.csv`;
    const saveTo = `out/${fileName}`;

    try {
        await fs.access('out');
    } catch (err) {
        await fs.mkdir('out');
    }

    const csvWriter = createCsvWriter({
        path: saveTo,
        header: getHeaderForCSV(records[0]),
    });

    await csvWriter.writeRecords(records);

    log('all articles saved at:', saveTo);
}

function getHeaderForCSV(record) {
    return Object.keys(record).map((key) => ({
        id: key,
        title: key.toUpperCase(),
    }));
}

async function getArticles({ page, totalPages, query }) {
    const articles = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        const url = `https://www.cnnindonesia.com/search/?query=${query}&page=${pageNumber}`;
        const articlesFromPage = await getArticlesFromSinglePage({ page, url });

        log(`total articles from page ${pageNumber}:`, articlesFromPage.length);
        articles.push(...articlesFromPage);
    }

    return articles;
}

async function getArticlesFromSinglePage({ page, url }) {
    await page.goto(url);
    await page.waitForSelector('[data-name="cnn-id"] article a');

    const articles = await page.$$eval('[data-name="cnn-id"] article a', (elements) => {
        return elements.map((element) => {
            const title = element.querySelector('h2').textContent;
            const category = element.querySelector('span.text-xs.text-cnn_red').textContent;

            const article = {
                title,
                category,
            };

            return article;
        });
    });

    return articles;
}

function log(...messages) {
    console.log('[scraping]', ...messages);
}
