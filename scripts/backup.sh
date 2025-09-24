#!/bin/bash

# FlexLiving Reviews Dashboard - Backup Script
# This script handles backup operations for database and application data

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
ENVIRONMENT="production"
BACKUP_TYPE="full"
BACKUP_NAME=""
RESTORE_FILE=""
DRY_RUN=false
COMPRESS=true
ENCRYPT=false
UPLOAD_TO_CLOUD=true
RETENTION_DAYS=30
VERIFY_BACKUP=true

# Configuration
BACKUP_DIR="$PROJECT_ROOT/backups"
DATE_FORMAT="%Y%m%d_%H%M%S"
TIMESTAMP=$(date +"$DATE_FORMAT")

# Cloud storage configuration
AWS_S3_BUCKET="${AWS_S3_BACKUP_BUCKET:-}"
GCS_BUCKET="${GCS_BACKUP_BUCKET:-}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Print usage information
print_usage() {
    echo "Usage: $0 [OPTIONS] COMMAND"
    echo ""
    echo "Commands:"
    echo "  backup                  Create a backup"
    echo "  restore FILE           Restore from backup file"
    echo "  list                   List available backups"
    echo "  cleanup                Clean up old backups"
    echo "  verify FILE            Verify backup integrity"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV   Environment (staging|production) [default: production]"
    echo "  -t, --type TYPE         Backup type (full|database|files) [default: full]"
    echo "  -n, --name NAME         Custom backup name"
    echo "  --no-compress          Skip compression"
    echo "  --encrypt              Encrypt backup"
    echo "  --no-cloud             Skip cloud upload"
    echo "  --retention-days N     Retention period in days [default: 30]"
    echo "  --no-verify            Skip backup verification"
    echo "  --dry-run              Show what would be done without executing"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backup                           # Full backup of production"
    echo "  $0 backup -t database               # Database-only backup"
    echo "  $0 backup -e staging -n pre-deploy  # Named staging backup"
    echo "  $0 restore backup_20240115_143022.sql  # Restore from backup"
    echo "  $0 list                             # List all backups"
    echo "  $0 cleanup                          # Clean up old backups"
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
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        backup|restore|list|cleanup|verify)
            if [[ -n "$COMMAND" ]]; then
                print_error "Multiple commands specified"
                print_usage
                exit 1
            fi
            COMMAND="$1"
            if [[ "$COMMAND" == "restore" || "$COMMAND" == "verify" ]]; then
                if [[ $# -gt 1 && ! "$2" =~ ^- ]]; then
                    RESTORE_FILE="$2"
                    shift 2
                else
                    shift
                fi
            else
                shift
            fi
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -n|--name)
            BACKUP_NAME="$2"
            shift 2
            ;;
        --no-compress)
            COMPRESS=false
            shift
            ;;
        --encrypt)
            ENCRYPT=true
            shift
            ;;
        --no-cloud)
            UPLOAD_TO_CLOUD=false
            shift
            ;;
        --retention-days)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        --no-verify)
            VERIFY_BACKUP=false
            shift
            ;;
        --dry-run)
            DRY_RUN=true
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

# Validate command
if [[ -z "$COMMAND" ]]; then
    print_error "Command is required"
    print_usage
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    exit 1
fi

# Validate backup type
if [[ ! "$BACKUP_TYPE" =~ ^(full|database|files)$ ]]; then
    print_error "Invalid backup type: $BACKUP_TYPE"
    exit 1
fi

# Set environment-specific configurations
case $ENVIRONMENT in
    staging)
        NAMESPACE="flexliving-reviews-staging"
        ;;
    production)
        NAMESPACE="flexliving-reviews"
        ;;
esac

# Create backup directory
mkdir -p "$BACKUP_DIR"

print_status "FlexLiving Reviews Dashboard Backup Tool - $COMMAND"

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check kubectl for Kubernetes backups
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi
    
    # Check if kubectl can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        print_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    # Check compression tools
    if [[ "$COMPRESS" == true ]] && ! command -v gzip &> /dev/null; then
        print_warning "gzip not available, disabling compression"
        COMPRESS=false
    fi
    
    # Check encryption tools
    if [[ "$ENCRYPT" == true ]] && ! command -v openssl &> /dev/null; then
        print_warning "openssl not available, disabling encryption"
        ENCRYPT=false
    fi
    
    # Check cloud tools
    if [[ "$UPLOAD_TO_CLOUD" == true ]]; then
        if [[ -n "$AWS_S3_BUCKET" ]] && ! command -v aws &> /dev/null; then
            print_warning "AWS CLI not available, disabling S3 upload"
            UPLOAD_TO_CLOUD=false
        elif [[ -n "$GCS_BUCKET" ]] && ! command -v gsutil &> /dev/null; then
            print_warning "gsutil not available, disabling GCS upload"
            UPLOAD_TO_CLOUD=false
        fi
    fi
    
    print_success "Prerequisites check completed"
}

# Get database connection info
get_db_connection() {
    print_status "Getting database connection information..."
    
    # Get database URL from Kubernetes secret
    DATABASE_URL=$(kubectl get secret flexliving-reviews-secrets -n "$NAMESPACE" -o jsonpath='{.data.database-url}' | base64 -d)
    
    if [[ -z "$DATABASE_URL" ]]; then
        print_error "Could not retrieve database URL"
        exit 1
    fi
    
    print_success "Database connection information retrieved"
}

# Create database backup
backup_database() {
    print_status "Creating database backup..."
    
    get_db_connection
    
    local backup_file
    if [[ -n "$BACKUP_NAME" ]]; then
        backup_file="$BACKUP_DIR/${ENVIRONMENT}_${BACKUP_NAME}_database_${TIMESTAMP}.sql"
    else
        backup_file="$BACKUP_DIR/${ENVIRONMENT}_database_backup_${TIMESTAMP}.sql"
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        print_status "DRY RUN - Would create database backup: $backup_file"
        return
    fi
    
    # Create backup using kubectl exec on specific pod
    print_status "Dumping database..."
    
    # Get specific postgres pod instead of using deployment
    local postgres_pod=$(kubectl get pod -l app=postgres -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}')
    if [[ -z "$postgres_pod" ]]; then
        print_error "No postgres pod found in namespace $NAMESPACE"
        exit 1
    fi
    
    print_status "Using postgres pod: $postgres_pod"
    kubectl exec -n "$NAMESPACE" "$postgres_pod" -- pg_dump "$DATABASE_URL" > "$backup_file"
    
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    print_success "Database backup created: $backup_file ($(numfmt --to=iec $file_size))"
    
    # Compress if requested
    if [[ "$COMPRESS" == true ]]; then
        print_status "Compressing backup..."
        gzip "$backup_file"
        backup_file="$backup_file.gz"
        local compressed_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
        print_success "Backup compressed ($(numfmt --to=iec $compressed_size))"
    fi
    
    # Encrypt if requested
    if [[ "$ENCRYPT" == true ]]; then
        encrypt_file "$backup_file"
    fi
    
    # Verify backup
    if [[ "$VERIFY_BACKUP" == true ]]; then
        verify_database_backup "$backup_file"
    fi
    
    # Upload to cloud
    if [[ "$UPLOAD_TO_CLOUD" == true ]]; then
        upload_to_cloud "$backup_file"
    fi
    
    print_success "Database backup completed: $backup_file"
}

# Create files backup
backup_files() {
    print_status "Creating files backup..."
    
    local backup_file
    if [[ -n "$BACKUP_NAME" ]]; then
        backup_file="$BACKUP_DIR/${ENVIRONMENT}_${BACKUP_NAME}_files_${TIMESTAMP}.tar"
    else
        backup_file="$BACKUP_DIR/${ENVIRONMENT}_files_backup_${TIMESTAMP}.tar"
    fi
    
    if [[ "$DRY_RUN" == true ]]; then
        print_status "DRY RUN - Would create files backup: $backup_file"
        return
    fi
    
    # Create temporary directory for file extraction
    local temp_dir=$(mktemp -d)
    
    # Extract files from persistent volumes
    print_status "Extracting files from persistent volumes..."
    
    # Get list of persistent volumes
    local pvcs=$(kubectl get pvc -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for pvc in $pvcs; do
        print_status "Backing up PVC: $pvc"
        
        # Create temporary pod with deterministic name
        local backup_pod_name="backup-pvc-${pvc}-$(date +%s)"
        
        # Create backup pod using Job for better cleanup
        cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${backup_pod_name}
  namespace: ${NAMESPACE}
  labels:
    app: flexliving-reviews
    component: backup
spec:
  ttlSecondsAfterFinished: 300
  template:
    metadata:
      labels:
        app: flexliving-reviews
        component: backup
    spec:
      restartPolicy: OnFailure
      containers:
      - name: backup
        image: alpine:latest
        command: ['sh', '-c', 'sleep 3600']
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: ${pvc}
EOF
        
        # Wait for pod to be ready
        print_status "Waiting for backup pod to be ready..."
        kubectl wait --for=condition=ready --timeout=60s pod -l job-name=${backup_pod_name} -n "$NAMESPACE"
        
        # Get the exact pod name
        local pod_name=$(kubectl get pod -l job-name=${backup_pod_name} -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}')
        
        if [[ -n "$pod_name" ]]; then
            print_status "Copying data from pod: $pod_name"
            kubectl cp "$NAMESPACE/$pod_name:/data" "$temp_dir/$pvc" || true
        else
            print_warning "Could not find backup pod for PVC: $pvc"
        fi
        
        # Clean up job (pod will be cleaned up automatically by ttlSecondsAfterFinished)
        kubectl delete job "$backup_pod_name" -n "$NAMESPACE" || true
    done
    
    # Create tar archive
    print_status "Creating archive..."
    tar -cf "$backup_file" -C "$temp_dir" .
    
    # Clean up temporary directory
    rm -rf "$temp_dir"
    
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    print_success "Files backup created: $backup_file ($(numfmt --to=iec $file_size))"
    
    # Compress if requested
    if [[ "$COMPRESS" == true ]]; then
        print_status "Compressing backup..."
        gzip "$backup_file"
        backup_file="$backup_file.gz"
        local compressed_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
        print_success "Backup compressed ($(numfmt --to=iec $compressed_size))"
    fi
    
    # Encrypt if requested
    if [[ "$ENCRYPT" == true ]]; then
        encrypt_file "$backup_file"
    fi
    
    # Upload to cloud
    if [[ "$UPLOAD_TO_CLOUD" == true ]]; then
        upload_to_cloud "$backup_file"
    fi
    
    print_success "Files backup completed: $backup_file"
}

# Create full backup
backup_full() {
    print_status "Creating full backup (database + files)..."
    
    # Create database backup
    BACKUP_NAME="${BACKUP_NAME}_db"
    backup_database
    
    # Create files backup
    BACKUP_NAME="${BACKUP_NAME//_db/_files}"
    backup_files
    
    print_success "Full backup completed"
}

# Encrypt file
encrypt_file() {
    local file="$1"
    
    if [[ -z "$ENCRYPTION_KEY" ]]; then
        print_error "Encryption key not provided"
        return 1
    fi
    
    print_status "Encrypting backup file..."
    openssl enc -aes-256-cbc -salt -in "$file" -out "$file.enc" -k "$ENCRYPTION_KEY"
    rm "$file"
    mv "$file.enc" "$file"
    print_success "Backup encrypted"
}

# Decrypt file
decrypt_file() {
    local file="$1"
    
    if [[ -z "$ENCRYPTION_KEY" ]]; then
        print_error "Encryption key not provided"
        return 1
    fi
    
    print_status "Decrypting backup file..."
    openssl enc -aes-256-cbc -d -in "$file" -out "${file%.enc}" -k "$ENCRYPTION_KEY"
    print_success "Backup decrypted"
}

# Upload to cloud storage
upload_to_cloud() {
    local file="$1"
    local filename=$(basename "$file")
    
    print_status "Uploading backup to cloud storage..."
    
    if [[ -n "$AWS_S3_BUCKET" ]]; then
        aws s3 cp "$file" "s3://$AWS_S3_BUCKET/backups/$ENVIRONMENT/$filename"
        print_success "Backup uploaded to S3: s3://$AWS_S3_BUCKET/backups/$ENVIRONMENT/$filename"
    elif [[ -n "$GCS_BUCKET" ]]; then
        gsutil cp "$file" "gs://$GCS_BUCKET/backups/$ENVIRONMENT/$filename"
        print_success "Backup uploaded to GCS: gs://$GCS_BUCKET/backups/$ENVIRONMENT/$filename"
    else
        print_warning "No cloud storage configured"
    fi
}

# Verify database backup
verify_database_backup() {
    local backup_file="$1"
    
    print_status "Verifying database backup..."
    
    # Basic file checks
    if [[ ! -f "$backup_file" ]]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    if [[ $file_size -lt 1000 ]]; then
        print_error "Backup file seems too small: $(numfmt --to=iec $file_size)"
        return 1
    fi
    
    # Check if compressed file is valid
    if [[ "$backup_file" == *.gz ]]; then
        if ! gzip -t "$backup_file"; then
            print_error "Compressed backup file is corrupted"
            return 1
        fi
    fi
    
    print_success "Database backup verification passed"
}

# Restore database from backup
restore_database() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    print_warning "This will replace the current database with the backup!"
    print_status "Backup file: $backup_file"
    print_status "Target environment: $ENVIRONMENT"
    
    if [[ "$DRY_RUN" == true ]]; then
        print_status "DRY RUN - Would restore database from: $backup_file"
        return
    fi
    
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_status "Restore cancelled"
        exit 0
    fi
    
    get_db_connection
    
    # Decrypt if encrypted
    if [[ "$backup_file" == *.enc ]]; then
        decrypt_file "$backup_file"
        backup_file="${backup_file%.enc}"
    fi
    
    # Decompress if compressed
    if [[ "$backup_file" == *.gz ]]; then
        print_status "Decompressing backup..."
        gunzip "$backup_file"
        backup_file="${backup_file%.gz}"
    fi
    
    # Create restore job
    print_status "Creating database restore job..."
    cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: db-restore-$(date +%s)
  namespace: $NAMESPACE
  labels:
    app: flexliving-reviews
    component: restore
spec:
  template:
    metadata:
      labels:
        app: flexliving-reviews
        component: restore
    spec:
      restartPolicy: OnFailure
      containers:
      - name: restore
        image: postgres:15-alpine
        command: ['sh', '-c']
        args:
        - |
          echo "Starting database restore..."
          psql \$DATABASE_URL < /backup/restore.sql
          echo "Database restore completed successfully"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: flexliving-reviews-secrets
              key: database-url
        volumeMounts:
        - name: backup-data
          mountPath: /backup
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 1
            memory: 1Gi
      volumes:
      - name: backup-data
        configMap:
          name: restore-data-$(date +%s)
EOF
    
    # Create ConfigMap with backup data
    kubectl create configmap "restore-data-$(date +%s)" --from-file=restore.sql="$backup_file" -n "$NAMESPACE"
    
    # Wait for restore to complete
    local job_name=$(kubectl get jobs -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp | grep db-restore | tail -1 | awk '{print $1}')
    
    print_status "Waiting for restore job to complete: $job_name"
    kubectl wait --for=condition=complete --timeout=600s job/"$job_name" -n "$NAMESPACE"
    
    # Show restore logs
    print_status "Restore logs:"
    kubectl logs job/"$job_name" -n "$NAMESPACE"
    
    # Clean up
    kubectl delete job "$job_name" -n "$NAMESPACE"
    kubectl delete configmap "restore-data-*" -n "$NAMESPACE"
    
    print_success "Database restore completed successfully"
}

# List available backups
list_backups() {
    print_status "Available backups:"
    
    if [[ -d "$BACKUP_DIR" ]]; then
        ls -lh "$BACKUP_DIR"/*backup* 2>/dev/null | while read -r line; do
            print_status "$line"
        done
    else
        print_status "No local backups found"
    fi
    
    # List cloud backups
    if [[ -n "$AWS_S3_BUCKET" ]] && command -v aws &> /dev/null; then
        print_status ""
        print_status "S3 backups:"
        aws s3 ls "s3://$AWS_S3_BUCKET/backups/$ENVIRONMENT/" --human-readable
    fi
    
    if [[ -n "$GCS_BUCKET" ]] && command -v gsutil &> /dev/null; then
        print_status ""
        print_status "GCS backups:"
        gsutil ls -lh "gs://$GCS_BUCKET/backups/$ENVIRONMENT/"
    fi
}

# Clean up old backups
cleanup_backups() {
    print_status "Cleaning up backups older than $RETENTION_DAYS days..."
    
    if [[ "$DRY_RUN" == true ]]; then
        print_status "DRY RUN - Would delete backups older than $RETENTION_DAYS days"
        find "$BACKUP_DIR" -name "*backup*" -type f -mtime +$RETENTION_DAYS -ls 2>/dev/null || true
        return
    fi
    
    # Local cleanup
    local deleted_count=0
    if [[ -d "$BACKUP_DIR" ]]; then
        while IFS= read -r -d '' file; do
            rm "$file"
            print_status "Deleted: $(basename "$file")"
            ((deleted_count++))
        done < <(find "$BACKUP_DIR" -name "*backup*" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    fi
    
    # Cloud cleanup
    if [[ -n "$AWS_S3_BUCKET" ]] && command -v aws &> /dev/null; then
        aws s3 ls "s3://$AWS_S3_BUCKET/backups/$ENVIRONMENT/" | while read -r line; do
            local date_str=$(echo "$line" | awk '{print $1}')
            local file_name=$(echo "$line" | awk '{print $4}')
            local file_date=$(date -d "$date_str" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$date_str" +%s 2>/dev/null)
            local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%s 2>/dev/null || date -j -v-${RETENTION_DAYS}d +%s 2>/dev/null)
            
            if [[ $file_date -lt $cutoff_date ]]; then
                aws s3 rm "s3://$AWS_S3_BUCKET/backups/$ENVIRONMENT/$file_name"
                print_status "Deleted from S3: $file_name"
                ((deleted_count++))
            fi
        done
    fi
    
    print_success "Cleanup completed: $deleted_count files deleted"
}

# Main execution
main() {
    check_prerequisites
    
    case $COMMAND in
        backup)
            case $BACKUP_TYPE in
                full)
                    backup_full
                    ;;
                database)
                    backup_database
                    ;;
                files)
                    backup_files
                    ;;
            esac
            ;;
        restore)
            if [[ -z "$RESTORE_FILE" ]]; then
                print_error "Restore file is required"
                exit 1
            fi
            restore_database "$RESTORE_FILE"
            ;;
        list)
            list_backups
            ;;
        cleanup)
            cleanup_backups
            ;;
        verify)
            if [[ -z "$RESTORE_FILE" ]]; then
                print_error "Backup file is required for verification"
                exit 1
            fi
            verify_database_backup "$RESTORE_FILE"
            ;;
    esac
}

# Execute main function
main "$@"
