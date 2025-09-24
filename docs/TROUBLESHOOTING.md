# FlexLiving Reviews Dashboard - Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting information for common issues, diagnostic procedures, and solutions for the FlexLiving Reviews Dashboard.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Application Issues](#application-issues)
- [Database Problems](#database-problems)
- [API Integration Issues](#api-integration-issues)
- [Performance Problems](#performance-problems)
- [Deployment Issues](#deployment-issues)
- [Security & Authentication](#security--authentication)
- [Monitoring & Logging](#monitoring--logging)
- [Common Error Codes](#common-error-codes)
- [Emergency Procedures](#emergency-procedures)

## Quick Diagnostics

### System Health Check

```bash
#!/bin/bash
# Run this script for quick system diagnostics

echo "=== FlexLiving Reviews Dashboard Health Check ==="

# Check application status
echo "1. Application Status:"
curl -s http://localhost:3001/api/health | jq '.' || echo "❌ Backend not responding"
curl -s http://localhost:3000/api/health | jq '.' || echo "❌ Frontend not responding"

# Check database connectivity
echo "2. Database Status:"
pg_isready -h localhost -p 5432 && echo "✅ Database connected" || echo "❌ Database unreachable"

# Check Redis connectivity
echo "3. Cache Status:"
redis-cli ping | grep -q "PONG" && echo "✅ Redis connected" || echo "❌ Redis unreachable"

# Check external APIs
echo "4. External APIs:"
curl -s "https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=$GOOGLE_PLACES_API_KEY" | grep -q "OK\|ZERO_RESULTS" && echo "✅ Google API working" || echo "❌ Google API issues"

# Check disk space
echo "5. System Resources:"
df -h | grep -E '(Filesystem|/$)' 
free -h

echo "=== Health Check Complete ==="
```

### Service Status Commands

```bash
# Check service status (Docker)
docker-compose ps

# Check service logs
docker-compose logs backend --tail=50
docker-compose logs frontend --tail=50

# Check Kubernetes pods
kubectl get pods -n flexliving-reviews
kubectl describe pod <pod-name> -n flexliving-reviews

# Check service endpoints
kubectl get svc -n flexliving-reviews
kubectl get ingress -n flexliving-reviews
```

## Application Issues

### Backend Application Won't Start

**Symptoms:**
- Server fails to start
- "Cannot connect to database" errors
- Port already in use errors

**Diagnostic Steps:**

1. **Check Environment Variables**
   ```bash
   # Verify required environment variables
   env | grep -E "(DATABASE_URL|REDIS_URL|JWT_SECRET|PORT)"
   
   # Validate database URL format
   echo $DATABASE_URL | grep -q "postgresql://" || echo "Invalid DATABASE_URL format"
   ```

2. **Check Port Availability**
   ```bash
   # Check if port is already in use
   lsof -i :3001
   netstat -tlnp | grep :3001
   
   # Kill process using the port (if needed)
   kill -9 $(lsof -t -i :3001)
   ```

3. **Verify Database Connection**
   ```bash
   # Test database connection
   psql $DATABASE_URL -c "SELECT version();"
   
   # Check database exists
   psql $DATABASE_URL -c "\l"
   ```

**Solutions:**

- **Missing Environment Variables**: Copy `.env.example` to `.env` and fill in values
- **Database Connection Issues**: Check database server status and credentials
- **Port Conflicts**: Change PORT environment variable or kill conflicting process
- **Prisma Issues**: Run `npx prisma generate` and `npx prisma migrate deploy`

### Frontend Application Issues

**Symptoms:**
- Blank page or loading forever
- API connection errors
- Build failures

**Diagnostic Steps:**

1. **Check Console Errors**
   ```javascript
   // Open browser console and look for:
   // - Network errors
   // - CORS errors
   // - JavaScript errors
   // - Failed API calls
   ```

2. **Verify API Connection**
   ```bash
   # Test API endpoint from frontend environment
   curl http://localhost:3001/api/health
   
   # Check CORS configuration
   curl -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: X-Requested-With" \
        -X OPTIONS http://localhost:3001/api/reviews
   ```

3. **Check Build Process**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   
   # Try building manually
   npm run build
   ```

**Solutions:**

- **CORS Errors**: Update CORS_ORIGIN in backend environment
- **Build Issues**: Check Node.js version compatibility (use Node 18+)
- **API Connection**: Verify NEXT_PUBLIC_API_URL points to correct backend
- **Memory Issues**: Increase Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=4096`

### Review Import Failures

**Symptoms:**
- Hostaway import returning 0 reviews
- Google Reviews import fails
- Reviews stuck in processing state

**Diagnostic Steps:**

1. **Check API Keys and Authentication**
   ```bash
   # Test Hostaway API
   curl -H "Authorization: Bearer $HOSTAWAY_API_KEY" \
        "https://api.hostaway.com/v1/listings"
   
   # Test Google Places API
   curl "https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=$GOOGLE_PLACES_API_KEY"
   ```

2. **Check Database for Existing Reviews**
   ```sql
   -- Check for duplicate external IDs
   SELECT external_id, COUNT(*) 
   FROM reviews 
   GROUP BY external_id 
   HAVING COUNT(*) > 1;
   
   -- Check recent import activity
   SELECT source, status, COUNT(*), MAX(created_at)
   FROM reviews 
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY source, status;
   ```

3. **Check Import Logs**
   ```bash
   # Backend logs
   docker-compose logs backend | grep -i "import\|error"
   
   # Kubernetes logs
   kubectl logs -l app=flexliving-reviews-backend -n flexliving-reviews | grep import
   ```

**Solutions:**

- **API Key Issues**: Verify API keys are correct and have proper permissions
- **Rate Limiting**: Implement exponential backoff and respect API limits
- **Duplicate Prevention**: Check external_id uniqueness before insert
- **Data Validation**: Ensure imported data meets schema requirements

## Database Problems

### Connection Issues

**Symptoms:**
- "Connection refused" errors
- Timeout errors
- "Too many connections" errors

**Diagnostic Steps:**

1. **Check Database Server Status**
   ```bash
   # PostgreSQL service status
   systemctl status postgresql
   
   # Docker container status
   docker-compose ps postgres
   
   # Check database logs
   docker-compose logs postgres
   ```

2. **Test Connection Parameters**
   ```bash
   # Parse DATABASE_URL
   echo $DATABASE_URL | sed 's|postgresql://\([^:]*\):\([^@]*\)@\([^:]*\):\([^/]*\)/\(.*\)|User: \1\nPassword: [hidden]\nHost: \3\nPort: \4\nDatabase: \5|'
   
   # Test connectivity
   telnet postgres-host 5432
   nc -v postgres-host 5432
   ```

3. **Check Connection Pool**
   ```sql
   -- Check active connections
   SELECT count(*) as active_connections 
   FROM pg_stat_activity 
   WHERE state = 'active';
   
   -- Check max connections
   SHOW max_connections;
   
   -- Check connection by application
   SELECT application_name, count(*) 
   FROM pg_stat_activity 
   GROUP BY application_name;
   ```

**Solutions:**

- **Service Down**: Start database service or container
- **Wrong Credentials**: Verify username, password, and database name
- **Connection Pool Exhausted**: Increase connection pool size or fix connection leaks
- **Firewall Issues**: Check firewall rules and security groups

### Performance Issues

**Symptoms:**
- Slow query responses
- High CPU/memory usage
- Frequent timeouts

**Diagnostic Steps:**

1. **Identify Slow Queries**
   ```sql
   -- Enable query stats (if not enabled)
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   
   -- Find slowest queries
   SELECT 
     query,
     mean_exec_time,
     calls,
     total_exec_time
   FROM pg_stat_statements 
   WHERE mean_exec_time > 100  -- queries > 100ms
   ORDER BY mean_exec_time DESC 
   LIMIT 10;
   ```

2. **Check Index Usage**
   ```sql
   -- Find tables without indexes
   SELECT schemaname, tablename, seq_scan, seq_tup_read, 
          idx_scan, idx_tup_fetch
   FROM pg_stat_user_tables
   WHERE seq_scan > idx_scan AND seq_tup_read > 1000;
   
   -- Check unused indexes
   SELECT schemaname, tablename, indexname, idx_scan
   FROM pg_stat_user_indexes
   WHERE idx_scan = 0;
   ```

3. **Monitor Resource Usage**
   ```bash
   # PostgreSQL resource usage
   docker stats postgres_container
   
   # Query activity
   psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"
   ```

**Solutions:**

- **Missing Indexes**: Add indexes for commonly queried columns
- **Inefficient Queries**: Optimize queries using EXPLAIN ANALYZE
- **Resource Limits**: Increase CPU/memory allocation
- **Connection Pooling**: Use connection pooling to reduce overhead

### Data Corruption or Inconsistency

**Symptoms:**
- Foreign key constraint violations
- Duplicate data
- Missing related records

**Diagnostic Steps:**

1. **Check Data Integrity**
   ```sql
   -- Check for orphaned records
   SELECT COUNT(*) FROM reviews r 
   LEFT JOIN listings l ON r.listing_id = l.id 
   WHERE l.id IS NULL;
   
   -- Check for duplicate external IDs
   SELECT external_id, COUNT(*) 
   FROM reviews 
   GROUP BY external_id 
   HAVING COUNT(*) > 1;
   
   -- Verify foreign key constraints
   SELECT conname, conrelid::regclass, confrelid::regclass
   FROM pg_constraint 
   WHERE contype = 'f' AND NOT convalidated;
   ```

2. **Check Audit Trail**
   ```sql
   -- Review recent changes
   SELECT * FROM review_audit_log 
   WHERE performed_at > NOW() - INTERVAL '24 hours'
   ORDER BY performed_at DESC;
   ```

**Solutions:**

- **Orphaned Records**: Clean up or restore missing parent records
- **Duplicate Data**: Remove duplicates and add unique constraints
- **Constraint Violations**: Fix data to satisfy constraints or adjust constraints

## API Integration Issues

### Hostaway Integration Problems

**Symptoms:**
- API authentication failures
- No data returned from API
- Rate limiting errors

**Diagnostic Steps:**

1. **Test API Authentication**
   ```bash
   # Test API key validity
   curl -H "Authorization: Bearer $HOSTAWAY_API_KEY" \
        -H "Accept: application/json" \
        "https://api.hostaway.com/v1/listings" \
        -w "\nHTTP Status: %{http_code}\n"
   ```

2. **Check API Response Format**
   ```bash
   # Get sample response
   curl -H "Authorization: Bearer $HOSTAWAY_API_KEY" \
        "https://api.hostaway.com/v1/listings?limit=1" | jq '.'
   ```

3. **Monitor Rate Limits**
   ```bash
   # Check rate limit headers
   curl -I -H "Authorization: Bearer $HOSTAWAY_API_KEY" \
        "https://api.hostaway.com/v1/listings"
   ```

**Solutions:**

- **Invalid API Key**: Regenerate API key from Hostaway dashboard
- **Expired Token**: Implement token refresh mechanism
- **Rate Limits**: Add delays between requests and implement exponential backoff
- **API Changes**: Update integration to handle API changes

### Google Reviews Integration Issues

**Symptoms:**
- "API key not valid" errors
- "OVER_QUERY_LIMIT" responses
- No reviews returned for valid places

**Diagnostic Steps:**

1. **Validate API Key**
   ```bash
   # Test Google Places API key
   curl "https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant&key=$GOOGLE_PLACES_API_KEY"
   
   # Check quota usage in Google Cloud Console
   ```

2. **Check API Quotas**
   ```javascript
   // Monitor API usage
   const usage = googleReviewsClient.getUsageStats();
   console.log('API usage:', usage);
   ```

3. **Test Different Endpoints**
   ```bash
   # Test different Google APIs
   curl "https://maps.googleapis.com/maps/api/place/details/json?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4&key=$GOOGLE_PLACES_API_KEY"
   ```

**Solutions:**

- **Invalid API Key**: Enable Google Places API in Google Cloud Console
- **Quota Exceeded**: Increase quotas or implement better rate limiting
- **No Reviews**: Some places have review access restricted by Google
- **Business Profile**: Complete business verification for enhanced access

## Performance Problems

### High Response Times

**Symptoms:**
- API endpoints taking > 2 seconds
- Frontend loading slowly
- Database query timeouts

**Diagnostic Steps:**

1. **Profile API Endpoints**
   ```bash
   # Test endpoint response times
   curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/reviews
   
   # curl-format.txt content:
   # time_total: %{time_total}s
   # time_connect: %{time_connect}s
   # time_starttransfer: %{time_starttransfer}s
   ```

2. **Check Database Performance**
   ```sql
   -- Find slow queries in real-time
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
   FROM pg_stat_activity 
   WHERE (now() - pg_stat_activity.query_start) > interval '1 minute';
   ```

3. **Monitor System Resources**
   ```bash
   # Check system load
   htop
   iostat -x 1
   
   # Check memory usage
   free -h
   
   # Check disk I/O
   iotop
   ```

**Solutions:**

- **Slow Queries**: Add database indexes and optimize queries
- **High CPU**: Scale up resources or optimize code
- **Memory Issues**: Increase memory allocation or fix memory leaks
- **I/O Bottlenecks**: Use faster storage or optimize data access patterns

### Memory Leaks

**Symptoms:**
- Gradually increasing memory usage
- Out of memory errors
- Application crashes

**Diagnostic Steps:**

1. **Monitor Memory Usage**
   ```bash
   # Monitor Node.js memory usage
   node --expose-gc --inspect app.js
   
   # Use memory profiling tools
   npm install -g clinic
   clinic doctor -- node app.js
   ```

2. **Check for Common Leak Patterns**
   ```javascript
   // Monitor heap usage
   setInterval(() => {
     const usage = process.memoryUsage();
     console.log('Memory usage:', {
       rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
       heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
       heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB'
     });
   }, 30000);
   ```

**Solutions:**

- **Unclosed Connections**: Ensure database connections are properly closed
- **Event Listeners**: Remove event listeners when no longer needed
- **Large Objects**: Avoid keeping large objects in memory unnecessarily
- **Caching Issues**: Implement cache eviction policies

### High CPU Usage

**Symptoms:**
- Server becomes unresponsive
- High load averages
- Request queuing

**Diagnostic Steps:**

1. **Profile CPU Usage**
   ```bash
   # Find CPU-intensive processes
   top -o %CPU
   
   # Profile Node.js application
   node --prof app.js
   node --prof-process isolate-*.log > processed.txt
   ```

2. **Check for Inefficient Code**
   ```javascript
   // Use built-in profiler
   console.time('operation');
   // ... your code
   console.timeEnd('operation');
   ```

**Solutions:**

- **Inefficient Algorithms**: Optimize algorithms and data structures
- **Blocking Operations**: Use asynchronous operations
- **Resource Scaling**: Add more CPU cores or instances
- **Load Balancing**: Distribute load across multiple instances

## Deployment Issues

### Container Startup Failures

**Symptoms:**
- Containers exit immediately
- "CrashLoopBackOff" in Kubernetes
- Health check failures

**Diagnostic Steps:**

1. **Check Container Logs**
   ```bash
   # Docker logs
   docker logs container-name
   
   # Kubernetes logs
   kubectl logs pod-name -c container-name
   kubectl describe pod pod-name
   ```

2. **Test Container Manually**
   ```bash
   # Run container interactively
   docker run -it --rm image-name /bin/sh
   
   # Check environment variables
   docker exec container-name env
   ```

3. **Verify Image Build**
   ```bash
   # Check image layers
   docker history image-name
   
   # Scan for vulnerabilities
   docker scan image-name
   ```

**Solutions:**

- **Missing Dependencies**: Install required dependencies in Dockerfile
- **Environment Variables**: Set required environment variables
- **File Permissions**: Fix file permission issues
- **Health Checks**: Adjust health check parameters

### SSL/TLS Certificate Issues

**Symptoms:**
- "Certificate not trusted" errors
- SSL handshake failures
- Certificate expiration warnings

**Diagnostic Steps:**

1. **Check Certificate Status**
   ```bash
   # Check certificate details
   openssl x509 -in certificate.pem -text -noout
   
   # Test SSL connection
   openssl s_client -connect reviews.flexliving.com:443
   
   # Check certificate chain
   curl -I https://reviews.flexliving.com
   ```

2. **Verify Certificate Configuration**
   ```bash
   # Check nginx configuration
   nginx -t
   
   # Check certificate files
   ls -la /etc/ssl/certs/
   ```

**Solutions:**

- **Expired Certificates**: Renew certificates (Let's Encrypt: `certbot renew`)
- **Wrong Certificate**: Ensure certificate matches domain
- **Missing Chain**: Include intermediate certificates
- **Configuration Errors**: Fix nginx/Apache SSL configuration

## Security & Authentication

### JWT Token Issues

**Symptoms:**
- "Token expired" errors
- "Invalid token" errors
- Authentication not working

**Diagnostic Steps:**

1. **Validate JWT Token**
   ```javascript
   // Decode JWT token (don't verify signature)
   const jwt = require('jsonwebtoken');
   const decoded = jwt.decode(token, { complete: true });
   console.log('Token header:', decoded.header);
   console.log('Token payload:', decoded.payload);
   ```

2. **Check Token Expiration**
   ```bash
   # Decode JWT token using online tool or command
   echo "token-here" | base64 -d
   ```

3. **Verify JWT Secret**
   ```javascript
   // Test token verification
   try {
     const verified = jwt.verify(token, process.env.JWT_SECRET);
     console.log('Token valid:', verified);
   } catch (error) {
     console.log('Token invalid:', error.message);
   }
   ```

**Solutions:**

- **Expired Tokens**: Implement token refresh mechanism
- **Wrong Secret**: Ensure JWT_SECRET matches across environments
- **Invalid Format**: Check token format and encoding
- **Clock Skew**: Synchronize server clocks

### Permission Errors

**Symptoms:**
- "Access denied" errors
- 403 Forbidden responses
- Users can't access certain features

**Diagnostic Steps:**

1. **Check User Roles**
   ```sql
   -- Check user permissions
   SELECT u.email, u.role, p.permission
   FROM users u
   LEFT JOIN user_permissions up ON u.id = up.user_id
   LEFT JOIN permissions p ON up.permission_id = p.id
   WHERE u.email = 'user@example.com';
   ```

2. **Verify Authentication Middleware**
   ```javascript
   // Add debug logging to auth middleware
   console.log('User:', req.user);
   console.log('Required permission:', requiredPermission);
   console.log('User permissions:', req.user.permissions);
   ```

**Solutions:**

- **Missing Permissions**: Grant required permissions to user
- **Role Configuration**: Update role-based access control
- **Middleware Issues**: Fix authentication/authorization middleware
- **Database Issues**: Check user/permission tables

## Monitoring & Logging

### Missing or Incomplete Logs

**Symptoms:**
- No logs in expected locations
- Log rotation issues
- Important events not logged

**Diagnostic Steps:**

1. **Check Log Configuration**
   ```bash
   # Check log files
   ls -la /var/log/
   tail -f /var/log/application.log
   
   # Check syslog
   journalctl -u application-service
   ```

2. **Verify Log Levels**
   ```javascript
   // Check current log level
   console.log('Current log level:', process.env.LOG_LEVEL);
   
   // Test different log levels
   logger.debug('Debug message');
   logger.info('Info message');
   logger.warn('Warning message');
   logger.error('Error message');
   ```

**Solutions:**

- **Log Level**: Set appropriate log level (DEBUG, INFO, WARN, ERROR)
- **File Permissions**: Ensure application can write to log directory
- **Disk Space**: Free up disk space if logs are filling up disk
- **Log Rotation**: Configure log rotation to prevent large files

### Monitoring Alerts Not Working

**Symptoms:**
- Not receiving expected alerts
- False positive alerts
- Metrics not being collected

**Diagnostic Steps:**

1. **Check Monitoring Configuration**
   ```yaml
   # Verify Prometheus configuration
   prometheus --config.file=prometheus.yml --web.enable-lifecycle
   
   # Test alert rules
   promtool check rules alert-rules.yml
   ```

2. **Verify Metrics Collection**
   ```bash
   # Check metrics endpoint
   curl http://localhost:9090/metrics
   
   # Query specific metrics
   curl 'http://localhost:9090/api/v1/query?query=up'
   ```

**Solutions:**

- **Alert Rules**: Fix alert rule syntax and thresholds
- **Metrics Collection**: Ensure metrics are being exposed correctly
- **Notification Channels**: Verify email/Slack webhook configuration
- **Service Discovery**: Check if services are being discovered correctly

## Common Error Codes

### HTTP Status Codes

| Code | Meaning | Common Causes | Solutions |
|------|---------|---------------|-----------|
| 400 | Bad Request | Invalid input data, malformed JSON | Validate request format and data |
| 401 | Unauthorized | Missing/invalid authentication token | Check JWT token and authentication |
| 403 | Forbidden | Insufficient permissions | Verify user roles and permissions |
| 404 | Not Found | Resource doesn't exist | Check if resource exists in database |
| 409 | Conflict | Duplicate resource creation | Handle uniqueness constraints |
| 422 | Validation Error | Data validation failed | Fix data validation rules |
| 429 | Rate Limited | Too many requests | Implement rate limiting and backoff |
| 500 | Server Error | Application error | Check application logs and fix bugs |
| 502 | Bad Gateway | Upstream server error | Check backend service status |
| 503 | Service Unavailable | Service overloaded/down | Scale up or restart services |

### Application Error Codes

| Error Code | Description | Common Causes | Solutions |
|------------|-------------|---------------|-----------|
| `DB_CONNECTION_ERROR` | Database connection failed | DB server down, wrong credentials | Check database status and connection string |
| `CACHE_ERROR` | Redis connection failed | Redis server down | Check Redis server status |
| `VALIDATION_ERROR` | Input validation failed | Invalid input data | Validate input on frontend |
| `EXTERNAL_API_ERROR` | Third-party API error | API down, rate limits | Implement retry logic and fallbacks |
| `AUTHENTICATION_FAILED` | JWT validation failed | Expired/invalid token | Refresh authentication token |
| `PERMISSION_DENIED` | Insufficient permissions | User lacks required role | Update user permissions |
| `RESOURCE_NOT_FOUND` | Resource doesn't exist | Invalid ID, deleted resource | Check if resource exists |
| `DUPLICATE_RESOURCE` | Resource already exists | Unique constraint violation | Handle duplicates appropriately |

## Emergency Procedures

### Complete System Outage

**Immediate Actions:**

1. **Check Service Status**
   ```bash
   # Quick status check
   curl -f http://localhost:3001/api/health || echo "Backend down"
   curl -f http://localhost:3000/api/health || echo "Frontend down"
   ```

2. **Check Infrastructure**
   ```bash
   # Database
   pg_isready -h localhost -p 5432
   
   # Redis
   redis-cli ping
   
   # Docker services
   docker-compose ps
   
   # Kubernetes services
   kubectl get pods -n flexliving-reviews
   ```

3. **Review Recent Changes**
   ```bash
   # Check recent deployments
   git log --oneline -10
   
   # Check recent commits
   kubectl rollout history deployment/backend -n flexliving-reviews
   ```

**Recovery Steps:**

1. **Restart Services**
   ```bash
   # Docker
   docker-compose restart
   
   # Kubernetes
   kubectl rollout restart deployment/backend -n flexliving-reviews
   kubectl rollout restart deployment/frontend -n flexliving-reviews
   ```

2. **Rollback if Necessary**
   ```bash
   # Kubernetes rollback
   kubectl rollout undo deployment/backend -n flexliving-reviews
   
   # Docker rollback
   docker-compose down
   git checkout previous-stable-commit
   docker-compose up -d
   ```

### Database Corruption

**Immediate Actions:**

1. **Stop Application Access**
   ```bash
   # Scale down application to prevent further damage
   kubectl scale deployment backend --replicas=0 -n flexliving-reviews
   ```

2. **Assess Damage**
   ```sql
   -- Check database integrity
   SELECT pg_database_size('flexliving_reviews');
   \dt+ -- Check table sizes
   
   -- Check for corruption
   REINDEX DATABASE flexliving_reviews;
   ```

3. **Restore from Backup**
   ```bash
   # Restore latest backup
   pg_restore -d flexliving_reviews /backups/latest-backup.sql
   
   # Or restore from point in time
   pg_basebackup -h backup-server -D /var/lib/postgresql/recovery
   ```

### Security Incident

**Immediate Response:**

1. **Isolate Affected Systems**
   ```bash
   # Block suspicious traffic
   iptables -A INPUT -s suspicious-ip -j DROP
   
   # Disable compromised accounts
   psql -c "UPDATE users SET active = false WHERE email = 'compromised@email.com'"
   ```

2. **Change All Secrets**
   ```bash
   # Rotate JWT secret
   kubectl create secret generic new-jwt-secret --from-literal=jwt-secret=new-secret
   
   # Update API keys
   # Regenerate all API keys from provider dashboards
   ```

3. **Enable Additional Monitoring**
   ```bash
   # Increase log level
   kubectl set env deployment/backend LOG_LEVEL=debug
   
   # Enable security monitoring
   # Review all access logs and audit trails
   ```

### Data Loss Prevention

**Before Making Changes:**

1. **Create Backup**
   ```bash
   # Database backup
   pg_dump $DATABASE_URL > emergency-backup-$(date +%Y%m%d_%H%M%S).sql
   
   # File system backup
   tar -czf app-backup-$(date +%Y%m%d_%H%M%S).tar.gz /app
   ```

2. **Test in Staging**
   ```bash
   # Deploy to staging first
   kubectl apply -f deployment.yml --namespace=flexliving-reviews-staging
   
   # Run tests
   npm run test:e2e
   ```

3. **Plan Rollback**
   ```bash
   # Prepare rollback commands
   echo "kubectl rollout undo deployment/backend" > rollback-commands.sh
   echo "kubectl rollout undo deployment/frontend" >> rollback-commands.sh
   chmod +x rollback-commands.sh
   ```

## Support Escalation

### When to Escalate

- System outage > 15 minutes
- Data corruption detected
- Security breach suspected
- Performance degradation > 50%
- Multiple service failures

### Escalation Contacts

1. **Level 1**: Development Team Lead
2. **Level 2**: Infrastructure Team
3. **Level 3**: CTO/Technical Director
4. **Level 4**: External Support Vendors

### Information to Include

- **Incident Description**: Clear description of the problem
- **Impact Assessment**: Services affected and user impact
- **Timeline**: When issue started and key events
- **Error Messages**: Exact error messages and logs
- **Steps Taken**: What troubleshooting steps have been attempted
- **System State**: Current status of all services

### Communication Template

```
Subject: [URGENT] FlexLiving Reviews Dashboard - [Brief Description]

Incident Summary:
- Service: FlexLiving Reviews Dashboard
- Severity: [Critical/High/Medium/Low]
- Status: [Investigating/In Progress/Resolved]
- Start Time: [Timestamp]
- Impact: [Description of user impact]

Description:
[Detailed description of the issue]

Current Status:
[What's currently happening]

Steps Taken:
1. [Action taken]
2. [Action taken]
3. [Action taken]

Next Steps:
[What will be done next]

Point of Contact:
[Your name and contact information]
```

This troubleshooting guide should help identify and resolve most common issues with the FlexLiving Reviews Dashboard. Keep this document updated as new issues are discovered and resolved.
