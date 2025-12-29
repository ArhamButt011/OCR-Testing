// ecosystem.config.js

module.exports = {
  apps: [
    {
      name: "pod-ocr-app",
      cwd: "/workspace/var/www/POD-OCR",
      script: "npm",
      args: "start", // Changed from "run start:prod" to just "start"
      env: {
        NODE_ENV: "production",
        PORT: 3000, // Explicitly set port
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",
      error_file: "./logs/app-error.log",
      out_file: "./logs/app-out.log",
      log_file: "./logs/app-combined.log",
      time: true,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
    {
      name: "pod-ocr-cron",
      cwd: "/workspace/var/www/POD-OCR",
      script: "./cron.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      error_file: "./logs/cron-error.log",
      out_file: "./logs/cron-out.log",
      log_file: "./logs/cron-combined.log",
      time: true,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Restart on crash
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};