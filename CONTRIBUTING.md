# Contributing to FLASH Bridge

Thank you for your interest in contributing to FLASH Bridge! We welcome contributions from developers of all skill levels. This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Set up** development environment
4. **Create** a feature branch
5. **Make** your changes
6. **Test** thoroughly
7. **Submit** a pull request

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ and npm 8+
- Git
- (Optional) Solana CLI for local development
- (Optional) Rust/Anchor for Solana program development

### Setup Commands

```bash
# Clone your fork
git clone https://github.com/yourusername/flash-bridge.git
cd flash-bridge

# Install all dependencies
npm run install:all

# Start development servers
npm run demo  # Starts both backend and frontend

# Or run individually:
npm run start:backend   # Backend on :3001
npm run start:frontend  # Frontend on :3000
```

### Environment Configuration

```bash
# Copy and configure environment
cd backend
cp .env.example .env
echo "ENABLE_ARCIUM_MPC=true" >> .env

# Run configuration check
npm run check
```

## 📋 Contribution Guidelines

### Code Style
- Use TypeScript for type safety
- Follow ESLint configuration
- Use Prettier for code formatting
- Write meaningful commit messages
- Add JSDoc comments for public APIs

### Commit Messages
```
feat: add new privacy verification endpoint
fix: resolve ESLint error in TokenManagementTab
docs: update API documentation
test: add unit tests for bridge service
refactor: simplify MPC integration logic
```

### Testing
- Write unit tests for new features
- Add integration tests for API endpoints
- Test with both mock and real services
- Ensure all tests pass before submitting PR

## 🎯 Areas for Contribution

### 🔒 Privacy & Security
- Enhance MPC integration
- Add additional privacy layers
- Security hardening
- Audit preparation

### 🌐 Multi-Chain Support
- Add support for new blockchains (ETH, BSC, MATIC)
- Improve existing chain integrations
- Cross-chain messaging protocols

### ⚡ Performance & Scalability
- Optimize transaction processing
- Improve API response times
- Database query optimization
- Caching strategies

### 🎨 User Experience
- Mobile app development
- UI/UX improvements
- Accessibility enhancements
- Internationalization (i18n)

### 📚 Documentation & Education
- API documentation
- Tutorial creation
- Video content
- Developer guides

### 🧪 Testing & Quality
- Unit test coverage
- Integration testing
- E2E test automation
- Performance testing

## 🔄 Pull Request Process

### 1. Choose an Issue
- Check [GitHub Issues](https://github.com/yourusername/flash-bridge/issues) for open tasks
- Comment on the issue to indicate you're working on it
- Create an issue if you have a new idea

### 2. Create a Branch
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-number-description
```

### 3. Make Changes
- Follow the existing code patterns
- Add tests for new functionality
- Update documentation as needed
- Ensure all checks pass

### 4. Test Your Changes
```bash
# Run all tests
npm test

# Run linting
npm run lint

# Manual testing
# - Test bridge functionality
# - Test privacy features
# - Test error scenarios
```

### 5. Submit Pull Request
- Provide a clear description of changes
- Reference related issues
- Include screenshots for UI changes
- Request review from maintainers

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots of UI changes

## Related Issues
Closes #123
```

## 🐛 Bug Reports

### Good Bug Report
- Clear title describing the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots or error logs
- Code snippets if applicable

### Bug Report Template
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
- OS: [e.g., macOS, Windows]
- Browser: [e.g., Chrome, Safari]
- Node Version: [e.g., 18.17.0]
```

## 💡 Feature Requests

### Good Feature Request
- Clear title and description
- Use case and benefits
- Implementation suggestions
- Mockups or examples
- Related issues or PRs

### Feature Request Template
```markdown
**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
```

## 📞 Communication

### Where to Ask Questions
- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Real-time chat (#dev-support channel)

### Getting Help
- Check existing documentation first
- Search GitHub issues for similar problems
- Ask in Discord for quick questions
- Create GitHub issue for detailed help

## 🎖️ Recognition

Contributors are recognized in:
- **README.md** contributors section
- **GitHub repository insights**
- **Monthly contributor spotlight**
- **Hackathon and grant acknowledgments**

## 📜 License

By contributing to FLASH Bridge, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You

Your contributions help build the privacy-preserving future of cross-chain DeFi. Every contribution, no matter how small, makes a difference!

Happy coding! 🚀🔒