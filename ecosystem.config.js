module.exports = {
  apps: [
    {
      name: 'umanarayani-api',
      script: './server.js',
      instances: 1, // Fork mode ensures single-process reliability for node-cron schedulers
      exec_mode: 'fork',

      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      exp_backoff_restart_delay: 100, // Exponential backoff prevents CPU spikes on recurring crash

      // Memory limit: Gracefully restarts worker if RAM exceeds 500MB
      max_memory_restart: '500M',

      // Timeouts for graceful shutdown and boot
      kill_timeout: 5000,
      listen_timeout: 10000,

      // Structured logging & rotation targets
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Environment profiles
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
