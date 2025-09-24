# FlexLiving Reviews Dashboard - Deployment Guide

## Overview

This guide covers deployment strategies for the FlexLiving Reviews Dashboard across different environments, from local development to production-ready cloud deployments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployments](#cloud-deployments)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Database Setup](#database-setup)
- [Monitoring & Logging](#monitoring--logging)
- [Security Configuration](#security-configuration)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum Requirements:**
- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- Redis 6.x or higher
- 2GB RAM
- 10GB disk space

**Recommended for Production:**
- Node.js 20.x LTS
- PostgreSQL 15.x
- Redis 7.x
- 8GB RAM
- 50GB SSD
- Load balancer
- CDN for static assets

### Development Tools

```bash
# Install required tools
npm install -g pnpm@latest
npm install -g prisma@latest
npm install -g pm2@latest

# For Docker deployments
docker --version
docker-compose --version

# For Kubernetes deployments
kubectl version --client
helm version
```

## Environment Configuration

### Environment Variables

Create environment files for each deployment stage:

#### Backend Environment (`.env`)

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@host:5432/flexliving_reviews"
POSTGRES_USER=flexliving
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=flexliving_reviews

# Redis Configuration
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=redis_password_here

# Server Configuration
NODE_ENV=production
PORT=3001
API_PREFIX=/api
CORS_ORIGIN=https://reviews.flexliving.com

# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# External APIs
HOSTAWAY_API_KEY=your_hostaway_api_key
HOSTAWAY_API_SECRET=your_hostaway_secret

# Google APIs
GOOGLE_PLACES_API_KEY=your_google_places_api_key
GOOGLE_BUSINESS_PROFILE_CREDENTIALS={"type":"service_account",...}

# Monitoring & Logging
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
PROMETHEUS_PORT=9090

# File Storage (if using cloud storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=flexliving-reviews-assets

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@flexliving.com
SMTP_PASS=your_smtp_password
```

#### Frontend Environment (`.env.local`)

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api.reviews.flexliving.com
NEXT_PUBLIC_APP_URL=https://reviews.flexliving.com

# Authentication
NEXTAUTH_URL=https://reviews.flexliving.com
NEXTAUTH_SECRET=your_nextauth_secret

# Analytics (optional)
NEXT_PUBLIC_GA_ID=GA-XXXXXXXXX
NEXT_PUBLIC_HOTJAR_ID=your_hotjar_id

# Feature Flags
NEXT_PUBLIC_ENABLE_GOOGLE_REVIEWS=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true

# Build Configuration
NODE_ENV=production
```

### Environment Validation

Create a validation script to ensure all required variables are set:

```javascript
// scripts/validate-env.js
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'HOSTAWAY_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  process.exit(1);
}

console.log('✅ Environment validation passed');
```

## Local Development

### Quick Start

```bash
# Clone the repository
git clone https://github.com/flexliving/reviews-dashboard.git
cd reviews-dashboard

# Install dependencies
pnpm install

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Start database services
docker-compose up -d postgres redis

# Set up database
cd backend
npx prisma migrate dev
npx prisma db seed

# Start development servers
pnpm dev
```

### Development Services

#### Database Setup

```bash
# Start PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# Run migrations
cd backend
npx prisma migrate dev --name init

# Seed database with test data
npx prisma db seed
```

#### Development Server

```bash
# Start both frontend and backend
pnpm dev

# Or start individually
pnpm dev:backend  # Backend on :3001
pnpm dev:frontend # Frontend on :3000
```

### Development Docker Setup

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: flexliving
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: flexliving_reviews_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_dev_data:/data

volumes:
  postgres_dev_data:
  redis_dev_data:
```

## Docker Deployment

### Docker Images

#### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Copy built application
COPY --from=builder --chown=backend:nodejs /app/dist ./dist
COPY --from=builder --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=backend:nodejs /app/prisma ./prisma
COPY --from=builder --chown=backend:nodejs /app/package.json ./package.json

USER backend

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').request('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).end()"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
```

#### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S frontend -u 1001

# Copy built application
COPY --from=builder --chown=frontend:nodejs /app/.next/standalone ./
COPY --from=builder --chown=frontend:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=frontend:nodejs /app/public ./public

USER frontend

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').request('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).end()"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - HOSTAWAY_API_KEY=${HOSTAWAY_API_KEY}
    depends_on:
      - postgres
      - redis
    ports:
      - "3001:3001"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:3001
    depends_on:
      - backend
    ports:
      - "3000:3000"
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3001;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name reviews.flexliving.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name reviews.flexliving.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Backend API routes
        location /api/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Rate limiting
            limit_req zone=api burst=20 nodelay;
        }
    }

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
```

## Cloud Deployments

### AWS Deployment

#### ECS with Fargate

```yaml
# ecs-task-definition.json
{
  "family": "flexliving-reviews",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/flexliving-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://user:pass@rds-endpoint:5432/db"
        }
      ],
      "secrets": [
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:flexliving-jwt"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/flexliving-reviews",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "backend"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:3001/api/health || exit 1"
        ],
        "interval": 30,
        "timeout": 10,
        "retries": 3
      }
    }
  ]
}
```

#### CloudFormation Template

```yaml
# cloudformation-template.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'FlexLiving Reviews Dashboard Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]

Resources:
  # VPC and Networking
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub 'flexliving-reviews-${Environment}-vpc'

  # RDS Instance
  DBInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub 'flexliving-reviews-${Environment}'
      DBInstanceClass: db.t3.micro
      Engine: postgres
      EngineVersion: '15.3'
      MasterUsername: flexliving
      MasterUserPassword: !Ref DBPassword
      AllocatedStorage: 20
      StorageType: gp3
      StorageEncrypted: true
      BackupRetentionPeriod: 7
      MultiAZ: !If [IsProduction, true, false]

  # ElastiCache Redis
  RedisCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      ReplicationGroupId: !Sub 'flexliving-reviews-${Environment}'
      Description: 'Redis cluster for FlexLiving Reviews'
      CacheNodeType: cache.t3.micro
      Engine: redis
      NumCacheClusters: !If [IsProduction, 2, 1]
      Port: 6379
      AtRestEncryptionEnabled: true
      TransitEncryptionEnabled: true

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub 'flexliving-reviews-${Environment}'
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT

Conditions:
  IsProduction: !Equals [!Ref Environment, production]
```

### Google Cloud Platform (GCP)

#### Cloud Run Deployment

```yaml
# gcp-cloud-run.yml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: flexliving-reviews-backend
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "1Gi"
        run.googleapis.com/cpu: "1"
    spec:
      containers:
      - image: gcr.io/project-id/flexliving-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          limits:
            cpu: "1"
            memory: "1Gi"
        startupProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 10
          timeoutSeconds: 5
```

### Azure Deployment

#### Container Apps

```yaml
# azure-container-app.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: flexliving-reviews-config
data:
  NODE_ENV: "production"
  PORT: "3001"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flexliving-reviews-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: flexliving-reviews-backend
  template:
    metadata:
      labels:
        app: flexliving-reviews-backend
    spec:
      containers:
      - name: backend
        image: flexlivingreviews.azurecr.io/backend:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: flexliving-reviews-config
        - secretRef:
            name: flexliving-reviews-secrets
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 500m
            memory: 1Gi
```

## Kubernetes Deployment

### Namespace and RBAC

```yaml
# k8s/namespace.yml
apiVersion: v1
kind: Namespace
metadata:
  name: flexliving-reviews
  labels:
    name: flexliving-reviews
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: flexliving-reviews-sa
  namespace: flexliving-reviews
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: flexliving-reviews
  name: flexliving-reviews-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: flexliving-reviews-binding
  namespace: flexliving-reviews
subjects:
- kind: ServiceAccount
  name: flexliving-reviews-sa
  namespace: flexliving-reviews
roleRef:
  kind: Role
  name: flexliving-reviews-role
  apiGroup: rbac.authorization.k8s.io
```

### ConfigMap and Secrets

```yaml
# k8s/configmap.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: flexliving-reviews-config
  namespace: flexliving-reviews
data:
  NODE_ENV: "production"
  PORT: "3001"
  API_PREFIX: "/api"
  LOG_LEVEL: "info"
  PROMETHEUS_PORT: "9090"
---
apiVersion: v1
kind: Secret
metadata:
  name: flexliving-reviews-secrets
  namespace: flexliving-reviews
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:password@postgres:5432/flexliving_reviews"
  REDIS_URL: "redis://redis:6379"
  JWT_SECRET: "your-jwt-secret"
  HOSTAWAY_API_KEY: "your-hostaway-api-key"
  GOOGLE_PLACES_API_KEY: "your-google-places-api-key"
```

### Backend Deployment

```yaml
# k8s/backend-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flexliving-reviews-backend
  namespace: flexliving-reviews
  labels:
    app: flexliving-reviews-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: flexliving-reviews-backend
  template:
    metadata:
      labels:
        app: flexliving-reviews-backend
    spec:
      serviceAccountName: flexliving-reviews-sa
      containers:
      - name: backend
        image: flexliving/reviews-backend:latest
        ports:
        - containerPort: 3001
          name: http
        - containerPort: 9090
          name: metrics
        envFrom:
        - configMapRef:
            name: flexliving-reviews-config
        - secretRef:
            name: flexliving-reviews-secrets
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 1
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        emptyDir: {}
      nodeSelector:
        kubernetes.io/arch: amd64
      tolerations:
      - key: "node.kubernetes.io/unschedulable"
        operator: "Equal"
        value: "true"
        effect: "NoSchedule"
---
apiVersion: v1
kind: Service
metadata:
  name: flexliving-reviews-backend-service
  namespace: flexliving-reviews
  labels:
    app: flexliving-reviews-backend
spec:
  selector:
    app: flexliving-reviews-backend
  ports:
  - name: http
    port: 80
    targetPort: 3001
  - name: metrics
    port: 9090
    targetPort: 9090
  type: ClusterIP
```

### Frontend Deployment

```yaml
# k8s/frontend-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flexliving-reviews-frontend
  namespace: flexliving-reviews
spec:
  replicas: 2
  selector:
    matchLabels:
      app: flexliving-reviews-frontend
  template:
    metadata:
      labels:
        app: flexliving-reviews-frontend
    spec:
      containers:
      - name: frontend
        image: flexliving/reviews-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          value: "https://api.reviews.flexliving.com"
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: flexliving-reviews-frontend-service
  namespace: flexliving-reviews
spec:
  selector:
    app: flexliving-reviews-frontend
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

### Database Deployment

```yaml
# k8s/postgres-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: flexliving-reviews
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          value: "flexliving"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: POSTGRES_DB
          value: "flexliving_reviews"
        - name: PGDATA
          value: "/var/lib/postgresql/data/pgdata"
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 500m
            memory: 1Gi
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: flexliving-reviews
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: flexliving-reviews
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

### Ingress Configuration

```yaml
# k8s/ingress.yml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: flexliving-reviews-ingress
  namespace: flexliving-reviews
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - reviews.flexliving.com
    - api.reviews.flexliving.com
    secretName: flexliving-reviews-tls
  rules:
  - host: reviews.flexliving.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: flexliving-reviews-frontend-service
            port:
              number: 80
  - host: api.reviews.flexliving.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: flexliving-reviews-backend-service
            port:
              number: 80
```

## Database Setup

### Migration Scripts

```bash
#!/bin/bash
# scripts/migrate.sh

set -e

echo "Running database migrations..."

# Run Prisma migrations
npx prisma migrate deploy

# Check if seeding is needed
if [ "$SEED_DATABASE" = "true" ]; then
    echo "Seeding database..."
    npx prisma db seed
fi

echo "Database setup complete!"
```

### Backup Strategy

```bash
#!/bin/bash
# scripts/backup-db.sh

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="flexliving_reviews_backup_${TIMESTAMP}.sql"

echo "Creating database backup: $BACKUP_FILE"

pg_dump $DATABASE_URL > /backups/$BACKUP_FILE

# Upload to S3 (optional)
if [ -n "$AWS_S3_BACKUP_BUCKET" ]; then
    aws s3 cp /backups/$BACKUP_FILE s3://$AWS_S3_BACKUP_BUCKET/database-backups/
fi

# Keep only last 7 days of backups locally
find /backups -name "flexliving_reviews_backup_*.sql" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

### Database Monitoring

```sql
-- monitoring-queries.sql

-- Check database size
SELECT 
    pg_size_pretty(pg_database_size('flexliving_reviews')) as database_size;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check active connections
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- Check slow queries
SELECT 
    query,
    mean_exec_time,
    calls
FROM pg_stat_statements 
WHERE mean_exec_time > 1000  -- queries taking longer than 1 second
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

## Monitoring & Logging

### Prometheus Configuration

Use the provided Prometheus configuration file which includes comprehensive scrape configurations for Kubernetes deployments:

**File: `monitoring/prometheus.yml`**

This configuration includes:
- **FlexLiving Reviews Backend**: Automatic discovery of backend pods with metrics scraping on `/metrics`
- **Redis Monitoring**: Redis exporter integration for cache metrics
- **PostgreSQL Monitoring**: Database performance and connection metrics
- **Kubernetes Integration**: Node exporter, kubelet, and cAdvisor metrics
- **Service Discovery**: Kubernetes-based automatic target discovery

Key features:
- Kubernetes service discovery for dynamic scaling
- Custom metric names with `flexliving_reviews_` prefix
- Configurable retention (7 days by default)
- Support for both production and staging namespaces

```bash
# Deploy Prometheus with the configuration
kubectl create configmap prometheus-config --from-file=monitoring/prometheus.yml -n monitoring
kubectl apply -f k8s/monitoring/prometheus-deployment.yaml
```

### Grafana Dashboard

A comprehensive monitoring dashboard is provided at `monitoring/grafana-dashboard.json` with the following panels:

**Performance Metrics:**
- HTTP Request Rate and Response Times (95th percentile)
- CPU and Memory Usage
- Database Connection Pool Status
- Cache Hit Rate and Redis Performance

**Business Metrics:**
- Review Counts by Status (Approved/Pending)
- Review Processing Rate
- Error Rates by Type
- Database Query Performance

**System Metrics:**
- Container Resource Usage
- Kubernetes Pod Health
- Network I/O and Storage

**Import the Dashboard:**

1. **Via Grafana UI:**
   - Go to Dashboards → Import
   - Upload `monitoring/grafana-dashboard.json`
   - Configure data source (Prometheus)

2. **Via ConfigMap:**
   ```bash
   kubectl create configmap grafana-dashboard --from-file=monitoring/grafana-dashboard.json -n monitoring
   ```

3. **Dashboard Features:**
   - Real-time metrics with 30-second refresh
   - Customizable time ranges and filters
   - Namespace-based filtering for multi-environment support
   - Alerting thresholds for critical metrics

### Log Aggregation

```yaml
# logging/fluentd-config.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*flexliving-reviews*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      format json
    </source>
    
    <filter kubernetes.**>
      @type kubernetes_metadata
    </filter>
    
    <match **>
      @type elasticsearch
      host elasticsearch.logging.svc.cluster.local
      port 9200
      index_name flexliving-reviews
      type_name logs
    </match>
```

## Security Configuration

### SSL/TLS Setup

```bash
#!/bin/bash
# scripts/setup-ssl.sh

# Generate SSL certificate using Let's Encrypt
certbot certonly \
  --dns-route53 \
  --dns-route53-propagation-seconds 60 \
  -d reviews.flexliving.com \
  -d api.reviews.flexliving.com \
  --email admin@flexliving.com \
  --agree-tos \
  --non-interactive

# Set up automatic renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" >> /etc/crontab
```

### Security Headers

```javascript
// middleware/security.js
const helmet = require('helmet');

const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-eval'"],
      connectSrc: ["'self'", "https://api.reviews.flexliving.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

module.exports = securityMiddleware;
```

### Secrets Management

```bash
# Using Kubernetes secrets
kubectl create secret generic flexliving-reviews-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=hostaway-api-key="..." \
  --namespace=flexliving-reviews

# Using HashiCorp Vault
vault kv put secret/flexliving-reviews \
  database_url="postgresql://..." \
  jwt_secret="..." \
  hostaway_api_key="..."
```

## Backup & Recovery

### Automated Backup

```yaml
# k8s/cronjob-backup.yml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
  namespace: flexliving-reviews
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15-alpine
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: flexliving-reviews-secrets
                  key: DATABASE_URL
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: access-key-id
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: secret-access-key
            command:
            - /bin/bash
            - -c
            - |
              TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
              BACKUP_FILE="backup_${TIMESTAMP}.sql"
              pg_dump $DATABASE_URL > /tmp/$BACKUP_FILE
              aws s3 cp /tmp/$BACKUP_FILE s3://flexliving-backups/database/
              rm /tmp/$BACKUP_FILE
          restartPolicy: OnFailure
```

### Disaster Recovery

```bash
#!/bin/bash
# scripts/disaster-recovery.sh

set -e

BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

echo "Starting disaster recovery with backup: $BACKUP_FILE"

# Download backup from S3
aws s3 cp s3://flexliving-backups/database/$BACKUP_FILE /tmp/

# Stop application
kubectl scale deployment flexliving-reviews-backend --replicas=0 -n flexliving-reviews

# Restore database
echo "Restoring database..."
psql $DATABASE_URL < /tmp/$BACKUP_FILE

# Restart application
kubectl scale deployment flexliving-reviews-backend --replicas=3 -n flexliving-reviews

echo "Disaster recovery completed!"
```

## Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check database connectivity
pg_isready -h localhost -p 5432

# Check database logs
kubectl logs -f deployment/postgres -n flexliving-reviews

# Test connection from application pod
kubectl exec -it deployment/flexliving-reviews-backend -n flexliving-reviews -- \
  psql $DATABASE_URL -c "SELECT version();"
```

#### Performance Issues

```bash
# Check resource usage
kubectl top pods -n flexliving-reviews

# Check application logs for slow queries
kubectl logs -f deployment/flexliving-reviews-backend -n flexliving-reviews | grep "slow query"

# Check Prometheus metrics
curl http://backend:9090/metrics | grep http_request_duration
```

#### SSL Certificate Issues

```bash
# Check certificate expiry
openssl x509 -in /etc/ssl/certs/reviews.flexliving.com.pem -text -noout | grep "Not After"

# Test SSL configuration
curl -I https://reviews.flexliving.com

# Renew Let's Encrypt certificate
certbot renew --dry-run
```

### Health Check Scripts

```bash
#!/bin/bash
# scripts/health-check.sh

set -e

echo "Running health checks..."

# Check backend health
BACKEND_HEALTH=$(curl -s http://localhost:3001/api/health | jq -r '.status')
if [ "$BACKEND_HEALTH" != "healthy" ]; then
    echo "❌ Backend health check failed"
    exit 1
fi
echo "✅ Backend healthy"

# Check frontend health
FRONTEND_HEALTH=$(curl -s http://localhost:3000/api/health | jq -r '.status')
if [ "$FRONTEND_HEALTH" != "healthy" ]; then
    echo "❌ Frontend health check failed"
    exit 1
fi
echo "✅ Frontend healthy"

# Check database connectivity
pg_isready -h localhost -p 5432
echo "✅ Database healthy"

# Check Redis connectivity
redis-cli ping
echo "✅ Redis healthy"

echo "✅ All health checks passed"
```

## Performance Optimization

### Application Performance

```javascript
// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`
      });
    }
  });
  
  next();
};
```

### Database Performance

```sql
-- Database performance tuning
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_reviews_status_created_at 
ON reviews(status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_reviews_listing_id_status 
ON reviews(listing_id, status);

CREATE INDEX CONCURRENTLY idx_reviews_source_created_at 
ON reviews(source, created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM reviews 
WHERE status = 'pending' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Caching Strategy

```javascript
// Redis caching configuration
const cacheConfig = {
  // Short-term cache for frequently accessed data
  reviews: { ttl: 300 }, // 5 minutes
  listings: { ttl: 1800 }, // 30 minutes
  
  // Long-term cache for relatively static data
  analytics: { ttl: 3600 }, // 1 hour
  statistics: { ttl: 7200 }, // 2 hours
};
```

This comprehensive deployment guide covers all aspects of deploying the FlexLiving Reviews Dashboard from development to production-ready cloud deployments. Follow the appropriate sections based on your deployment requirements and infrastructure preferences.
