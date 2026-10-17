module.exports = {
  apps: [
    {
      name: 'finsathi-os',
      script: 'server/mcp-server.mjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
