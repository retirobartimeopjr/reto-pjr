module.exports = {
    apps: [
        {
            name: 'bartimeo',
            script: './dist/server/entry.mjs',
            instances: 2,
            exec_mode: 'cluster',
            env: {
                HOST: '127.0.0.1',
                PORT: 3000,
                NODE_ENV: 'production',
                PGHOST: '127.0.0.1',
                PGUSER: 'postgres',
                PGPASSWORD: 'BartimeoRoot2026!*',
                PGDATABASE: 'bartimeodb',
                PGPORT: '5432'
            },
        },
    ],
};
