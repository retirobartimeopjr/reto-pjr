import fs from 'fs';
import { parse } from 'csv-parse/sync';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const rawTextList = `
María José Guerrero Castro	6/10/2007
Valeria Colmenares Castilla	20/12/2010
Simón Martínez Mancera 	31/8/2009
Samuel Esteban Celis Fernández 	28/5/2010
ROSARIO BERNAL DELGADO	16/9/2010
Mariana Rodríguez Fernandez	2/9/2009
Samuel Cubillos Marín 	4/8/2010
Angela Valentina Vargas Mancipe	25/7/2008
Gabriela Gómez Marulanda 	12/12/2007
Juan Pablo Cañas Muñoz 	24/10/2010
Maria Alejandra Parga Vanegas	11/12/2007
Manuel Felipe Moreno Gutiérrez 	25/8/2009
María Luisa Namén Cruz	5/9/2007
Dana Sofhia Díaz vargas	20/8/2008
Dana Carolina Ortega González 	18/12/2009
María Paula Ortega Cabezas	23/4/2007
Juan Felipe González Arango	3/7/0008
Sofia Murcia Linares	6/5/2009
Maria Jose Ochoa Garzon	9/6/2009
Paula Sofía Rodríguez Molina	16/5/2010
Juan Manuel Restrepo Cavieles	12/6/2010
Sofía Fernández Hernández 	1/10/2008
María Alejandra Peña Noel	13/8/2010
Juan Felipe Correa Ramírez 	22/11/2007
Juan Andrés Tabares Gómez	17/4/2010
Juan Esteban Sastoque Rojas	12/8/2009
Emilia Carrera Torres	29/4/2009
Lucía Carrera Torres	22/3/2007
Laura Sofia Moreno Tovar	13/6/2010
María Paula Quintero Rincón 	21/12/2009
Silvana Sáenz Barrero	14/8/2019
Sebastián Andrés Medina Fiayo	17/2/2010
CRISTIAN FELIPE SUA CASTILLO	13/4/2008
HUGO LEANDRO SUA CASTILLO	13/4/2008
Sonia Juliana Mila Sánchez	19/11/2009
Felipe Puyana Forero	21/7/2010
Santiago Andrés Rey Díaz	2/6/2009
Camilo Andrés Baquero García 	14/6/2009
Juliana Garzón Gómez 	13/5/2008
Valentina frasser segura	24/11/0008
Thomas Santiago Arias celis	10/12/2009
Martin Santiago Ramos Umaña	12/2/2011
Luciana Frasser	22/2/0010
Jesús David Niño Tamayo 	14/1/2010
Santiago Largo Villa	2/8/2007
Tomas Muñoz Muñoz 	15/5/2008
Maria paula Castro Muñoz	11/11/2007
Juan Pablo Aza Espinosa	18/8/2010
Ian Martin Mayorga Suarez	20/10/2009
Andrés David Acevedo Torres 	11/5/2009
Andres Santiago Vergara Rodriguez	26/7/2010
Juan Andrés Cifuentes Rodríguez 	16/5/2008
Lucíana Reyes Molina	12/8/2009
Isabella Rodríguez Bernal 	6/11/2009
Gabriela Oda González 	2/8/2008
Sofia Garzón Betancourt 	27/2/2007
Nicolas illescas Ramos 	7/4/2008
Alejandra Correal Olave	6/1/2007
Juan Felipe Orbegozo Abril	1/10/2006
Valentina Medellin Gonzalez 	20/12/2007
Luciana Cruz Pinzón 	7/4/2010
Sofia Arias Hurtado	17/7/2008
Tomas Arias Hurtado	23/3/2010
Jorge Andrés Rodríguez Carrillo 	16/11/2007
María Camila Vargas Vanegas 	12/2/2008
Gabriela Meneses Camacho 	18/5/2007
Luisa Fernanda Montenegro Barrera 	21/9/2007
JUANA ELIZABETH CANO BLANCO	21/10/2008
Sarah Cristina Molina Castañeda 	26/9/0009
Ana Sofia Molano Chaves	13/11/2009
Sara Valeria Molano Chaves	13/11/2009
Maria Valentina Sarmiento Fragozo	6/8/2009
Tomás Esteban Espinel Cohen	7/1/2007
Santiago Molina Alvarado	9/11/2006
SARA ISABELLA OCHOA HERRERA	19/5/2008
Paula Mariana Delgadillo Acosta 	31/8/2007
Salomé Gomez	12/12/2024
Juan Alejandro Porto Gutierrez	3/12/2008
Lizeth Fernanda Rivera Bonilla 	18/7/2009
Mariana Velásquez Medina	24/2/2009
Nicolás Rodríguez Murillo 	2/2/2008
Isabella Parra Caicedo	8/4/2008
Jacobo Puyana Forero	3/9/2008
Maríana Sanín Rodríguez 	9/9/2007
Iris Daniela Ochoa Velandia	17/9/2008
Juan Diego Illescas Ramos 	14/12/2005
Juan Diego Contreras Garzon	3/2/2009
Laura Catalina Cañon Avila	9/9/2010
Nicolas Borrero Cantor	1/3/2006
Santiago Gómez Tovar	5/4/2009
Gabriela Susana niño gomez	28/8/2007
Matías Carrera Marín 	27/5/2010
Isabela Álvarez Mora 	24/9/2007
SARAY HALMAN MEDINA	16/7/2008
Juan Felipe Beltrán Paladines 	6/6/2010
Santiago Cruz Gómez 	24/9/2009
Mariana Blanco Aguilera	18/5/2008
Sofía Lizarazo Figueroa	18/10/2007
JUAN ESTEBAN ROCHA ARIAS	28/1/2006
SOFIA CASTILLA LANCHEROS 	8/11/2007
Juan Manuel Rodriguez Giraldo	24/8/2009
Santiago Coronado Jimenez	27/2/2010
Mariana González Castañeda 	3/7/2010
Juan José Vela lancheros 	28/10/2008
Mariana Isabela niño monroy 	10/1/2009
Simón Daniel González Morales	2/2/2006
Pablo Forero	24/9/2006
Juan Manuel Contreras Olarte	24/12/2006
Luisa Natalia García Ayala 	14/5/2003
Danna Gabriela Bonilla Martinez	18/11/2006
María Alejandra Rojas Parrado	5/2/2007
Maria Jose Robayo Guzman	23/3/1998
Juan Sebastian Vargas Vanegas	27/8/2005
Daniel Alfredo Reales Paba	23/6/2000
Juan Sebastián Noel Mulett	15/4/1997
Natalia Becerra Bucheli 	22/7/2002
Andrés David Noel Millet 	21/2/2004
Julian Felipe Chaparro Manchola	9/6/2005
Sara Camila Duitama Rodriguez	18/4/2008
María Camila Carrera Marín 	3/2/2004
Manuela Carolina Flórez López	16/12/2004
Andres Camilo Chaparro Morales	29/7/2002
Carlos Arturo Narvaez	16/7/1970
Adriana Medina	23/12/1971
Sebas Blanco	7/1/2003
Carlos Augusto Becerra Sánchez 	7/8/1969
Armando Vargas Diaz	14/3/1972
Sandra Vanegas	9/11/1974
Jesús David Traslaviña Fuentes	27/11/2002
Luz Stella Manchola Herrera	5/8/1972
Hernando Chaparro	11/9/1971
Juan Pablo León Samper	25/6/2005
Juan José Bernal Delgado 	3/9/2007
Laura Valentina Santamaría	4/11/1998
Andrés Bernal 	29/10/1982
LILIAM PAOLA DELGADO PARDO	18/02/1983
María Angélica Bucheli Mendez	31/08
Sebastian Oyola Diaz	17/07/1995
ANDRES FELIPE OYOLA DIAZ 	16/1/2000
Vanessa García López 	21/10/2000
Gabriela Mendoza Suarez	10/9/2011
Danna Isabella Barrera Pérez	8/6/2010
LAURA DANIELA BARRERA RODRIGUEZ	5/2/2010
VALENTINA HERNANDEZ RODRIGUEZ	15/4/2008
Gabriela Poveda García	26/2/2011
Sofia Losada Perdomo	17/9/2007
Sofía Mantilla Álvarez	15/7/2010
Cathalina lopez sanabria	24/8/2010
Mariana Navarro	16/1/2008
Daniela Forero Granados	17/7/2008
María Margarita Ariza Morales	10/6/2010
Maria Paula Montes Laverde	30/6/2010
Sara Sofía Fuentes Basto	15/4/2008
Victoria Serrano Rivas	24/11/2009
Juanita del mar Suárez Quevedo	1/2/2010
María Alejandra Orjuela Herrera	17/4/2009
María Paula Bejarano Quevedo	13/2/2008
Victoria Bocanegra Montes	15/11/2010
Maríana de Los Ángeles Triviño Bonnett	11/10/2009
María Camila Lesmes Quintero	4/5/2009
Antonia Ospina Guerrero.	15/6/2009
Juan Camilo Niño Tamayo	14/1/2010
Marco Antonio Novoa Fandiño	31/5/2010
Alejandro Nicolás Páez Granados	2/9/2009
Santiago González Fernández	19/10/2008
Juan Esteban Novoa Marín	10/9/2009
Valentin Alejandro Olarte Pimentel	7/9/2007
Gabriel Rivera Diaz	10/3/2009
Thomas David Mayorga Suárez	2/10/2010
Juan Sebastián Murcia Rodríguez	18/9/2007
Andrés Santiago Pineda Martínez	10/3/2011
José Manuel Iguaran Cortes	19/3/2010
Cristian Santiago Arteaga Muñoz	16/12/2008
SANTIAGO IZQUIERDO BAQUERO	28/11/2009
Alex Samuel Botero Garcia	5/10/2008
Rafael Sabogal Salazar	6/1/2010
Juan José Gómez Gutiérrez	27/9/2009
Juan Daniel Gómez Gutiérrez	27/9/2009
Isaac Ortega Estupiñán	2/2/2008
Ihan Sebastián Huepe Sánchez	15/1/2010
Juan Diego Ocampo Maldonado	15/2/2011
Camilo Andrés Vargas Diaz	18/9/2010
Aitana Isabella Delgado Coral	8/8/2009
Amelia Olave Vanegas	1/8/2011
Andrés Santiago Pineda Martínez	10/3/2011
CRISTIAN FELIPE GONZALEZ MURCIA	25/12/2009
Dana Isabella Chamorro Sánchez	19/7/2010
Daniel Alejandro Gómez Reyes	14/5/2009
Emanuel Andres Fagua Romero	
Emilia dueñas	30/10/2007
German Andrés Manrique González	8/2/2010
Gomer Reuben Obispo	13/8/2010
Isabella Díaz Cañon	3/10/2009
Jesús Santiago Joya Doria	6/7/2011
JOAQUÍN JOSÉ PUYO DÍAZ	17/9/2010
Juan Andrés Aparicio Giraldo	10/2/2010
Juan David Maldonado Díaz	13/3/2009
Juan Diego Fonseca Granados	10/2/2009
Juan Diego Rojas Mayorga	2/9/2007
Juan Pablo borrero	16/3/2011
Juan Sebastián Tovar Vargas	7/9/2009
Laura Sofia Sanchez Suarez	22/9/2010
Leonardo Esteban Fonseca Baez	19/9/2009
María Camila Avila Hoyos	5/4/2010
Maria isabella hernandez rodriguez	11/8/2010
María José Verastegui O.	10/12/2009
Maria Lucia Joya Doria	6/7/2011
MARIA PAZ RODRIGUEZ VELANDIA	21/1/2010
Mariajose Diaz Guerrero	14/12/2010
Mauricio Ortiz Mahecha	1/10/2010
Samuel Alzate Lovera	20/12/2009
Samuel Arturo Pulido Rodriguez	22/3/2010
Samuel Diaz	3/4/2010
Sara Garcia Posada	4/1/2010
Sara Juliana Sanabria Diaz	13/8/2009
Sarah Aileen Angel  Merchan	24/4/2008
Sharon Valeria Moreno Villabon	13/7/2009
Tomás Ruiz Delgado	25/10/2010
Valentina Tapias López	9/10/2010
Juan Esteban Prieto Pulido	21/8/2010
María Paulina Sarmiento Hoyos	30/3/2007`;

function parseDate(str) {
    if (!str) return null;
    let parts = str.trim().split('/');
    if (parts.length < 2) return null;
    let d = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    let y = null;
    if (parts[2]) {
        y = parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        if (y === 8) y = 2008;
        if (y === 9) y = 2009;
        if (y === 10) y = 2010;
        if (y === 11) y = 2011;
        if (y === 19) y = 2019; // maybe typo but let's keep it
    }
    return { day: d, month: m, year: y || 2000 };
}

async function run() {
    const client = new Client({ 
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();

        // Drop current goals table if exists, or recreate
        await client.query(`DROP TABLE IF EXISTS servidores_goals;`);
        await client.query(`DROP TABLE IF EXISTS servidores;`);
        
        await client.query(`
            CREATE TABLE servidores (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                birthdate DATE,
                emergency_contact VARCHAR(255),
                emergency_phone VARCHAR(50),
                emergency_relation VARCHAR(100),
                eps VARCHAR(100),
                allergies TEXT,
                tickets_sold JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Map by normalized name
        const normalize = (name) => name.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');

        const servidoresMap = new Map();

        // 1. Process text list
        const lines = rawTextList.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            const parts = line.split('\t');
            const name = parts[0];
            const dateStr = parts[1];
            if (!name) continue;

            let bdate = parseDate(dateStr);
            let bdateStr = null;
            if (bdate) {
                bdateStr = `${bdate.year}-${String(bdate.month).padStart(2, '0')}-${String(bdate.day).padStart(2, '0')}`;
            }

            servidoresMap.set(normalize(name), {
                full_name: name.trim(),
                birthdate: bdateStr,
                emergency_contact: null,
                emergency_phone: null,
                emergency_relation: null,
                eps: null,
                allergies: null
            });
        }

        // 2. Process CSV
        const csvPath = 'Formulario Servidores V Retiro Bartimeo PJR - EXCEL - Respuestas de formulario 1.csv';
        if (fs.existsSync(csvPath)) {
            const fileContent = fs.readFileSync(csvPath, 'utf-8');
            const records = parse(fileContent, { columns: true, skip_empty_lines: true });
            
            for (let row of records) {
                const rawName = row['NOMBRE COMPLETO '];
                if (!rawName) continue;
                const name = rawName.trim();
                const normName = normalize(name);

                let existing = servidoresMap.get(normName) || {
                    full_name: name,
                    birthdate: null
                };

                existing.emergency_contact = row['NOMBRE DE UN CONTACTO DE EMERGENCIA'];
                existing.emergency_phone = row['TELÉFONO DEL CONTACTO DE EMERGENCIA'];
                existing.emergency_relation = row['PARENTESCO DEL CONTACTO DE EMERGENCIA'];
                existing.eps = row['Indica el nombre de la EPS o entidad de medicina prepagada a la que estás afiliado'];
                
                let allergies = [];
                if (row['¿Tienes alguna alergia? '] && row['¿Tienes alguna alergia? '].toLowerCase() !== 'no') {
                    allergies.push(row['¿Tienes alguna alergia? ']);
                }
                if (row['¿Tienes alguna restricción alimentaria? '] && row['¿Tienes alguna restricción alimentaria? '].toLowerCase() !== 'no') {
                    allergies.push(row['¿Tienes alguna restricción alimentaria? ']);
                }
                existing.allergies = allergies.join(', ');

                servidoresMap.set(normName, existing);
            }
        }

        // 3. Insert into DB
        for (let [, data] of servidoresMap) {
            await client.query(`
                INSERT INTO servidores 
                (full_name, birthdate, emergency_contact, emergency_phone, emergency_relation, eps, allergies)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                data.full_name, 
                data.birthdate, 
                data.emergency_contact, 
                data.emergency_phone, 
                data.emergency_relation, 
                data.eps, 
                data.allergies
            ]);
        }
        
        console.log(`✅ Database updated successfully. Inserted ${servidoresMap.size} records.`);
    } catch (e) {
        console.error("❌ Error updating database:", e);
    } finally {
        await client.end();
    }
}

run();
