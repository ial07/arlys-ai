module.exports = {
  apps: [
    {
      name: "arlys-ai",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
