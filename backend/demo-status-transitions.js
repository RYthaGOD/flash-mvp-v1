
const axios = require('./axiosClient');

async function demonstrateStatusTransitions(txId) {
  const baseUrl = 'http://localhost:3002';
  
  console.log('🚀 Demonstrating Bridge Status Transitions');
  console.log('Transaction ID:', txId);
  console.log('='.repeat(50));
  
  // Check initial status
  try {
    const response = await axios.get(\\/api/bridge/transaction/\\);
    console.log('Initial Status:', response.data.transaction.status);
  } catch (error) {
    console.log('Error getting initial status:', error.message);
    return;
  }
  
  // Simulate status transitions
  const transitions = [
    { status: 'pending', delay: 1000 },
    { status: 'processing', delay: 2000 },
    { status: 'confirmed', delay: 1000 }
  ];
  
  for (const transition of transitions) {
    await new Promise(resolve => setTimeout(resolve, transition.delay));
    
    try {
      await axios.patch(\\/api/bridge/transaction/\/status\, {
        status: transition.status,
        notes: \Status changed to \\
      });
      console.log(\✅ Status updated to: \\);
    } catch (error) {
      console.log(\❌ Error updating to \:\, error.message);
    }
  }
  
  console.log('');
  console.log('🎉 Status transition demonstration complete!');
}

// Use the transaction ID from our last test
demonstrateStatusTransitions('demo_1764567306470_rwhbi');

