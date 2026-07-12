module.exports = {
    apps: [
        {
            name: 'bartimeo',
            script: './dist/server/entry.mjs',
            instances: 'max',
            exec_mode: 'cluster',
            env: {
                HOST: '127.0.0.1',
                PORT: 3000,
                NODE_ENV: 'production'
                // NOTA: Las variables de PostgreSQL (PGHOST, PGUSER, PGPASSWORD, etc.)
                // NO DEBEN IR AQUÍ. Deben cargarse desde el archivo .env del servidor
                // para evitar exponer secretos en el control de versiones.
            },
        },
    ],
};
