import fs from 'fs';
import * as cheerio from 'cheerio';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const html = fs.readFileSync('calendario_bartimeo_2026.html', 'utf8');
    const $ = cheerio.load(html);

    const data = {
        hero: {
            eyebrow: $('.eyebrow').text().trim(),
            title: $('h1').html().replace(/<br>/g, '\n').trim(),
            description: $('.hero p').text().trim(),
            labels: $('.journey-labels span').map((i, el) => $(el).text()).get()
        },
        months: []
    };

    $('section.month').each((i, el) => {
        const monthNum = $(el).find('.month-num').text().trim();
        const monthName = $(el).find('h2').text().trim();
        
        // Grid logic
        const grids = $(el).find('.grid');
        let emptyDaysStart = 0;
        let totalDays = 0;
        const eventDays = [];
        const retreatDays = [];

        grids.each((gi, gridEl) => {
            const cells = $(gridEl).find('.cell');
            cells.each((ci, cellEl) => {
                const isHeader = $(cellEl).hasClass('dow');
                if (isHeader) return;

                if ($(cellEl).hasClass('empty')) {
                    if (totalDays === 0) emptyDaysStart++; // Only count leading empties
                } else {
                    const dayNumStr = $(cellEl).text().trim();
                    if (dayNumStr) {
                        const dayNum = parseInt(dayNumStr, 10);
                        if (!isNaN(dayNum)) {
                            totalDays = Math.max(totalDays, dayNum);
                            if ($(cellEl).hasClass('event')) eventDays.push(dayNum);
                            if ($(cellEl).hasClass('retreat')) retreatDays.push(dayNum);
                        }
                    }
                }
            });
        });

        // Cards logic
        const cards = [];
        $(el).find('.agenda .card').each((ci, cardEl) => {
            const isRetreat = $(cardEl).hasClass('retreat');
            const date = $(cardEl).find('.card-date').text().trim();
            const fields = [];

            $(cardEl).find('.field').each((fi, fieldEl) => {
                fields.push({
                    label: $(fieldEl).find('.field-label').text().trim(),
                    value: $(fieldEl).find('.field-value').text().trim()
                });
            });

            cards.push({ date, isRetreat, fields });
        });

        data.months.push({
            id: monthNum,
            name: monthName,
            emptyDaysStart,
            totalDays,
            eventDays,
            retreatDays,
            cards
        });
    });

    // Save to DB
    console.log("Parsed Data:", JSON.stringify(data, null, 2).substring(0, 500) + "...");
    
    const client = new Client({ 
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    try {
        await client.query(`
            INSERT INTO app_config (key, value) 
            VALUES ('calendar_itinerary', $1) 
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, [JSON.stringify(data)]);
        console.log("✅ Successfully saved to app_config table under key 'calendar_itinerary'");
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await client.end();
    }
}

run();
