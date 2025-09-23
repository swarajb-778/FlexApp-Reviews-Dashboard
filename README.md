# FlexLiving Reviews Dashboard

A comprehensive dashboard for managing and analyzing guest reviews from multiple platforms, built with TypeScript, Express.js, PostgreSQL, and Redis.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🏗️ Project Overview

The FlexLiving Reviews Dashboard provides property management companies with a centralized platform to:

- **Aggregate Reviews**: Collect reviews from multiple channels (Airbnb, VRBO, Booking.com, Google)
- **Advanced Analytics**: Gain insights into guest satisfaction trends and performance metrics
- **Review Management**: Moderate, approve, and respond to guest reviews efficiently
- **Multi-property Support**: Manage reviews across entire property portfolios
- **Real-time Notifications**: Stay informed about new reviews and rating changes

## 🚀 Prerequisites

Before setting up the project, ensure you have:

- **Node.js** 20.0.0 or higher
- **Docker** and **Docker Compose**
- **Git** for version control
- **PostgreSQL** 15+ (handled by Docker)
- **Redis** 7+ (handled by Docker)

## ⚡ Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FlexApp
   ```

2. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

3. **Start the development environment**
   ```bash
   docker-compose up
   ```

4. **Verify the setup**
   ```bash
   curl http://localhost:4000/health
   ```

The application will be available at `http://localhost:4000`

## 🛠️ Development Commands

### Backend Development
```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

### Database Operations
```bash
# Run database migrations
npm run db:migrate

# Seed the database with sample data
npm run db:seed

# Open Prisma Studio
npm run db:studio

# Generate Prisma client
npm run db:generate

# Reset database
npm run db:reset
```

### Docker Operations
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild services
docker-compose up --build
```

## 📁 Project Structure

```
FlexApp/
├── backend/                    # Backend Express.js application
│   ├── src/
│   │   ├── lib/               # Shared utilities and clients
│   │   ├── routes/            # API route handlers
│   │   ├── middleware/        # Express middleware
│   │   ├── __tests__/         # Test files
│   │   ├── app.ts             # Express app configuration
│   │   └── server.ts          # Application entry point
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.ts            # Database seed script
│   ├── Dockerfile             # Container configuration
│   └── package.json           # Dependencies and scripts
├── docker-compose.yml         # Multi-service container setup
└── README.md                  # This file
```

## 🗄️ Database Schema

### Core Models

- **Listing**: Property information and metadata
- **Review**: Guest reviews with ratings and content
- **ReviewCategory**: Categorized ratings for detailed analytics

### Key Features

- Comprehensive indexing for optimal query performance
- Foreign key relationships ensuring data integrity
- Flexible JSON storage for platform-specific data
- Audit trails with timestamp tracking

## 📊 API Documentation

*API documentation will be available in subsequent development phases*

## 🧪 Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Individual component testing
- **Integration Tests**: API endpoint testing
- **Database Tests**: Data layer validation

Run tests with:
```bash
npm run test
```

## 🚢 Deployment

*Deployment instructions will be provided in subsequent development phases*

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Follow TypeScript strict mode guidelines
- Maintain test coverage above 80%
- Use conventional commit messages
- Format code with Prettier before committing

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Check existing documentation
- Review the troubleshooting guide

## 🗺️ Roadmap

- **Phase 1**: Backend foundation (Current)
- **Phase 2**: Frontend dashboard implementation
- **Phase 3**: Advanced analytics and reporting
- **Phase 4**: Multi-tenant architecture
- **Phase 5**: Production deployment and monitoring
