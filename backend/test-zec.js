#!/usr/bin/env node

/**
 * Test ZEC Token Availability on Jupiter
 */

const { createJupiterApiClient } = require('@jup-ag/api');

async function testUserZECMint() {
  const jupiter = createJupiterApiClient();
  const zecMint = 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS'; // User's ZEC mint
  const solMint = 'So11111111111111111111111111111111111111112';

  try {
    console.log(`🔍 Testing user's ZEC mint: ${zecMint}`);

    // Try to get a quote: ZEC -> SOL
    const quote = await jupiter.quoteGet({
      inputMint: zecMint,
      outputMint: solMint,
      amount: '1000000', // 1 ZEC (assuming 6 decimals)
      slippageBps: 100,
    });

    console.log(`✅ ZEC -> SOL Available!`);
    console.log(`  Input: ${quote.inAmount} (lamports)`);
    console.log(`  Output: ${quote.outAmount} (lamports)`);
    console.log(`  Route: ${quote.routePlan[0]?.swapInfo?.label || 'Unknown'}`);

    // Try reverse: SOL -> ZEC
    const reverseQuote = await jupiter.quoteGet({
      inputMint: solMint,
      outputMint: zecMint,
      amount: '1000000000', // 1 SOL (9 decimals)
      slippageBps: 100,
    });

    console.log(`✅ SOL -> ZEC Available!`);
    console.log(`  Input: ${reverseQuote.inAmount} (lamports)`);
    console.log(`  Output: ${reverseQuote.outAmount} (lamports)`);

    return true;

  } catch (error) {
    console.log(`❌ ZEC mint not available: ${error.message}`);
    return false;
  }
}

testUserZECMint().then(success => {
  if (success) {
    console.log(`\n🎯 ZEC mint ${zecMint} is ready for Jupiter swaps!`);
  } else {
    console.log(`\n❌ ZEC mint needs liquidity or different address`);
  }
}).catch(console.error);
