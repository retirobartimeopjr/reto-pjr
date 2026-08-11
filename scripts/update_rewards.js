import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pool, query } from '../src/lib/db.js';

// Calculate distance between two coordinates in kilometers using Haversine formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

async function run() {
  try {
    const jesucristoRes = await query(`SELECT * FROM parroquias WHERE name ILIKE '%Jesucristo Redentor%' LIMIT 1`);
    if (jesucristoRes.rows.length === 0) {
      console.error("Parroquia Jesucristo Redentor no encontrada");
      process.exit(1);
    }
    
    const jLat = parseFloat(jesucristoRes.rows[0].latitude);
    const jLon = parseFloat(jesucristoRes.rows[0].longitude);
    console.log(`Jesucristo Redentor: Lat ${jLat}, Lon ${jLon}`);
    
    const allParroquias = await query(`SELECT * FROM parroquias WHERE latitude IS NOT NULL AND longitude IS NOT NULL`);
    let count = 0;
    
    for (const p of allParroquias.rows) {
      const dist = getDistanceFromLatLonInKm(jLat, jLon, parseFloat(p.latitude), parseFloat(p.longitude));
      if (dist > 40) {
        console.log(`Updating ${p.name} (Distancia: ${dist.toFixed(2)} km) -> 800 pts`);
        await query(`UPDATE parroquias SET reward = 800 WHERE id = $1`, [p.id]);
        count++;
      }
    }
    
    console.log(`Updated ${count} parroquias!`);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
