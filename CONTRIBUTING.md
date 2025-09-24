# Contributing to FlexLiving Reviews Dashboard

First off, thank you for considering contributing to the FlexLiving Reviews Dashboard! It's people like you that make this project better for everyone.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Guidelines](#development-guidelines)
- [Testing Requirements](#testing-requirements)
- [Documentation Standards](#documentation-standards)
- [Review Process](#review-process)
- [Community](#community)

## 🤝 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@flexliving.com](mailto:conduct@flexliving.com).

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x LTS or higher
- Docker and Docker Compose
- Git
- A GitHub account

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/reviews-dashboard.git
   cd reviews-dashboard
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/flexliving/reviews-dashboard.git
   ```

4. **Set up development environment**:
   ```bash
   ./scripts/setup.sh
   ```

5. **Start development servers**:
   ```bash
   ./start-dev.sh
   ```

6. **Verify setup**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/api/health

## 🛠️ How to Contribute

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug Reports**: Help us identify and fix bugs
- 💡 **Feature Requests**: Suggest new features or improvements
- 🔧 **Code Contributions**: Submit bug fixes or new features
- 📚 **Documentation**: Improve or add documentation
- 🧪 **Testing**: Add or improve tests
- 🎨 **Design**: Improve UI/UX design
- 📊 **Performance**: Optimize performance and efficiency

### Contribution Workflow

1. **Check existing issues** first to avoid duplicating work
2. **Create an issue** for your bug report or feature request (if one doesn't exist)
3. **Get approval** for significant changes by commenting on the issue
4. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes** following our guidelines
6. **Write tests** for your changes
7. **Test thoroughly** locally
8. **Commit your changes** using conventional commits
9. **Push to your fork** and create a pull request

### Issue Guidelines

#### Bug Reports

Use the bug report template and include:

- **Clear title** and description
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Environment details** (OS, Node version, etc.)
- **Screenshots** or error logs if applicable
- **Minimal reproduction case** if possible

#### Feature Requests

Use the feature request template and include:

- **Clear use case** and problem description
- **Proposed solution** with implementation details
- **Alternative solutions** considered
- **Mockups or diagrams** if applicable
- **Impact assessment** on existing functionality

### Pull Request Guidelines

#### Before Submitting

- [ ] Run all tests locally (`npm run test`)
- [ ] Run linting (`npm run lint`)
- [ ] Check formatting (`npm run format:check`)
- [ ] Update documentation if needed
- [ ] Add tests for new functionality
- [ ] Test in different browsers (for frontend changes)

#### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Fixes #(issue number)

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots to help explain your changes

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

## 👩‍💻 Development Guidelines

### Code Style

We use strict linting and formatting rules to ensure consistent code quality:

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration with custom rules
- **Prettier**: Automatic code formatting
- **Husky**: Pre-commit hooks for quality checks

### Coding Standards

#### TypeScript

```typescript
// ✅ Good: Use explicit types
interface ReviewData {
  id: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
}

// ❌ Bad: Avoid any types
const processData = (data: any) => {
  // ...
};

// ✅ Good: Use proper error handling
try {
  await reviewService.create(reviewData);
} catch (error) {
  logger.error('Failed to create review', { error, reviewData });
  throw new ServiceError('Review creation failed');
}
```

#### React Components

```tsx
// ✅ Good: Use TypeScript interfaces for props
interface ReviewCardProps {
  review: Review;
  onApprove: (reviewId: string) => void;
  onReject: (reviewId: string) => void;
}

export function ReviewCard({ review, onApprove, onReject }: ReviewCardProps) {
  return (
    <div className="review-card">
      {/* Component content */}
    </div>
  );
}

// ✅ Good: Use proper hooks and state management
export function useReviews(filters: ReviewFilters) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Implementation
  
  return { reviews, loading, error };
}
```

#### API Endpoints

```typescript
// ✅ Good: Proper validation and error handling
router.post('/reviews/:id/approve', 
  [
    param('id').isUUID(),
    body('approvedBy').notEmpty(),
    body('notes').optional().isString()
  ],
  validateRequest,
  auth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { approvedBy, notes } = req.body;
      
      const result = await reviewService.approve(id, { approvedBy, notes });
      
      res.json({ success: true, review: result });
    } catch (error) {
      logger.error('Review approval failed', { error, reviewId: req.params.id });
      res.status(500).json({ 
        error: 'Failed to approve review',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);
```

### File Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI components (Button, Input, etc.)
│   └── feature/        # Feature-specific components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and configurations
├── pages/              # Next.js pages (App Router)
├── services/           # API services and business logic
├── types/              # TypeScript type definitions
└── utils/              # Helper functions
```

### Naming Conventions

- **Files**: `kebab-case.ts` or `PascalCase.tsx` for components
- **Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`

### Environment Variables

- Use descriptive names with consistent prefixes
- Document all variables in `.env.example`
- Use validation for required variables
- Never commit actual secrets

## 🧪 Testing Requirements

### Test Coverage

We aim for high test coverage across all code:

- **Unit Tests**: 90%+ coverage
- **Integration Tests**: All critical user flows
- **E2E Tests**: Major user journeys
- **Performance Tests**: Key endpoints under load

### Test Structure

```typescript
// ✅ Good: Descriptive test structure
describe('ReviewService', () => {
  describe('approve', () => {
    it('should approve a pending review successfully', async () => {
      // Arrange
      const review = await createTestReview({ status: 'pending' });
      const approvalData = {
        approvedBy: 'test@example.com',
        notes: 'Approved after verification'
      };

      // Act
      const result = await reviewService.approve(review.id, approvalData);

      // Assert
      expect(result.status).toBe('approved');
      expect(result.auditLog).toHaveLength(1);
      expect(result.auditLog[0].action).toBe('approved');
    });

    it('should throw error when approving non-existent review', async () => {
      // Arrange
      const invalidId = 'non-existent-id';

      // Act & Assert
      await expect(reviewService.approve(invalidId, {}))
        .rejects.toThrow('Review not found');
    });
  });
});
```

### Test Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- reviewService.test.ts

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## 📚 Documentation Standards

### Code Documentation

- **JSDoc comments** for public functions and classes
- **README files** for complex modules
- **Inline comments** for complex logic
- **Type definitions** with descriptions

### API Documentation

- Document all endpoints with examples
- Include request/response schemas
- Provide error code explanations
- Add usage examples

### User Documentation

- Clear step-by-step instructions
- Include screenshots for UI features
- Provide troubleshooting guides
- Keep examples up-to-date

## 🔍 Review Process

### Code Review Checklist

#### For Authors

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] CI checks pass

#### For Reviewers

- [ ] Code is clear and maintainable
- [ ] Logic is sound and efficient
- [ ] Tests are comprehensive
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Documentation is accurate

### Review Timeline

- **Initial Review**: Within 2 business days
- **Follow-up Reviews**: Within 1 business day
- **Merge Timeline**: After approval + CI success

### Approval Requirements

- **Minor Changes**: 1 approving review
- **Major Changes**: 2 approving reviews
- **Breaking Changes**: 3 approving reviews + maintainer approval

## 🏷️ Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history:

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```bash
feat(api): add Google Reviews import endpoint

- Add endpoint for importing reviews from Google Places
- Implement normalization for Google review data
- Add tests for new functionality

Closes #123

fix(frontend): resolve pagination issue in reviews table

The pagination component was not updating correctly when 
filters were applied. This fix ensures the page resets 
to 1 when filters change.

Fixes #456

docs: update API documentation for review approval

- Add examples for bulk approval endpoint
- Update error code descriptions
- Fix typos in authentication section
```

## 🎯 Branch Strategy

### Branch Types

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/**: Feature development branches
- **hotfix/**: Critical bug fixes
- **release/**: Release preparation branches

### Branch Naming

- `feature/issue-number-short-description`
- `fix/issue-number-bug-description`
- `hotfix/critical-issue-description`
- `docs/documentation-update`

### Workflow

1. Create feature branch from `main`
2. Develop and test your changes
3. Create PR to `main`
4. After approval and CI success, merge to `main`
5. Delete feature branch after merge

## 🏆 Recognition

### Contributors

We recognize contributors in several ways:

- **README Contributors**: Listed in project README
- **Release Notes**: Mentioned in changelog
- **Hall of Fame**: Annual recognition program
- **Swag**: Stickers and merchandise for regular contributors

### Contribution Types

- 🐛 **Bug Reporter**: Found and reported bugs
- 💻 **Code Contributor**: Contributed code changes
- 📖 **Documentation**: Improved documentation
- 🧪 **Tester**: Added or improved tests
- 🎨 **Designer**: Improved UI/UX
- 💬 **Community**: Helped in discussions and issues

## 💬 Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Stack Overflow**: Technical questions (tag: `flexliving-reviews`)
- **Email**: [dev@flexliving.com](mailto:dev@flexliving.com) for private discussions

### Community Guidelines

- Be respectful and inclusive
- Stay on topic in discussions
- Search existing issues before creating new ones
- Provide constructive feedback
- Help newcomers get started

## ❓ Getting Help

### Development Issues

1. Check existing issues and documentation
2. Search Stack Overflow with relevant tags
3. Ask in GitHub Discussions
4. Join our community calls (schedule in discussions)

### Contribution Questions

- Comment on relevant issues
- Start a discussion for general questions
- Email the maintainers for private matters

## 🎉 Thank You!

Your contributions make this project better for everyone. We appreciate:

- Your time and effort
- Your patience during the review process
- Your commitment to quality
- Your positive attitude and collaboration

Happy contributing! 🚀

---

*This contribution guide is a living document. Please suggest improvements via issues or pull requests.*
