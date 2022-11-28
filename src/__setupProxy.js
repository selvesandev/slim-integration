const { createProxyMiddleware } = require('http-proxy-middleware');

const proxy = {
    // target: 'http://pacs.moichor.us:8042',
    target: 'http://localhost/orthanc',
    changeOrigin: true,
};

module.exports = (app) => {
    app.use(
      '/api',
      createProxyMiddleware(proxy),
    );
};