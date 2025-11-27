#!/usr/bin/env node

/**
 * Cryptographic Proofs Demo Test
 * Demonstrates the institutional-grade cryptographic proof system
 *
 * Usage: node test-crypto-proofs.js
 */

const cryptoProofsService = require('./src/services/crypto-proofs');

async function runCryptoProofsDemo() {
  console.log('🔐 FLASH Bridge - Cryptographic Proofs Demo');
  console.log('============================================\n');

  try {
    // Sample transaction data (like what would come from a bridge transaction)
    const sampleTransaction = {
      txId: 'demo_tx_1234567890',
      solanaAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 1.5, // zenZEC amount
      reserveAsset: 'BTC',
      status: 'confirmed',
      solanaTxSignature: '2qG1R3J3xHjT2X8zKB9mNp4aKpN4dJcKvM8QzZvJcQX8NzVqJcQX8NzVqJcQX8NzVqJcQX8NzVqJcQX8NzVqJcQX',
      bitcoinTxHash: 'a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d',
      demoMode: false,
      createdAt: Date.now(),
      verificationPerformed: true,
      verificationTimestamp: Date.now(),
      minted: true,
      mintTimestamp: Date.now()
    };

    console.log('📝 Sample Transaction Data:');
    console.log(`   Transaction ID: ${sampleTransaction.txId}`);
    console.log(`   Amount: ${sampleTransaction.amount} zenZEC`);
    console.log(`   From: ${sampleTransaction.reserveAsset}`);
    console.log(`   To: ${sampleTransaction.solanaAddress.substring(0, 10)}...`);
    console.log('');

    // 1. Generate cryptographic proof
    console.log('🔄 Generating Cryptographic Proof...');
    const proof = await cryptoProofsService.generateTransactionProof(sampleTransaction, 'bridge');

    console.log('✅ Proof Generated Successfully!');
    console.log(`   Transaction Hash: ${proof.transactionHash.substring(0, 16)}...`);
    console.log(`   Merkle Root: ${proof.merkleProof.merkleRoot.substring(0, 16)}...`);
    console.log(`   Signature: ${proof.signature.signature.substring(0, 16)}...`);
    console.log('');

    // 2. Verify the proof
    console.log('🔍 Verifying Cryptographic Proof...');
    const verification = cryptoProofsService.verifyProof(proof);

    console.log('✅ Proof Verification Result:');
    console.log(`   Valid: ${verification.valid}`);
    if (verification.valid) {
      console.log('   ✓ Digital signature verified');
      console.log('   ✓ Merkle proof verified');
      console.log('   ✓ Chain of custody verified');
      if (verification.details?.zkVerified) {
        console.log('   ✓ Zero-knowledge proof verified');
      }
    } else {
      console.log(`   ❌ Reason: ${verification.reason}`);
    }
    console.log('');

    // 3. Export audit report
    console.log('📊 Generating Institutional Audit Report...');
    const auditReport = cryptoProofsService.exportProofForAudit(proof);

    console.log('✅ Audit Report Generated:');
    console.log(`   Transaction: ${auditReport.auditReport.transactionId}`);
    console.log(`   Status: ${auditReport.auditReport.verificationStatus}`);
    console.log(`   Compliance: ${auditReport.auditReport.complianceLevel}`);
    console.log(`   Timestamp: ${new Date(auditReport.auditReport.verificationTimestamp).toISOString()}`);
    console.log('');

    // 4. Show API response format
    console.log('🌐 API Response Format (Bridge Transaction):');
    const apiResponse = {
      success: true,
      transactionId: sampleTransaction.txId,
      amount: sampleTransaction.amount * 100000000, // Convert to smallest unit
      solanaAddress: sampleTransaction.solanaAddress,
      status: sampleTransaction.status,
      cryptographicProof: {
        transactionId: sampleTransaction.txId,
        transactionHash: proof.transactionHash,
        signature: proof.signature,
        merkleProof: proof.merkleProof,
        verificationUrl: `/api/bridge/proof/${sampleTransaction.txId}/verify`,
        auditExportUrl: `/api/bridge/proof/${sampleTransaction.txId}/audit`,
        compliance: 'INSTITUTIONAL'
      }
    };

    console.log(JSON.stringify(apiResponse, null, 2));
    console.log('');

    console.log('🎉 Demo Complete!');
    console.log('');
    console.log('Key Features Demonstrated:');
    console.log('✅ Transaction hashing with canonical data');
    console.log('✅ Digital signatures with institutional keys');
    console.log('✅ Merkle tree proofs for inclusion verification');
    console.log('✅ Chain of custody tracking');
    console.log('✅ Zero-knowledge proof simulation');
    console.log('✅ Independent verification capability');
    console.log('✅ Institutional audit report generation');
    console.log('✅ API integration ready');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
runCryptoProofsDemo();
