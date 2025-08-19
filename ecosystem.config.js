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
      script: "node",
      args: "cron.js",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
