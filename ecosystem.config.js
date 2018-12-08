module.exports = {
  apps : [{
    name: 'viddl-be',
    script: './packages/viddl-be/ts_build/index.js',

    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      VIDDL_BACKEND_PORT: '8080'
    }
  }],
};
