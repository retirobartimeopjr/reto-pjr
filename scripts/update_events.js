import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const client = new Client({ 
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        
        const calendarData = {
            hero: {
                eyebrow: "CRONOGRAMA DE SERVICIO",
                title: "Rumbo al V Retiro\nBartimeo",
                description: "Este es nuestro itinerario oficial de preparación y servicio. Aquí encontrarás todas las reuniones, actividades y fechas clave.",
                labels: ["Inicio", "Preparación", "Retiro", "Post-Retiro"]
            },
            months: [
                {
                    id: "08",
                    name: "Agosto",
                    emptyDaysStart: 6, // Sun-first index for Sat Aug 1st
                    totalDays: 31,
                    eventDays: [1, 2, 5, 8, 9, 12, 15, 16, 19, 22, 23, 24, 26, 29, 30],
                    retreatDays: [],
                    cards: [
                        { date: "1 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Reunion de preparación #1 3:00 pm" }] },
                        { date: "2 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Misa de Jovenes 7:30 pm" }, { label: "Evento", value: "Inicio de promoción del retiro!" }] },
                        { date: "5 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Catequesis 7:00 pm con el padre Wilson" }] },
                        { date: "8 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Reunion de preparación #2 3:00 pm" }] },
                        { date: "9 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Ventas todo el dia. Y promoción del retiro" }] },
                        { date: "12 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Catequesis 7:00 pm con el padre Wilson" }] },
                        { date: "15 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Reunion de preparación #3 3:00 pm" }] },
                        { date: "16 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Misa de Jovenes 7:30 pm" }] },
                        { date: "19 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Catequesis 7:00 pm con el padre Wilson" }] },
                        { date: "22 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Reunion de preparación #4 3:00 pm" }] },
                        { date: "23 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Ventas todo el dia. Y promoción del retiro" }] },
                        { date: "24 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Inicio del Reto Bartimeo." }] },
                        { date: "26 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Catequesis 7:00 pm con el padre Wilson" }] },
                        { date: "29 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Reunion de preparación #5 3:00 pm" }] },
                        { date: "30 de Agosto", isRetreat: false, fields: [{ label: "Evento", value: "Promoción del retiro." }] }
                    ]
                },
                {
                    id: "09",
                    name: "Septiembre",
                    emptyDaysStart: 2, // Tue Sep 1st
                    totalDays: 30,
                    eventDays: [2, 5, 6, 9, 12, 13, 16, 19, 20, 23, 24, 30],
                    retreatDays: [25, 26, 27],
                    cards: [
                        { date: "2 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Catequesis 7:00 pm con el padre Wilson" }] },
                        { date: "5 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Reunion de preparación #5 3:00 pm" }] },
                        { date: "6 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Promoción del retiro." }] },
                        { date: "9 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Catequesis 7:00 pm con el padre Wilson" }] },
                        { date: "12 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Reunion de preparación #6 3:00 pm" }] },
                        { date: "13 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Promoción del retiro." }] },
                        { date: "16 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Catequesis 7:00 pm con el padre Wilson" }] },
                        { date: "19 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "PRE RETIRO TODO EL DIA." }] },
                        { date: "20 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Ventas y promoción." }] },
                        { date: "23 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Catequesis 7:00 pm con el padre Wilson" }] },
                        { date: "24 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Fin del reto bartimeo." }] },
                        { date: "25, 26 y 27 de Septiembre", isRetreat: true, fields: [{ label: "Evento", value: "V Retiro Bartimeo" }] },
                        { date: "30 de Septiembre", isRetreat: false, fields: [{ label: "Evento", value: "Catequesis 7:00 pm con el padre Wilson" }] }
                    ]
                },
                {
                    id: "10",
                    name: "Octubre",
                    emptyDaysStart: 4, // Thu Oct 1st
                    totalDays: 31,
                    eventDays: [3],
                    retreatDays: [],
                    cards: [
                        { date: "3 de Octubre", isRetreat: false, fields: [{ label: "Evento", value: "Primera Reunion POST -retiro." }] }
                    ]
                }
            ]
        };

        const jsonStr = JSON.stringify(calendarData);
        await client.query(`
            UPDATE app_config 
            SET value = $1
            WHERE key = 'calendar_itinerary'
        `, [jsonStr]);
        
        console.log("✅ Database updated successfully.");
    } catch (e) {
        console.error("❌ Error updating database:", e);
    } finally {
        await client.end();
    }
}

run();
