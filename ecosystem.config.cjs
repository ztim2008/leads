/**
 * PM2 ecosystem — leads.konversus.ru
 *
 * ВАЖНО: leads-profi УДАЛЁН (Phase 0, 05.08.2026).
 * Profi на хабе не запускаем — только через VPS-агент партнёра.
 * См. src/config/hub.ts и docs/PHASE0_STABILIZATION.md
 */
module.exports = {
  apps: [
    {
      name: 'leads-konversus',
      script: 'node_modules/.bin/next',
      args: 'start --port 3005',
      cwd: '/var/www/www-root/data/www/leads.konversus.ru',
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 10000,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production', PORT: '3005' },
    },
    {
      name: 'leads-kwork',
      script: 'src/collectors/kwork-poller.ts',
      cwd: '/var/www/www-root/data/www/leads.konversus.ru',
      interpreter: '/usr/bin/npx',
      interpreter_args: 'tsx',
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 30000,
      max_memory_restart: '1024M',
    },
    {
      name: 'leads-health',
      script: 'src/collectors/health-monitor.ts',
      cwd: '/var/www/www-root/data/www/leads.konversus.ru',
      interpreter: '/usr/bin/npx',
      interpreter_args: 'tsx',
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 30000,
      max_memory_restart: '256M',
    },
  ],
};
