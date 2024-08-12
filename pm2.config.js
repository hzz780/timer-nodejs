module.exports = {
  apps: [
    {
      name: 'restart-timer',
      script: './src/index.ts',
      interpreter: './node_modules/.bin/ts-node',
      // watch: true,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
