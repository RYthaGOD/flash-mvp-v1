# Contributing to FLASH Bridge

Thank you for your interest in contributing to FLASH Bridge! We welcome contributions from the community to help build the future of privacy-preserving cross-chain DeFi.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Security Considerations](#security-considerations)
- [Documentation](#documentation)

## 🤝 Code of Conduct

This project follows our [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold this code. Please report any unacceptable behavior via Twitter: [@moneybag_fin](https://twitter.com/moneybag_fin).

## 🚀 How to Contribute

### Types of Contributions

- **🐛 Bug Reports**: Found a bug? [Open an issue](./.github/ISSUE_TEMPLATE/bug_report.md)
- **✨ Feature Requests**: Have an idea? [Submit a feature request](./.github/ISSUE_TEMPLATE/feature_request.md)
- **🔧 Code Contributions**: Want to fix/improve something?
- **📚 Documentation**: Help improve our docs
- **🧪 Testing**: Add or improve tests
- **🔒 Security**: Report security issues responsibly

### Quick Start for Contributors

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/yourusername/flash-bridge.git`
3. **Create** a feature branch: `git checkout -b feature/your-feature-name`
4. **Make** your changes
5. **Test** your changes thoroughly
6. **Commit** with clear messages: `git commit -m "feat: add new feature"`
7. **Push** to your fork: `git push origin feature/your-feature-name`
8. **Open** a Pull Request

## 🛠️ Development Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **Git**: Latest version
- **Code Editor**: VS Code recommended (with ESLint and Prettier extensions)

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/flash-bridge.git
cd flash-bridge

# 2. Set up backend
cd backend
cp .env.example .env  # Configure your environment variables
npm install
npm run dev  # For development with hot reload

# 3. Set up frontend (in new terminal)
cd ../frontend
npm install
npm start

# 4. Optional: Set up local Solana validator
solana-test-validator --reset
```

### Environment Configuration

Create `.env` files based on the examples:

```env
# Backend .env
ENABLE_ARCIUM_MPC=true
SOLANA_RPC_URL=https://api.devnet.solana.com
PORT=3001

# Frontend .env
REACT_APP_API_URL=http://localhost:3001
```

## 🔄 Development Workflow

### Branch Naming Convention

- `feature/description`: New features
- `fix/description`: Bug fixes
- `docs/description`: Documentation updates
- `test/description`: Testing improvements
- `refactor/description`: Code refactoring

### Commit Message Format

We follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

Examples:
```
feat: add cryptographic proof verification
fix: resolve memory leak in proof cache
docs: update API documentation
test: add integration tests for bridge endpoints
```

### Pull Request Process

1. **Create PR**: Use our [PR template](./.github/PULL_REQUEST_TEMPLATE.md)
2. **Code Review**: At least one maintainer review required
3. **CI Checks**: All tests must pass
4. **Security Review**: Security implications assessed
5. **Merge**: Squash merge with descriptive commit message

## 🧪 Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
node test-crypto-proofs.js # Cryptographic proof tests
node test-crash-recovery.js # Crash recovery tests

# Frontend tests
cd frontend
npm test
```

### Test Categories

- **Unit Tests**: Individual functions and modules
- **Integration Tests**: API endpoints and service interactions
- **Security Tests**: Privacy and cryptographic validation
- **Crash Recovery Tests**: System stability under failure conditions

### Writing Tests

```javascript
const { expect } = require('chai');

describe('Cryptographic Proofs', () => {
  describe('generateTransactionProof()', () => {
    it('should generate valid proof for bridge transaction', async () => {
      const proof = await generateTransactionProof(transactionData, 'bridge');
      expect(proof).to.have.property('transactionHash');
      expect(proof).to.have.property('signature');
    });
  });
});
```

## 🔒 Security Considerations

### Privacy-First Development

FLASH Bridge prioritizes user privacy. When contributing:

- **Never log sensitive data** (amounts, addresses, private keys)
- **Use MPC encryption** for any transaction processing
- **Implement proper validation** for all inputs
- **Consider privacy implications** of new features

### Security Checklist

Before submitting a PR, ensure:

- [ ] No sensitive data logged or exposed
- [ ] Input validation implemented
- [ ] Error messages don't leak information
- [ ] MPC encryption maintained where required
- [ ] Cryptographic operations properly implemented
- [ ] Tests include security scenarios

### Reporting Security Issues

See our [Security Policy](./SECURITY.md) for responsible disclosure.

## 📚 Documentation

### Documentation Standards

- **README.md**: Updated for any user-facing changes
- **Code Comments**: JSDoc format for functions
- **API Documentation**: OpenAPI/Swagger format
- **Inline Comments**: Explain complex logic

### Documentation Updates

When making changes:

1. **Update README**: If adding new features or changing usage
2. **Update API Docs**: For any API changes
3. **Add Code Comments**: For complex algorithms
4. **Update Examples**: If usage patterns change

## 🎯 Areas for Contribution

### High Priority

- **🔒 Privacy Enhancements**: Improve MPC implementation
- **⚡ Performance Optimization**: Reduce transaction latency
- **🧪 Testing Coverage**: Increase test coverage to 80%+
- **📊 Monitoring**: Add better observability and metrics

### Medium Priority

- **🌐 Multi-Chain Support**: Additional blockchain integrations
- **🎨 Frontend Improvements**: Better user experience
- **📱 Mobile Support**: React Native mobile app
- **🔧 Developer Tools**: CLI tools and SDKs

### Future Opportunities

- **⚡ Layer 2 Integration**: Optimistic bridging
- **🔗 Cross-Chain DEX**: Automated token swaps
- **🏛️ Institutional Features**: Advanced compliance tools
- **📈 Analytics**: Transaction analytics and insights

## 💡 Getting Help

### Resources

- **📖 [README.md](./README.md)**: Quick start guide
- **🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)**: System design
- **🔒 [PRIVACY_FEATURES.md](./PRIVACY_FEATURES.md)**: Privacy implementation
- **🧪 [Testing Guide](./TESTING_GUIDE.md)**: Testing procedures

### Communication

- **💬 GitHub Discussions**: General questions and ideas
- **🐛 GitHub Issues**: Bug reports and feature requests
- **🐦 Twitter**: [@moneybag_fin](https://twitter.com/moneybag_fin) for sensitive matters

## 🙏 Recognition

Contributors will be:
- Listed in repository contributors
- Mentioned in release notes
- Eligible for bug bounty rewards
- Invited to governance discussions

Thank you for contributing to FLASH Bridge and helping build the future of privacy-preserving DeFi! 🚀✨