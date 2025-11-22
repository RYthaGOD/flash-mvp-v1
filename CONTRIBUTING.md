# Contributing to FLASH Bridge

Thank you for your interest in contributing to the FLASH Bridge project!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/flash-mvp.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes thoroughly
6. Commit with clear messages: `git commit -m "Add: description of your changes"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

### Prerequisites

- Solana CLI (v1.17.0+)
- Anchor CLI (v0.29.0)
- Node.js (v18+)
- Rust (stable)

### Setup

```bash
# Clone the repository
git clone https://github.com/RYthaGOD/flash-mvp.git
cd flash-mvp

# Run the setup script
./scripts/setup-localnet.sh
```

## Project Structure

```
flash-mvp/
├── programs/zenz_bridge/    # Solana program (Rust/Anchor)
├── backend/                  # Node.js backend server
├── frontend/                 # React frontend app
├── scripts/                  # Utility scripts
└── .github/workflows/        # CI/CD workflows
```

## Coding Standards

### Rust/Solana Program

- Follow Rust naming conventions
- Add comments for complex logic
- Write tests for new instructions
- Use `cargo fmt` before committing

### Backend (Node.js)

- Use ES6+ features
- Add JSDoc comments for functions
- Handle errors gracefully
- Write unit tests for new features

### Frontend (React)

- Use functional components with hooks
- Keep components focused and reusable
- Add PropTypes or TypeScript
- Follow React best practices

## Testing

### Solana Program

```bash
anchor test
```

### Backend

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm test
```

## Pull Request Guidelines

- **Title**: Clear and descriptive
- **Description**: Explain what changes you made and why
- **Tests**: Include tests for new features
- **Documentation**: Update README if needed
- **Small PRs**: Keep changes focused and manageable

## Code Review

All submissions require review. We'll:

- Check code quality and style
- Verify tests pass
- Ensure documentation is updated
- Review security implications

## Reporting Issues

Use GitHub Issues to report bugs or suggest features:

1. Check if the issue already exists
2. Use a clear, descriptive title
3. Provide steps to reproduce (for bugs)
4. Include system information
5. Add relevant logs or screenshots

## Security

For security issues, please email the maintainers directly instead of opening a public issue.

## Questions?

Open a GitHub Discussion or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to FLASH Bridge! 🚀
