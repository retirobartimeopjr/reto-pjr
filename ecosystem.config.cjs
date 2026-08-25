const dotenv = require('dotenv');
const parsedEnv = dotenv.config().parsed || {};

module.exports = {
    apps: [
        {
            name: 'bartimeo',
            script: './dist/server/entry.mjs',
            instances: 'max',
            exec_mode: 'cluster',
            env: {
                ...parsedEnv,
                HOST: '127.0.0.1',
                PORT: 3000,
                NODE_ENV: 'production'
                // NOTA: Las variables de PostgreSQL se cargan dinámicamente arriba
                // con dotenv.config() para evitar exponer secretos en el repo.
            },
        },
        {
            name: 'reporte-diario',
            script: './scripts/daily_report.js',
            instances: 1,
            exec_mode: 'fork',
            cron_restart: '0 6 * * *',
            autorestart: false,
            env: {
                ...parsedEnv,
                NODE_ENV: 'production'
            }
        }
    ],
};
