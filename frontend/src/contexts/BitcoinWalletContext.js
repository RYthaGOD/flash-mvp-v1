import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const BitcoinWalletContext = createContext();

export const useBitcoinWallet = () => {
  const context = useContext(BitcoinWalletContext);
  if (!context) {
    throw new Error('useBitcoinWallet must be used within BitcoinWalletProvider');
  }
  return context;
};

export const BitcoinWalletProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [network, setNetwork] = useState('testnet');
  const [walletType, setWalletType] = useState(''); // 'unisat', 'xverse', etc.
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if wallet is available
  const checkWalletAvailability = useCallback(async (walletName) => {
    if (typeof window === 'undefined') return false;

    try {
      switch (walletName) {
        case 'unisat':
          return typeof window.unisat !== 'undefined';
        case 'xverse':
          return typeof window.BitcoinProvider !== 'undefined' ||
                 (window.XverseProviders && typeof window.XverseProviders.bitcoin !== 'undefined');
        default:
          return false;
      }
    } catch (err) {
      console.warn(`Wallet ${walletName} not available:`, err.message);
      return false;
    }
  }, []);

  // Connect Unisat wallet
  const connectUnisat = useCallback(async () => {
    if (!await checkWalletAvailability('unisat')) {
      throw new Error('Unisat wallet not found. Please install Unisat extension.');
    }

    try {
      setLoading(true);
      setError('');

      // Request accounts
      const accounts = await window.unisat.requestAccounts();
      const address = accounts[0];

      // Get public key
      const publicKey = await window.unisat.getPublicKey();

      // Get network
      const network = await window.unisat.getNetwork();

      // Get balance
      const balance = await window.unisat.getBalance();

      setAddress(address);
      setPublicKey(publicKey);
      setNetwork(network);
      setWalletType('unisat');
      setBalance(balance.confirmed + balance.unconfirmed);
      setConnected(true);

    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [checkWalletAvailability]);

  // Connect Xverse wallet
  const connectXverse = useCallback(async () => {
    if (!await checkWalletAvailability('xverse')) {
      throw new Error('Xverse wallet not found. Please install Xverse extension.');
    }

    try {
      setLoading(true);
      setError('');

      // Xverse connection logic
      const provider = window.BitcoinProvider || window.XverseProviders?.bitcoin;

      // Request connection
      await provider.connect();

      // Get address and network info
      const accounts = await provider.getAccounts();
      const address = accounts[0];

      // Get balance
      const balance = await provider.getBalance();

      setAddress(address);
      setNetwork('testnet'); // Xverse handles network internally
      setWalletType('xverse');
      setBalance(balance);
      setConnected(true);

    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [checkWalletAvailability]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      if (walletType === 'unisat' && window.unisat) {
        // Unisat doesn't have explicit disconnect, just clear state
      }
      // Clear all wallet state
      setConnected(false);
      setAddress('');
      setPublicKey('');
      setWalletType('');
      setBalance(0);
      setError('');
    } catch (err) {
      console.error('Error disconnecting wallet:', err);
    }
  }, [walletType]);

  // Send Bitcoin transaction
  const sendBitcoin = useCallback(async (toAddress, amount) => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }

    // Basic address validation
    if (!toAddress || typeof toAddress !== 'string') {
      throw new Error('Invalid recipient address: address is empty or not a string');
    }

    if (network === 'testnet') {
      if (!toAddress.startsWith('tb1') && !toAddress.startsWith('m') && !toAddress.startsWith('n') && !toAddress.startsWith('2')) {
        console.warn('Address may not be valid for testnet:', toAddress);
        // Don't throw error, let wallet handle validation
      }
    } else if (network === 'mainnet') {
      if (!toAddress.startsWith('bc1') && !toAddress.startsWith('1') && !toAddress.startsWith('3')) {
        console.warn('Address may not be valid for mainnet:', toAddress);
        // Don't throw error, let wallet handle validation
      }
    }

    try {
      setLoading(true);
      setError('');
      console.log('Sending BTC transaction:', { toAddress, amount, walletType, network });

      let txHash;

      if (walletType === 'unisat') {
        // Check if unisat is available
        if (!window.unisat) {
          throw new Error('Unisat wallet not found. Please install Unisat extension.');
        }

        // Check if sendBitcoin method exists
        if (typeof window.unisat.sendBitcoin !== 'function') {
          throw new Error('Unisat wallet does not support sendBitcoin method');
        }

        // Convert amount to satoshis
        const satoshis = Math.floor(amount * 100000000);
        console.log('Unisat sendBitcoin params:', { toAddress, satoshis, btcAmount: amount, network });

        // Validate address format for testnet
        if (network === 'testnet' && !toAddress.startsWith('tb1') && !toAddress.startsWith('m') && !toAddress.startsWith('n')) {
          console.warn('Address may not be valid for testnet:', toAddress);
        }

        try {
          txHash = await window.unisat.sendBitcoin(toAddress, satoshis);
          console.log('Unisat transaction result:', txHash);
        } catch (walletError) {
          console.error('Unisat wallet error:', walletError);
          throw new Error(`Unisat transaction failed: ${walletError.message}`);
        }

        // Update balance after transaction
        const newBalance = await window.unisat.getBalance();
        setBalance(newBalance.confirmed + newBalance.unconfirmed);

      } else if (walletType === 'xverse') {
        const provider = window.BitcoinProvider || window.XverseProviders?.bitcoin;

        if (!provider) {
          throw new Error('Xverse wallet not found. Please install Xverse extension.');
        }

        // Check if sendBitcoin method exists
        if (typeof provider.sendBitcoin !== 'function') {
          throw new Error('Xverse wallet does not support sendBitcoin method');
        }

        const tx = {
          to: toAddress,
          amount: amount,
          network: network
        };
        console.log('Xverse sendBitcoin params:', tx);

        // Validate address format for testnet
        if (network === 'testnet' && !toAddress.startsWith('tb1') && !toAddress.startsWith('m') && !toAddress.startsWith('n')) {
          console.warn('Address may not be valid for testnet:', toAddress);
        }

        try {
          txHash = await provider.sendBitcoin(tx);
          console.log('Xverse transaction result:', txHash);
        } catch (walletError) {
          console.error('Xverse wallet error:', walletError);
          throw new Error(`Xverse transaction failed: ${walletError.message}`);
        }
      } else {
        throw new Error('Unknown wallet type: ' + walletType);
      }

      return txHash;

    } catch (err) {
      console.error('Wallet send error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [connected, walletType, network]);

  // Sign message for verification
  const signMessage = useCallback(async (message) => {
    if (!connected) {
      throw new Error('Wallet not connected');
    }

    try {
      if (walletType === 'unisat') {
        return await window.unisat.signMessage(message);
      } else if (walletType === 'xverse') {
        const provider = window.BitcoinProvider || window.XverseProviders?.bitcoin;
        return await provider.signMessage(message);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [connected, walletType]);

  // Auto-connect on page load if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      const savedWalletType = localStorage.getItem('bitcoinWalletType');
      if (savedWalletType) {
        try {
          if (savedWalletType === 'unisat') {
            await connectUnisat();
          } else if (savedWalletType === 'xverse') {
            await connectXverse();
          }
        } catch (err) {
          console.warn('Auto-connect failed:', err.message);
          localStorage.removeItem('bitcoinWalletType');
        }
      }
    };

    autoConnect();
  }, [connectUnisat, connectXverse]);

  // Save wallet type to localStorage
  useEffect(() => {
    if (connected && walletType) {
      localStorage.setItem('bitcoinWalletType', walletType);
    } else {
      localStorage.removeItem('bitcoinWalletType');
    }
  }, [connected, walletType]);

  const value = {
    // State
    connected,
    address,
    publicKey,
    network,
    walletType,
    balance,
    loading,
    error,

    // Methods
    connectUnisat,
    connectXverse,
    disconnect,
    sendBitcoin,
    signMessage,
    checkWalletAvailability,
  };

  return (
    <BitcoinWalletContext.Provider value={value}>
      {children}
    </BitcoinWalletContext.Provider>
  );
};
