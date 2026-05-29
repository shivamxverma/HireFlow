module.exports = {
  apps: [
    {
      name: "job-scraper-backend",
      script: "./dist/index.js",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        RUN_CRAWLER_ON_BOOT: "true"
      }
    }
  ]
};
