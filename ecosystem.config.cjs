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
                NODE_ENV: 'production',
            },
        },
    ],
};
