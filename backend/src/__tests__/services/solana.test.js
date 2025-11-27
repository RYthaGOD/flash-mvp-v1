const SolanaService = require('../../services/solana');

describe('SolanaService', () => {
  let solanaService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    delete require.cache[require.resolve('../../services/solana')];
    solanaService = require('../../services/solana');
  });

  describe('initialization', () => {
    test('should initialize service successfully', () => {
      expect(solanaService).toBeDefined();
      expect(typeof solanaService).toBe('object');
    });

    test('should have connection property', () => {
      expect(solanaService.connection).toBeDefined();
    });

    test('should have programId property', () => {
      expect(solanaService.programId).toBeDefined();
    });

    test('should get connection', () => {
      const connection = solanaService.getConnection();
      expect(connection).toBeDefined();
    });
  });

  describe('basic functionality', () => {
    test('should have getConnection method', () => {
      expect(typeof solanaService.getConnection).toBe('function');
      const connection = solanaService.getConnection();
      expect(connection).toBeDefined();
    });

    test('should have getProgram method', () => {
      expect(typeof solanaService.getProgram).toBe('function');
    });

    test('should have mintZenZEC method', () => {
      expect(typeof solanaService.mintZenZEC).toBe('function');
    });

    test('should have swapSOLToZenZEC method', () => {
      expect(typeof solanaService.swapSOLToZenZEC).toBe('function');
    });

    test('should have createBurnForBTCTransaction method', () => {
      expect(typeof solanaService.createBurnForBTCTransaction).toBe('function');
    });
  });
});