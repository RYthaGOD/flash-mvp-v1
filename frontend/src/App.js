import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { BitcoinWalletProvider } from './contexts/BitcoinWalletContext';
import TabbedInterface from './components/TabbedInterface';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

// Import wallet adapter CSS
require('@solana/wallet-adapter-react-ui/styles.css');

// Get network from environment variable
const getNetwork = () => {
  const networkEnv = process.env.REACT_APP_SOLANA_NETWORK || 'devnet';
  switch (networkEnv.toLowerCase()) {
    case 'mainnet-beta':
    case 'mainnet':
      return WalletAdapterNetwork.Mainnet;
    case 'testnet':
      return WalletAdapterNetwork.Testnet;
    case 'devnet':
    default:
      return WalletAdapterNetwork.Devnet;
  }
};

// Get RPC endpoint - use custom or default cluster URL
const getRpcEndpoint = (network) => {
  const customRpc = process.env.REACT_APP_SOLANA_RPC_URL;
  if (customRpc) {
    return customRpc;
  }
  return clusterApiUrl(network);
};

function App() {
  const network = getNetwork();
  const endpoint = useMemo(() => getRpcEndpoint(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ErrorBoundary>
      <BitcoinWalletProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <div className="App">
              <TabbedInterface />
            </div>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
      </BitcoinWalletProvider>
    </ErrorBoundary>
  );
}

export default App;
