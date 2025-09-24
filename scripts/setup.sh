#!/bin/bash

# FlexLiving Reviews Dashboard - Development Setup Script
# This script sets up the local development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Default values
ENVIRONMENT="development"
SKIP_DEPS=false
SKIP_DB=false
SEED_DB=true
FORCE_RESET=false

# Print usage information
print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Environment to set up (development|staging|production)"
    echo "  -s, --skip-deps          Skip dependency installation"
    echo "  -d, --skip-db            Skip database setup"
    echo "  --no-seed               Skip database seeding"
    echo "  -f, --force-reset        Force reset of all data"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                      # Set up development environment"
    echo "  $0 -e staging           # Set up staging environment"
    echo "  $0 --skip-deps          # Skip dependency installation"
    echo "  $0 --force-reset        # Reset everything and start fresh"
}

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        -d|--skip-db)
            SKIP_DB=true
            shift
            ;;
        --no-seed)
            SEED_DB=false
            shift
            ;;
        -f|--force-reset)
            FORCE_RESET=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Valid environments: development, staging, production"
    exit 1
fi

print_status "Setting up FlexLiving Reviews Dashboard - $ENVIRONMENT environment"

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 18 ]]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    
    # Check Docker (if not skipping database setup)
    if [[ "$SKIP_DB" != true ]]; then
        if ! command -v docker &> /dev/null; then
            print_error "Docker is not installed. Please install Docker and try again."
            exit 1
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            print_error "Docker Compose is not installed. Please install Docker Compose and try again."
            exit 1
        fi
        
        # Check if Docker is running
        if ! docker info &> /dev/null; then
            print_error "Docker is not running. Please start Docker and try again."
            exit 1
        fi
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        print_warning "Git is not installed. Some features may not work correctly."
    fi
    
    print_success "Prerequisites check completed"
}

# Setup environment files
setup_environment_files() {
    print_status "Setting up environment files..."
    
    # Backend environment file
    if [[ ! -f "$BACKEND_DIR/.env" || "$FORCE_RESET" == true ]]; then
        print_status "Creating backend .env file..."
        
        if [[ -f "$BACKEND_DIR/.env.example" ]]; then
            cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
            print_success "Backend .env file created from example"
        else
            print_warning "Backend .env.example not found, creating basic .env file"
            cat > "$BACKEND_DIR/.env" << EOF
# Database
DATABASE_URL="postgresql://flexliving:flexliving123@localhost:5432/flexliving_reviews"
POSTGRES_USER=flexliving
POSTGRES_PASSWORD=flexliving123
POSTGRES_DB=flexliving_reviews

# Redis
REDIS_URL="redis://localhost:6379"

# Application
NODE_ENV=$ENVIRONMENT
PORT=3001
API_PREFIX=/api
CORS_ORIGIN=http://localhost:3000

# Authentication
JWT_SECRET=your_jwt_secret_key_here_$(openssl rand -hex 32)
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# External APIs (update with your actual keys)
HOSTAWAY_API_KEY=your_hostaway_api_key_here
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here

# Logging
LOG_LEVEL=debug
SENTRY_DSN=

# Monitoring
PROMETHEUS_PORT=9090
EOF
        fi
    else
        print_status "Backend .env file already exists"
    fi
    
    # Frontend environment file
    if [[ ! -f "$FRONTEND_DIR/.env.local" || "$FORCE_RESET" == true ]]; then
        print_status "Creating frontend .env.local file..."
        
        if [[ -f "$FRONTEND_DIR/.env.example" ]]; then
            cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
            print_success "Frontend .env.local file created from example"
        else
            print_warning "Frontend .env.example not found, creating basic .env.local file"
            cat > "$FRONTEND_DIR/.env.local" << EOF
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_$(openssl rand -hex 32)

# Feature Flags
NEXT_PUBLIC_ENABLE_GOOGLE_REVIEWS=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_DARK_MODE=true

# Development
NODE_ENV=$ENVIRONMENT
EOF
        fi
    else
        print_status "Frontend .env.local file already exists"
    fi
    
    print_success "Environment files setup completed"
}

# Install dependencies
install_dependencies() {
    if [[ "$SKIP_DEPS" == true ]]; then
        print_status "Skipping dependency installation"
        return
    fi
    
    print_status "Installing dependencies..."
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    if [[ -f "package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi
    print_success "Backend dependencies installed"
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    if [[ -f "package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi
    print_success "Frontend dependencies installed"
    
    cd "$PROJECT_ROOT"
    print_success "All dependencies installed"
}

# Setup database
setup_database() {
    if [[ "$SKIP_DB" == true ]]; then
        print_status "Skipping database setup"
        return
    fi
    
    print_status "Setting up database..."
    
    # Start database services
    print_status "Starting database services..."
    cd "$PROJECT_ROOT"
    
    if [[ -f "docker-compose.yml" ]]; then
        if [[ "$FORCE_RESET" == true ]]; then
            print_status "Force reset requested, stopping and removing existing containers..."
            docker-compose down -v
        fi
        
        docker-compose up -d postgres redis
        print_success "Database services started"
    else
        print_warning "docker-compose.yml not found, creating basic setup..."
        cat > docker-compose.yml << EOF
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: flexliving
      POSTGRES_PASSWORD: flexliving123
      POSTGRES_DB: flexliving_reviews
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U flexliving"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
EOF
        docker-compose up -d postgres redis
        print_success "Database services created and started"
    fi
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 5
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose exec -T postgres pg_isready -U flexliving -d flexliving_reviews &> /dev/null; then
            print_success "Database is ready"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_error "Database failed to start after $max_attempts attempts"
            exit 1
        fi
        
        print_status "Attempt $attempt/$max_attempts - waiting for database..."
        sleep 2
        ((attempt++))
    done
    
    # Run database migrations
    print_status "Running database migrations..."
    cd "$BACKEND_DIR"
    npx prisma generate
    npx prisma migrate dev --name init
    
    if [[ "$SEED_DB" == true ]]; then
        print_status "Seeding database..."
        npx prisma db seed
        print_success "Database seeded"
    fi
    
    print_success "Database setup completed"
}

# Validate setup
validate_setup() {
    print_status "Validating setup..."
    
    # Check backend
    cd "$BACKEND_DIR"
    if [[ -f "package.json" ]] && [[ -d "node_modules" ]]; then
        print_success "Backend dependencies are installed"
    else
        print_error "Backend setup incomplete"
        return 1
    fi
    
    # Check frontend
    cd "$FRONTEND_DIR"
    if [[ -f "package.json" ]] && [[ -d "node_modules" ]]; then
        print_success "Frontend dependencies are installed"
    else
        print_error "Frontend setup incomplete"
        return 1
    fi
    
    # Check database connection (if not skipped)
    if [[ "$SKIP_DB" != true ]]; then
        cd "$PROJECT_ROOT"
        if docker-compose ps | grep -q "postgres.*Up" && docker-compose ps | grep -q "redis.*Up"; then
            print_success "Database services are running"
        else
            print_error "Database services are not running properly"
            return 1
        fi
    fi
    
    print_success "Setup validation completed"
}

# Generate development scripts
generate_dev_scripts() {
    print_status "Generating development scripts..."
    
    # Create start script
    cat > "$PROJECT_ROOT/start-dev.sh" << 'EOF'
#!/bin/bash
# Start development servers

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting FlexLiving Reviews Dashboard development servers...${NC}"

# Start database services
echo -e "${BLUE}Starting database services...${NC}"
docker-compose up -d postgres redis

# Start backend in background
echo -e "${BLUE}Starting backend server...${NC}"
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend
echo -e "${BLUE}Starting frontend server...${NC}"
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo -e "${GREEN}Development servers started!${NC}"
echo -e "Frontend: http://localhost:3000"
echo -e "Backend: http://localhost:3001"
echo -e "Backend Health: http://localhost:3001/api/health"
echo ""
echo -e "Press Ctrl+C to stop all servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; docker-compose stop; exit" INT
wait
EOF
    
    chmod +x "$PROJECT_ROOT/start-dev.sh"
    
    # Create stop script
    cat > "$PROJECT_ROOT/stop-dev.sh" << 'EOF'
#!/bin/bash
# Stop development servers

echo "Stopping development servers..."

# Kill Node.js processes
pkill -f "npm run dev" || true
pkill -f "next dev" || true
pkill -f "nodemon" || true

# Stop Docker services
docker-compose stop

echo "Development servers stopped"
EOF
    
    chmod +x "$PROJECT_ROOT/stop-dev.sh"
    
    # Create test script
    cat > "$PROJECT_ROOT/run-tests.sh" << 'EOF'
#!/bin/bash
# Run all tests

set -e

echo "Running FlexLiving Reviews Dashboard tests..."

# Backend tests
echo "Running backend tests..."
cd backend
npm run test

# Frontend tests  
echo "Running frontend tests..."
cd ../frontend
npm run test -- --watchAll=false

echo "All tests completed successfully!"
EOF
    
    chmod +x "$PROJECT_ROOT/run-tests.sh"
    
    print_success "Development scripts generated"
}

# Main execution
main() {
    print_status "Starting setup process..."
    
    check_prerequisites
    setup_environment_files
    install_dependencies
    setup_database
    validate_setup
    generate_dev_scripts
    
    print_success "Setup completed successfully!"
    print_status ""
    print_status "Next steps:"
    print_status "1. Review and update environment files with your API keys:"
    print_status "   - $BACKEND_DIR/.env"
    print_status "   - $FRONTEND_DIR/.env.local"
    print_status ""
    print_status "2. Start development servers:"
    print_status "   ./start-dev.sh"
    print_status ""
    print_status "3. Access the application:"
    print_status "   - Frontend: http://localhost:3000"
    print_status "   - Backend API: http://localhost:3001"
    print_status "   - API Health: http://localhost:3001/api/health"
    print_status ""
    print_status "4. Run tests:"
    print_status "   ./run-tests.sh"
    print_status ""
    print_status "5. Stop servers when done:"
    print_status "   ./stop-dev.sh"
    print_status ""
    print_success "Happy coding! 🚀"
}

# Execute main function
main "$@"
