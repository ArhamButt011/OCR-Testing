module.exports = {
  apps: [
    {
      name: "pod-ocr-app",
      cwd: "/workspace/var/www/POD-OCR",
      script: "npm",
      args: "run start:prod",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "pod-ocr-cron",
      cwd: "/workspace/var/www/POD-OCR",
      script: "./cron.js", // Direct path to script
      interpreter: "node", // Specify interpreter
      env: {
        NODE_ENV: "production",
      },
      // Additional PM2 options for better process management
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      // Capture all output
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};