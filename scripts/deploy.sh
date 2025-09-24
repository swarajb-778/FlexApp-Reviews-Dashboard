#!/bin/bash

# FlexLiving Reviews Dashboard - Deployment Script
# This script handles deployment to different environments

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

# Default values
ENVIRONMENT=""
BUILD_IMAGES=true
RUN_TESTS=true
RUN_MIGRATIONS=true
SKIP_HEALTH_CHECK=false
DRY_RUN=false
FORCE_DEPLOY=false
IMAGE_TAG="latest"
ROLLBACK=false
ROLLBACK_REVISION=""

# Configuration
DOCKER_REGISTRY="ghcr.io"
IMAGE_PREFIX="flexliving"
BACKEND_IMAGE="$DOCKER_REGISTRY/\${{ github.repository }}-backend"
FRONTEND_IMAGE="$DOCKER_REGISTRY/\${{ github.repository }}-frontend"

# Print usage information
print_usage() {
    echo "Usage: $0 [OPTIONS] ENVIRONMENT"
    echo ""
    echo "Arguments:"
    echo "  ENVIRONMENT             Target environment (staging|production)"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG           Image tag to deploy (default: latest)"
    echo "  --skip-build           Skip image building"
    echo "  --skip-tests           Skip test execution"
    echo "  --skip-migrations      Skip database migrations"
    echo "  --skip-health-check    Skip post-deployment health checks"
    echo "  --dry-run              Show what would be deployed without executing"
    echo "  -f, --force            Force deployment without confirmations"
    echo "  --rollback [REVISION]  Rollback to previous version or specific revision"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 staging                    # Deploy to staging"
    echo "  $0 production -t v1.2.3       # Deploy specific version to production"
    echo "  $0 staging --dry-run          # Show what would be deployed"
    echo "  $0 production --rollback      # Rollback production to previous version"
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
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --skip-build)
            BUILD_IMAGES=false
            shift
            ;;
        --skip-tests)
            RUN_TESTS=false
            shift
            ;;
        --skip-migrations)
            RUN_MIGRATIONS=false
            shift
            ;;
        --skip-health-check)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            if [[ $# -gt 1 && ! "$2" =~ ^- ]]; then
                ROLLBACK_REVISION="$2"
                shift 2
            else
                shift
            fi
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        staging|production)
            if [[ -n "$ENVIRONMENT" ]]; then
                print_error "Multiple environments specified"
                print_usage
                exit 1
            fi
            ENVIRONMENT="$1"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
    print_error "Environment is required"
    print_usage
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Valid environments: staging, production"
    exit 1
fi

# Set environment-specific configurations
case $ENVIRONMENT in
    staging)
        NAMESPACE="flexliving-reviews-staging"
        DOMAIN="staging.reviews.flexliving.com"
        API_DOMAIN="staging-api.reviews.flexliving.com"
        ;;
    production)
        NAMESPACE="flexliving-reviews"
        DOMAIN="reviews.flexliving.com"
        API_DOMAIN="api.reviews.flexliving.com"
        ;;
esac

print_status "Deploying FlexLiving Reviews Dashboard to $ENVIRONMENT environment"

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Docker
    if [[ "$BUILD_IMAGES" == true ]] && ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    # Check if kubectl can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        print_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    # Check helm (if using Helm charts)
    if command -v helm &> /dev/null; then
        print_status "Helm is available"
    fi
    
    print_success "Prerequisites check completed"
}

# Get current deployment status
get_current_deployment() {
    print_status "Getting current deployment status..."
    
    # Get current backend image
    CURRENT_BACKEND_IMAGE=$(kubectl get deployment flexliving-reviews-backend -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "none")
    
    # Get current frontend image  
    CURRENT_FRONTEND_IMAGE=$(kubectl get deployment flexliving-reviews-frontend -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "none")
    
    print_status "Current backend image: $CURRENT_BACKEND_IMAGE"
    print_status "Current frontend image: $CURRENT_FRONTEND_IMAGE"
    
    # Get deployment history
    print_status "Recent deployment history:"
    kubectl rollout history deployment/flexliving-reviews-backend -n "$NAMESPACE" --limit=5 || true
}

# Run tests
run_tests() {
    if [[ "$RUN_TESTS" != true ]]; then
        print_status "Skipping tests"
        return
    fi
    
    print_status "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Backend tests
    print_status "Running backend tests..."
    cd backend
    npm run test:ci || {
        print_error "Backend tests failed"
        exit 1
    }
    
    # Frontend tests
    print_status "Running frontend tests..."
    cd ../frontend
    npm run test -- --watchAll=false || {
        print_error "Frontend tests failed"
        exit 1
    }
    
    print_success "All tests passed"
}

# Build Docker images
build_images() {
    if [[ "$BUILD_IMAGES" != true ]]; then
        print_status "Skipping image building"
        return
    fi
    
    print_status "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build backend image
    print_status "Building backend image..."
    docker build \
        -t "$BACKEND_IMAGE:$IMAGE_TAG" \
        -t "$BACKEND_IMAGE:latest" \
        -f backend/Dockerfile \
        backend/
    
    # Build frontend image
    print_status "Building frontend image..."
    docker build \
        -t "$FRONTEND_IMAGE:$IMAGE_TAG" \
        -t "$FRONTEND_IMAGE:latest" \
        -f frontend/Dockerfile \
        frontend/
    
    # Push images to registry
    print_status "Pushing images to registry..."
    docker push "$BACKEND_IMAGE:$IMAGE_TAG"
    docker push "$BACKEND_IMAGE:latest"
    docker push "$FRONTEND_IMAGE:$IMAGE_TAG"
    docker push "$FRONTEND_IMAGE:latest"
    
    print_success "Docker images built and pushed"
}

# Run database migrations
run_migrations() {
    if [[ "$RUN_MIGRATIONS" != true ]]; then
        print_status "Skipping database migrations"
        return
    fi
    
    print_status "Running database migrations..."
    
    # Create migration job
    cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration-$(date +%s)
  namespace: $NAMESPACE
  labels:
    app: flexliving-reviews
    component: migration
spec:
  template:
    metadata:
      labels:
        app: flexliving-reviews
        component: migration
    spec:
      restartPolicy: OnFailure
      containers:
      - name: migration
        image: $BACKEND_IMAGE:$IMAGE_TAG
        command: ['sh', '-c']
        args:
        - |
          echo "Running database migrations..."
          npx prisma generate
          npx prisma migrate deploy
          echo "Migrations completed successfully"
        envFrom:
        - secretRef:
            name: flexliving-reviews-secrets
        - configMapRef:
            name: flexliving-reviews-config
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
EOF
    
    # Wait for migration to complete
    local job_name=$(kubectl get jobs -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp | grep db-migration | tail -1 | awk '{print $1}')
    
    print_status "Waiting for migration job to complete: $job_name"
    kubectl wait --for=condition=complete --timeout=300s job/"$job_name" -n "$NAMESPACE"
    
    # Check migration logs
    print_status "Migration logs:"
    kubectl logs job/"$job_name" -n "$NAMESPACE"
    
    # Clean up migration job
    kubectl delete job "$job_name" -n "$NAMESPACE"
    
    print_success "Database migrations completed"
}

# Deploy application
deploy_application() {
    print_status "Deploying application..."
    
    if [[ "$DRY_RUN" == true ]]; then
        print_status "DRY RUN - Would deploy the following:"
        print_status "Backend image: $BACKEND_IMAGE:$IMAGE_TAG"
        print_status "Frontend image: $FRONTEND_IMAGE:$IMAGE_TAG"
        print_status "Namespace: $NAMESPACE"
        return
    fi
    
    # Update image tags in deployment files
    cd "$PROJECT_ROOT/k8s"
    
    # Create temporary deployment files with updated image tags and repository
    sed -e "s|BACKEND_IMAGE_TAG|$IMAGE_TAG|g" -e "s|\${{ github.repository }}|${GITHUB_REPOSITORY:-swarajbangar/FlexApp}|g" backend-deployment.yaml > backend-deployment-temp.yaml
    sed -e "s|FRONTEND_IMAGE_TAG|$IMAGE_TAG|g" -e "s|\${{ github.repository }}|${GITHUB_REPOSITORY:-swarajbangar/FlexApp}|g" frontend-deployment.yaml > frontend-deployment-temp.yaml
    
    # Apply deployments
    print_status "Applying backend deployment..."
    kubectl apply -f backend-deployment-temp.yaml -n "$NAMESPACE"
    
    print_status "Applying frontend deployment..."
    kubectl apply -f frontend-deployment-temp.yaml -n "$NAMESPACE"
    
    # Clean up temporary files
    rm -f backend-deployment-temp.yaml frontend-deployment-temp.yaml
    
    # Wait for deployments to complete
    print_status "Waiting for backend deployment to complete..."
    kubectl rollout status deployment/flexliving-reviews-backend -n "$NAMESPACE" --timeout=600s
    
    print_status "Waiting for frontend deployment to complete..."
    kubectl rollout status deployment/flexliving-reviews-frontend -n "$NAMESPACE" --timeout=600s
    
    print_success "Application deployed successfully"
}

# Rollback deployment
rollback_deployment() {
    print_status "Rolling back deployment..."
    
    if [[ "$DRY_RUN" == true ]]; then
        print_status "DRY RUN - Would rollback to:"
        if [[ -n "$ROLLBACK_REVISION" ]]; then
            print_status "Specific revision: $ROLLBACK_REVISION"
        else
            print_status "Previous revision"
        fi
        return
    fi
    
    # Rollback backend
    if [[ -n "$ROLLBACK_REVISION" ]]; then
        kubectl rollout undo deployment/flexliving-reviews-backend --to-revision="$ROLLBACK_REVISION" -n "$NAMESPACE"
        kubectl rollout undo deployment/flexliving-reviews-frontend --to-revision="$ROLLBACK_REVISION" -n "$NAMESPACE"
    else
        kubectl rollout undo deployment/flexliving-reviews-backend -n "$NAMESPACE"
        kubectl rollout undo deployment/flexliving-reviews-frontend -n "$NAMESPACE"
    fi
    
    # Wait for rollback to complete
    print_status "Waiting for rollback to complete..."
    kubectl rollout status deployment/flexliving-reviews-backend -n "$NAMESPACE" --timeout=600s
    kubectl rollout status deployment/flexliving-reviews-frontend -n "$NAMESPACE" --timeout=600s
    
    print_success "Rollback completed"
}

# Run health checks
run_health_checks() {
    if [[ "$SKIP_HEALTH_CHECK" == true ]]; then
        print_status "Skipping health checks"
        return
    fi
    
    print_status "Running health checks..."
    
    # Wait for services to be ready
    sleep 30
    
    # Check backend health
    print_status "Checking backend health..."
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f "https://$API_DOMAIN/api/health" &> /dev/null; then
            print_success "Backend health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_error "Backend health check failed after $max_attempts attempts"
            exit 1
        fi
        
        print_status "Health check attempt $attempt/$max_attempts..."
        sleep 10
        ((attempt++))
    done
    
    # Check frontend
    print_status "Checking frontend..."
    if curl -f "https://$DOMAIN" &> /dev/null; then
        print_success "Frontend health check passed"
    else
        print_error "Frontend health check failed"
        exit 1
    fi
    
    # Run smoke tests
    print_status "Running smoke tests..."
    
    # Test critical API endpoints
    local endpoints=(
        "/api/health"
        "/api/reviews?limit=1"
        "/api/listings?limit=1"
    )
    
    for endpoint in "${endpoints[@]}"; do
        print_status "Testing endpoint: $endpoint"
        local response=$(curl -s -w "%{http_code}" "https://$API_DOMAIN$endpoint")
        local http_code="${response: -3}"
        
        if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
            print_success "Endpoint $endpoint: OK ($http_code)"
        else
            print_error "Endpoint $endpoint: FAILED ($http_code)"
            exit 1
        fi
    done
    
    print_success "All health checks passed"
}

# Send notifications
send_notifications() {
    print_status "Sending deployment notifications..."
    
    local message="FlexLiving Reviews Dashboard deployed to $ENVIRONMENT"
    local details="Image: $IMAGE_TAG\nTime: $(date)\nDomain: https://$DOMAIN"
    
    # Slack notification (if webhook URL is configured)
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 $message\n$details\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    # Email notification (if configured)
    if [[ -n "${NOTIFICATION_EMAIL:-}" ]]; then
        echo -e "$message\n\n$details" | \
            mail -s "Deployment Notification - $ENVIRONMENT" "$NOTIFICATION_EMAIL" || true
    fi
    
    print_success "Notifications sent"
}

# Main deployment function
main() {
    print_status "Starting deployment process..."
    
    # Get user confirmation for production deployments
    if [[ "$ENVIRONMENT" == "production" && "$FORCE_DEPLOY" != true && "$DRY_RUN" != true && "$ROLLBACK" != true ]]; then
        echo ""
        print_warning "You are about to deploy to PRODUCTION environment!"
        print_status "Image tag: $IMAGE_TAG"
        print_status "Domain: https://$DOMAIN"
        echo ""
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            print_status "Deployment cancelled"
            exit 0
        fi
    fi
    
    check_prerequisites
    get_current_deployment
    
    if [[ "$ROLLBACK" == true ]]; then
        rollback_deployment
    else
        run_tests
        build_images
        run_migrations
        deploy_application
    fi
    
    run_health_checks
    send_notifications
    
    print_success "Deployment completed successfully!"
    print_status ""
    print_status "Deployment summary:"
    print_status "Environment: $ENVIRONMENT"
    print_status "Image tag: $IMAGE_TAG"
    print_status "Frontend: https://$DOMAIN"
    print_status "Backend API: https://$API_DOMAIN"
    print_status ""
    print_status "Monitor deployment:"
    print_status "kubectl get pods -n $NAMESPACE"
    print_status "kubectl logs -f deployment/flexliving-reviews-backend -n $NAMESPACE"
}

# Execute main function
main "$@"
