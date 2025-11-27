// Centralized Axios mocking utilities for consistent HTTP mocking

const mockAxiosResponse = (data, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {}
});

const mockAxiosError = (message, status = 404) => {
  const error = new Error(message);
  error.response = {
    data: { error: message },
    status,
    statusText: 'Not Found',
    headers: {},
    config: {}
  };
  error.isAxiosError = true;
  return error;
};

// Create mock axios instance with common blockchain API responses
const createMockAxios = () => {
  const mockAxios = jest.fn();

  // Default successful response
  mockAxios.mockResolvedValue(mockAxiosResponse({}));

  // Add specific mock implementations
  mockAxios.get = jest.fn().mockResolvedValue(mockAxiosResponse({}));
  mockAxios.post = jest.fn().mockResolvedValue(mockAxiosResponse({}));
  mockAxios.put = jest.fn().mockResolvedValue(mockAxiosResponse({}));
  mockAxios.delete = jest.fn().mockResolvedValue(mockAxiosResponse({}));

  return mockAxios;
};

// Mock implementations for specific services
const mockBitcoinAPI = () => {
  const axios = createMockAxios();

  // Mock Bitcoin transaction verification
  axios.get.mockImplementation((url) => {
    if (url.includes('/tx/')) {
      return Promise.resolve(mockAxiosResponse({
        txid: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z',
        confirmations: 6,
        vout: [
          {
            value: 0.1,
            scriptpubkey_address: 'bc1qtestaddress12345678901234567890'
          }
        ]
      }));
    }
    if (url.includes('/address/')) {
      return Promise.resolve(mockAxiosResponse([
        {
          txid: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z',
          confirmations: 10,
          amount: 0.1,
          time: Date.now() / 1000
        }
      ]));
    }
    return Promise.resolve(mockAxiosResponse({}));
  });

  return axios;
};

const mockZcashAPI = () => {
  const axios = createMockAxios();

  // Mock Zcash transaction verification
  axios.get.mockImplementation((url) => {
    if (url.includes('verify')) {
      return Promise.resolve(mockAxiosResponse({
        txid: 'zec1testtxhash123456789012345678901234567890',
        amount: 1.5,
        confirmations: 10,
        blockHeight: 1500000,
        timestamp: Date.now() / 1000,
        shielded: true
      }));
    }
    if (url.includes('balance')) {
      return Promise.resolve(mockAxiosResponse({
        balance: 5.25,
        confirmed: 5.0,
        unconfirmed: 0.25
      }));
    }
    if (url.includes('price')) {
      return Promise.resolve(mockAxiosResponse({
        zcash: { usd: 45.67 }
      }));
    }
    return Promise.resolve(mockAxiosResponse({}));
  });

  return axios;
};

const mockConverterAPI = () => {
  const axios = createMockAxios();

  // Mock price conversion APIs
  axios.get.mockImplementation((url) => {
    if (url.includes('coingecko') || url.includes('price')) {
      return Promise.resolve(mockAxiosResponse({
        bitcoin: { usd: 45000 },
        zcash: { usd: 45.67 }
      }));
    }
    return Promise.resolve(mockAxiosResponse({}));
  });

  return axios;
};

// Error simulation helpers
const simulateNetworkError = (axios) => {
  axios.get.mockRejectedValueOnce(mockAxiosError('Network Error', 500));
  axios.post.mockRejectedValueOnce(mockAxiosError('Network Error', 500));
};

const simulateTimeout = (axios) => {
  axios.get.mockRejectedValueOnce(mockAxiosError('Timeout', 408));
  axios.post.mockRejectedValueOnce(mockAxiosError('Timeout', 408));
};

const simulateNotFound = (axios) => {
  axios.get.mockRejectedValueOnce(mockAxiosError('Not Found', 404));
  axios.post.mockRejectedValueOnce(mockAxiosError('Not Found', 404));
};

module.exports = {
  mockAxiosResponse,
  mockAxiosError,
  createMockAxios,
  mockBitcoinAPI,
  mockZcashAPI,
  mockConverterAPI,
  simulateNetworkError,
  simulateTimeout,
  simulateNotFound
};
