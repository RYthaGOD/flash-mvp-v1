const axios = require('axios');

const clientHeader = (process.env.CLIENT_API_KEY || process.env.CLIENT_ID || '').trim();

if (clientHeader) {
  axios.interceptors.request.use((config) => {
    const updatedConfig = { ...config };
    updatedConfig.headers = updatedConfig.headers || {};
    if (!updatedConfig.headers['x-client-id']) {
      updatedConfig.headers['x-client-id'] = clientHeader;
    }
    return updatedConfig;
  });
}

module.exports = axios;

