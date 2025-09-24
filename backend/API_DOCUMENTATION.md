# FlexApp Reviews API Documentation

## Overview

The FlexApp Reviews API provides comprehensive access to normalized review data from the Hostaway platform and comprehensive review management functionality. This API implements robust caching, filtering, pagination, and error handling to ensure reliable access to review information for property management dashboards.

## Base URL

```
http://localhost:5000/api/reviews
```

## Authentication

The API uses Bearer token authentication for protected endpoints. Review approval operations require authentication and specific permissions.

### Protected Endpoints

The following endpoints require authentication:
- `PATCH /api/reviews/:id/approve` - Requires `reviews:approve` permission
- `PATCH /api/reviews/:id/unapprove` - Requires `reviews:approve` permission  
- `POST /api/reviews/bulk-approve` - Requires `reviews:approve` permission

### Authentication Header

Include the Bearer token in the Authorization header:

```
Authorization: Bearer <your-token>
```

### Development Mode

In development mode (NODE_ENV=development), authentication checks are bypassed and a mock user is used for testing purposes.

### Permissions

The following permissions are supported:
- `reviews:read` - Read access to reviews
- `reviews:approve` - Approve/unapprove reviews
- `reviews:manage` - Full review management access
- `*` - Admin wildcard permission

### Example Authenticated Request

```bash
curl -X PATCH "http://localhost:5000/api/reviews/clx123abc/approve" \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "response": "Thank you!"}'
```

## Rate Limiting

- **Development**: 1000 requests per 15 minutes per IP
- **Production**: 100 requests per 15 minutes per IP

Rate limit information is included in response headers:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Remaining requests in current window
- `RateLimit-Reset`: Time when rate limit resets

## Response Headers

All API responses include these headers:
- `X-Request-ID`: Unique identifier for request tracking
- `X-Response-Time`: Request processing time in milliseconds
- `X-Cache-Status`: Cache status (`HIT`, `MISS`, or `BYPASS`)
- `X-Source`: Data source (`hostaway` or `mock`)

## Core Endpoints

### GET /api/reviews/hostaway

**Description**: Retrieves normalized reviews from the Hostaway API with intelligent caching, filtering, and pagination.

**Method**: `GET`

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `listingId` | integer | No | - | Filter reviews by specific listing ID |
| `from` | string (date) | No | - | Filter reviews from this date (ISO 8601 format) |
| `to` | string (date) | No | - | Filter reviews until this date (ISO 8601 format) |
| `channel` | string | No | - | Filter by review channel (`booking.com`, `airbnb`, `google`, `direct`, `vrbo`, `other`) |
| `approved` | boolean | No | - | Filter by approval status |
| `reviewType` | string | No | - | Filter by review type (`guest_review`, `host_review`, `auto_review`, `system_review`) |
| `guestName` | string | No | - | Filter by guest name (partial match) |
| `minRating` | number | No | - | Minimum rating filter (0-10) |
| `maxRating` | number | No | - | Maximum rating filter (0-10) |
| `hasResponse` | boolean | No | - | Filter reviews with/without host responses |
| `page` | integer | No | 1 | Page number for pagination |
| `limit` | integer | No | 20 | Number of reviews per page (max 100) |
| `format` | string | No | - | Response format. Use `simple` for backward compatibility to return `{ status: 'ok', data: [] }` |

#### Example Requests

```bash
# Get all reviews for a specific listing
curl "http://localhost:5000/api/reviews/hostaway?listingId=789"

# Get reviews with filtering and pagination
curl "http://localhost:5000/api/reviews/hostaway?listingId=789&from=2024-01-01&to=2024-01-31&channel=airbnb&approved=true&page=1&limit=20"

# Get highly-rated reviews with responses
curl "http://localhost:5000/api/reviews/hostaway?minRating=8&hasResponse=true"

# Get recent unapproved reviews
curl "http://localhost:5000/api/reviews/hostaway?approved=false&from=2024-01-01"

# Get reviews with simple format (backward compatibility)
curl "http://localhost:5000/api/reviews/hostaway?listingId=789&format=simple"
```

#### Response Format

**Default Response** (rich format with metadata):

```json
{
  "status": "success",
  "data": {
    "reviews": [
      {
        "id": 12345,
        "listingId": 789,
        "guestName": "John Doe",
        "comment": "Great stay! Clean and comfortable apartment.",
        "rating": 9.2,
        "categories": {
          "cleanliness": 9.5,
          "location": 9.0,
          "communication": 9.0,
          "value": 8.5,
          "amenities": 9.0
        },
        "createdAt": "2024-01-15T14:30:00.000Z",
        "updatedAt": "2024-01-15T14:30:00.000Z",
        "checkInDate": "2024-01-10T15:00:00.000Z",
        "checkOutDate": "2024-01-14T11:00:00.000Z",
        "reviewType": "guest_review",
        "channel": "airbnb",
        "approved": true,
        "response": "Thank you for your wonderful review!",
        "responseDate": "2024-01-16T09:00:00.000Z",
        "guestId": 456789,
        "reservationId": 987654,
        "language": "en",
        "source": "airbnb_api",
        "rawJson": {
          // Original raw review data for audit purposes
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 47,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "listingId": 789,
      "from": "2024-01-01",
      "to": "2024-01-31",
      "channel": "airbnb",
      "approved": true
    },
    "meta": {
      "cached": false,
      "cacheKey": "reviews:hostaway:listingId=789&approved=true",
      "processedAt": "2024-01-15T14:30:00.000Z",
      "source": "hostaway"
    }
  },
  "message": "Successfully retrieved 20 reviews"
}
```

**Simple Response Format** (when `format=simple` is used for backward compatibility):

```json
{
  "status": "ok",
  "data": [
    {
      "id": 12345,
      "listingId": 789,
      "guestName": "John Doe",
      "comment": "Great stay! Clean and comfortable apartment.",
      "rating": 9.2,
      "categories": {
        "cleanliness": 9.5,
        "location": 9.0,
        "communication": 9.0,
        "value": 8.5,
        "amenities": 9.0
      },
      "createdAt": "2024-01-15T14:30:00.000Z",
      "updatedAt": "2024-01-15T14:30:00.000Z",
      "checkInDate": "2024-01-10T15:00:00.000Z",
      "checkOutDate": "2024-01-14T11:00:00.000Z",
      "reviewType": "guest_review",
      "channel": "airbnb",
      "approved": true,
      "response": "Thank you for your wonderful review!",
      "responseDate": "2024-01-16T09:00:00.000Z",
      "guestId": 456789,
      "reservationId": 987654,
      "language": "en",
      "source": "airbnb_api",
      "rawJson": {
        // Original raw review data for audit purposes
      }
    }
  ]
}
```

#### HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid query parameters
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: External service unavailable

#### Error Response Format

```json
{
  "status": "error",
  "message": "Invalid query parameters",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "page",
      "message": "Expected number, received string",
      "value": "invalid"
    }
  ]
}
```

## Administrative Endpoints

### GET /api/reviews/hostaway/metrics

**Description**: Returns API and cache performance metrics for monitoring.

**Method**: `GET`

#### Response Format

```json
{
  "status": "success",
  "data": {
    "hostaway_api": {
      "totalRequests": 150,
      "successfulRequests": 145,
      "failedRequests": 5,
      "mockRequests": 20,
      "averageResponseTime": 250,
      "lastRequestAt": "2024-01-15T14:30:00.000Z",
      "successRate": 0.97,
      "errorRate": 0.03,
      "mockUsageRate": 0.13,
      "errors": [
        "2024-01-15T14:25:00.000Z: API timeout",
        "2024-01-15T13:45:00.000Z: Invalid response format"
      ]
    },
    "cache": {
      "hits": 95,
      "misses": 55,
      "sets": 55,
      "deletes": 10,
      "errors": 2,
      "totalRequests": 150,
      "hitRate": 0.63,
      "errorRate": 0.01,
      "lastReset": "2024-01-15T12:00:00.000Z"
    },
    "timestamp": "2024-01-15T14:30:00.000Z"
  }
}
```

### GET /api/reviews/hostaway/health

**Description**: Health check endpoint for monitoring service availability.

**Method**: `GET`

#### Response Format (Healthy)

```json
{
  "status": "healthy",
  "service": "hostaway-reviews",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "details": {
    "api_configured": true,
    "mock_mode": false,
    "mock_data_available": true,
    "last_request": "2024-01-15T14:25:00.000Z",
    "metrics": {
      "totalRequests": 100,
      "successfulRequests": 98,
      "failedRequests": 2,
      "averageResponseTime": 220,
      "successRate": 0.98,
      "errorRate": 0.02
    }
  }
}
```

#### Response Format (Unhealthy)

```json
{
  "status": "unhealthy",
  "service": "hostaway-reviews",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "details": {
    "api_configured": false,
    "mock_mode": true,
    "mock_data_available": false,
    "metrics": {
      "totalRequests": 0,
      "successfulRequests": 0,
      "failedRequests": 0,
      "averageResponseTime": 0,
      "successRate": 0,
      "errorRate": 0
    }
  },
  "error": "Mock data file not accessible"
}
```

### POST /api/reviews/hostaway/cache/invalidate

**Description**: Invalidates cached data for specific listings or patterns.

**Method**: `POST`

#### Request Body

```json
{
  "listingId": 123  // Invalidate cache for specific listing
}
```

Or for pattern-based invalidation:

```json
{
  "pattern": "reviews:hostaway:*approved=false*"
}
```

Or for specific key:

```json
{
  "key": "reviews:hostaway:listingId=123&page=1"
}
```

#### Response Format

```json
{
  "status": "success",
  "data": {
    "deletedCount": 5,
    "timestamp": "2024-01-15T14:30:00.000Z"
  },
  "message": "Successfully invalidated 5 cache entries"
}
```

### GET /api/reviews/hostaway/cache/stats

**Description**: Returns detailed cache statistics and configuration.

**Method**: `GET`

#### Response Format

```json
{
  "status": "success",
  "data": {
    "metrics": {
      "hits": 120,
      "misses": 45,
      "sets": 45,
      "deletes": 8,
      "errors": 1,
      "totalRequests": 165,
      "hitRate": 0.73,
      "errorRate": 0.006,
      "lastReset": "2024-01-15T12:00:00.000Z"
    },
    "config": {
      "enabled": true,
      "defaultTtl": 300,
      "keyPrefix": "reviews"
    },
    "timestamp": "2024-01-15T14:30:00.000Z"
  }
}
```

## Data Models

### Normalized Review Object

```typescript
{
  id: number;                    // Unique review identifier
  listingId: number;             // Property listing identifier
  guestName: string;             // Guest name (sanitized)
  comment: string;               // Review comment (sanitized)
  rating: number;                // Overall rating (0-10 scale)
  categories: {                  // Category ratings
    [categoryName: string]: number;  // Normalized to 0-10 scale
  };
  createdAt: string;             // ISO 8601 UTC timestamp
  updatedAt: string;             // ISO 8601 UTC timestamp
  checkInDate?: string;          // ISO 8601 UTC timestamp
  checkOutDate?: string;         // ISO 8601 UTC timestamp
  reviewType: 'guest_review' | 'host_review' | 'auto_review' | 'system_review';
  channel: 'booking.com' | 'airbnb' | 'google' | 'direct' | 'vrbo' | 'other';
  approved: boolean;             // Review approval status
  response?: string;             // Host response (if any)
  responseDate?: string;         // Response timestamp
  guestId?: number;              // Guest identifier
  reservationId?: number;        // Reservation identifier
  language?: string;             // 2-letter ISO language code
  source?: string;               // Original data source
  rawJson: object;               // Original raw review data
}
```

### Pagination Object

```typescript
{
  page: number;           // Current page number
  limit: number;          // Items per page
  total: number;          // Total items available
  totalPages: number;     // Total pages available
  hasNext: boolean;       // More pages available
  hasPrev: boolean;       // Previous pages available
}
```

### Filters Object

```typescript
{
  listingId?: number;
  from?: string;          // ISO 8601 date
  to?: string;            // ISO 8601 date
  channel?: ReviewChannel;
  approved?: boolean;
  reviewType?: ReviewType;
}
```

### Meta Object

```typescript
{
  cached: boolean;        // Response served from cache
  cacheKey?: string;      // Cache key used
  processedAt: string;    // Processing timestamp
  source: 'hostaway' | 'mock' | 'database';  // Data source
}
```

## Caching Behavior

### Cache Strategy

- **TTL**: 5 minutes (300 seconds) by default
- **Key Format**: `reviews:hostaway:param1=value1&param2=value2`
- **Refresh Threshold**: 80% of TTL (cache refreshed in background)
- **Fallback**: Mock data when Hostaway API is unavailable

### Cache Keys

Cache keys are generated based on normalized query parameters:

```
reviews:hostaway:listingId=123&page=1&limit=20&approved=true
```

Parameters are sorted alphabetically and URL-encoded for consistency.

### Cache Invalidation

- **Manual**: Via `/cache/invalidate` endpoint
- **Automatic**: When reviews are approved/unapproved
- **TTL-based**: Automatic expiration after configured TTL

## Error Handling

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters |
| `NORMALIZATION_ERROR` | Failed to normalize review data |
| `SERVICE_UNAVAILABLE` | External service unavailable |
| `CACHE_ERROR` | Cache operation failed |
| `METRICS_ERROR` | Metrics collection failed |
| `INTERNAL_ERROR` | Unexpected server error |

### Error Response Structure

All error responses follow this format:

```json
{
  "status": "error",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "Additional error details (development only)"
}
```

## Performance Considerations

### Response Times

- **Cache Hit**: < 50ms
- **Cache Miss (Hostaway API)**: < 2000ms
- **Cache Miss (Mock Data)**: < 500ms

### Optimization Tips

1. **Use Caching**: Identical requests within 5 minutes return cached data
2. **Batch Requests**: Use pagination to retrieve large datasets efficiently
3. **Filter Early**: Apply filters to reduce data processing overhead
4. **Monitor Health**: Use health endpoint to verify service availability

## Development and Testing

### Mock Data

In development mode or when `HOSTAWAY_MOCK_MODE=true`, the API uses realistic mock data from `/mocks/hostaway_reviews.json`. Mock data includes:

- Various review types and channels
- Different rating patterns
- Approved and unapproved reviews
- Multiple listings and guests
- Edge cases for testing

### Environment Variables

```bash
# Hostaway API Configuration
HOSTAWAY_ACCOUNT=__PUT_ACCOUNT_ID_HERE__
HOSTAWAY_API_KEY=__PUT_KEY_HERE__

# Do not commit real secrets. Provide via local .env or deployment secrets manager.
HOSTAWAY_BASE_URL=https://api.hostaway.com/v1
HOSTAWAY_TIMEOUT=30000
HOSTAWAY_RETRIES=3
HOSTAWAY_MOCK_MODE=false

# Cache Configuration
CACHE_DEFAULT_TTL=300  # TTL in seconds, bounded to [120,300] (2-5 minutes)
CACHE_PREFIX=reviews   # Cache key prefix (optional, defaults to 'reviews')
REDIS_URL=redis://localhost:6379

# Development Settings
NODE_ENV=development
MOCK_LATENCY_MS=500
```

### Testing Endpoints

```bash
# Test with curl
curl -X GET "http://localhost:5000/api/reviews/hostaway?listingId=789" \
     -H "Content-Type: application/json"

# Test health endpoint
curl -X GET "http://localhost:5000/api/reviews/hostaway/health"

# Test cache invalidation
curl -X POST "http://localhost:5000/api/reviews/hostaway/cache/invalidate" \
     -H "Content-Type: application/json" \
     -d '{"listingId": 123}'
```

## Best Practices

### API Usage

1. **Handle Errors Gracefully**: Always check response status and handle errors
2. **Implement Retry Logic**: Retry failed requests with exponential backoff
3. **Use Appropriate Timeouts**: Set reasonable request timeouts
4. **Monitor Rate Limits**: Respect rate limiting to avoid blocking

### Data Processing

1. **Validate Input**: Always validate query parameters before requests
2. **Handle Pagination**: Use pagination for large datasets
3. **Cache Responses**: Implement client-side caching where appropriate
4. **Filter Efficiently**: Apply filters to reduce data transfer

### Monitoring

1. **Track Metrics**: Monitor API performance and error rates
2. **Set Up Alerts**: Alert on high error rates or service unavailability
3. **Log Requests**: Maintain request logs for debugging
4. **Monitor Cache Hit Rates**: Optimize caching strategy based on hit rates

## Examples

### Complete Integration Example (JavaScript)

```javascript
class ReviewsApiClient {
  constructor(baseUrl = 'http://localhost:5000/api/reviews') {
    this.baseUrl = baseUrl;
  }

  async getReviews(params = {}) {
    try {
      const url = new URL(`${this.baseUrl}/hostaway`);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value.toString());
        }
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }

      return data.data;
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      throw error;
    }
  }

  async getHealthStatus() {
    const response = await fetch(`${this.baseUrl}/hostaway/health`);
    return response.json();
  }

  async invalidateCache(params) {
    const response = await fetch(`${this.baseUrl}/hostaway/cache/invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    return response.json();
  }
}

// Usage examples
const client = new ReviewsApiClient();

// Get reviews for a specific listing
const reviews = await client.getReviews({
  listingId: 789,
  page: 1,
  limit: 20,
  approved: true
});

console.log(`Retrieved ${reviews.reviews.length} reviews`);
console.log(`Cache status: ${reviews.meta.cached ? 'HIT' : 'MISS'}`);

// Get highly-rated recent reviews
const recentHighRated = await client.getReviews({
  from: '2024-01-01',
  minRating: 8.0,
  hasResponse: true,
  limit: 10
});

// Check service health
const health = await client.getHealthStatus();
console.log(`Service is ${health.status}`);

// Invalidate cache for a listing
await client.invalidateCache({ listingId: 789 });
```

### Python Integration Example

```python
import requests
from typing import Dict, Optional, Any
from urllib.parse import urlencode

class ReviewsApiClient:
    def __init__(self, base_url: str = "http://localhost:5000/api/reviews"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 10
    
    def get_reviews(self, **params) -> Dict[str, Any]:
        """Get reviews with optional filtering and pagination."""
        # Remove None values
        filtered_params = {k: v for k, v in params.items() if v is not None}
        
        response = self.session.get(
            f"{self.base_url}/hostaway",
            params=filtered_params
        )
        
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'error':
            raise Exception(f"API Error: {data['message']}")
        
        return data['data']
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get service health status."""
        response = self.session.get(f"{self.base_url}/hostaway/health")
        return response.json()
    
    def invalidate_cache(self, **params) -> Dict[str, Any]:
        """Invalidate cache entries."""
        response = self.session.post(
            f"{self.base_url}/hostaway/cache/invalidate",
            json=params
        )
        response.raise_for_status()
        return response.json()

# Usage examples
client = ReviewsApiClient()

# Get reviews for a specific listing
try:
    reviews_data = client.get_reviews(
        listingId=789,
        page=1,
        limit=20,
        approved=True,
        minRating=8.0
    )
    
    print(f"Retrieved {len(reviews_data['reviews'])} reviews")
    print(f"Total available: {reviews_data['pagination']['total']}")
    print(f"Cache status: {'HIT' if reviews_data['meta']['cached'] else 'MISS'}")
    
    # Process reviews
    for review in reviews_data['reviews']:
        print(f"Review {review['id']}: {review['rating']}/10 - {review['guestName']}")
        
except Exception as e:
    print(f"Error: {e}")

# Check service health
health = client.get_health_status()
print(f"Service status: {health['status']}")

# Invalidate cache when needed
client.invalidate_cache(listingId=789)
```

# Review Management API Endpoints

## GET /api/reviews

**Description**: Comprehensive review management endpoint for retrieving reviews from the database with advanced filtering, sorting, and pagination capabilities.

**Method**: `GET`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `listingId` | integer | No | - | Filter reviews by specific listing ID (Hostaway ID) |
| `approved` | boolean | No | - | Filter by approval status |
| `channel` | string | No | - | Filter by review channel (`airbnb`, `booking.com`, `vrbo`, `google`, `direct`) |
| `reviewType` | string | No | - | Filter by review type (`guest_review`, `host_review`) |
| `minRating` | number | No | - | Minimum rating filter (0-10) |
| `maxRating` | number | No | - | Maximum rating filter (0-10) |
| `from` | string (date) | No | - | Filter reviews from this date (ISO 8601 format) |
| `to` | string (date) | No | - | Filter reviews until this date (ISO 8601 format) |
| `guestName` | string | No | - | Filter by guest name (partial match) |
| `hasResponse` | boolean | No | - | Filter reviews with/without host responses |
| `search` | string | No | - | Text search across guest names and review content |
| `page` | integer | No | 1 | Page number for pagination |
| `limit` | integer | No | 20 | Number of reviews per page (max 100) |
| `sortBy` | string | No | `submittedAt` | Sort field (`rating`, `submittedAt`, `createdAt`, `guestName`, `channel`) |
| `sortOrder` | string | No | `desc` | Sort direction (`asc`, `desc`) |

### Example Requests

```bash
# Get all reviews with default sorting
curl "http://localhost:5000/api/reviews"

# Get approved reviews for a specific listing
curl "http://localhost:5000/api/reviews?listingId=123&approved=true"

# Get highly-rated reviews from last month
curl "http://localhost:5000/api/reviews?minRating=8&from=2024-01-01&to=2024-01-31"

# Search reviews with text query
curl "http://localhost:5000/api/reviews?search=great%20location"

# Get reviews sorted by rating
curl "http://localhost:5000/api/reviews?sortBy=rating&sortOrder=desc&limit=10"
```

### Response Format

```json
{
  "status": "success",
  "data": {
    "reviews": [
      {
        "id": "clx123abc",
        "hostawayReviewId": "hr_12345",
        "listingId": "cls456def",
        "reviewType": "GUEST_REVIEW",
        "channel": "AIRBNB",
        "rating": 9.2,
        "publicReview": "Amazing place with great location!",
        "guestName": "John Doe",
        "submittedAt": "2024-01-15T10:30:00.000Z",
        "approved": true,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-16T09:15:00.000Z",
        "listing": {
          "id": "cls456def",
          "name": "Downtown Apartment",
          "slug": "downtown-apartment",
          "hostawayListingId": "123"
        },
        "reviewCategories": [
          {
            "id": "cat789",
            "category": "CLEANLINESS",
            "rating": 9.5
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "listingId": 123,
      "approved": true
    },
    "meta": {
      "processedAt": "2024-01-15T14:30:00.000Z",
      "totalApproved": 120,
      "totalPending": 36,
      "totalRejected": 0,
      "averageRating": 8.7
    }
  },
  "message": "Successfully retrieved 20 reviews"
}
```

## GET /api/reviews/:id

**Description**: Get a specific review by its ID.

**Method**: `GET`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Review ID (CUID format) |

### Example Request

```bash
curl "http://localhost:5000/api/reviews/clx123abc"
```

### Response Format

```json
{
  "status": "success",
  "data": {
    "review": {
      "id": "clx123abc",
      "hostawayReviewId": "hr_12345",
      "listingId": "cls456def",
      "reviewType": "GUEST_REVIEW",
      "channel": "AIRBNB",
      "rating": 9.2,
      "publicReview": "Amazing place!",
      "guestName": "John Doe",
      "submittedAt": "2024-01-15T10:30:00.000Z",
      "approved": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "listing": {
        "id": "cls456def",
        "name": "Downtown Apartment",
        "slug": "downtown-apartment",
        "hostawayListingId": "123"
      }
    },
    "meta": {
      "processedAt": "2024-01-15T14:30:00.000Z"
    }
  }
}
```

## GET /api/reviews/:id/approval-history

**Description**: Get approval history for a specific review including current status.

**Note**: This endpoint returns both `history` and `approvalHistory` fields for backward compatibility. New implementations should use the `history` field, as `approvalHistory` is deprecated. The `meta.note` field contains the legacy value `"Audit log implementation pending"` for existing consumers.

**Method**: `GET`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Review ID (CUID format) |

### Example Request

```bash
curl "http://localhost:5000/api/reviews/clx123abc/approval-history"
```

### Response Format

```json
{
  "status": "success",
  "data": {
    "reviewId": "clx123abc",
    "currentStatus": true,
    "history": [
      {
        "id": "audit123",
        "reviewId": "clx123abc",
        "action": "APPROVED",
        "previousValue": {
          "approved": false
        },
        "newValue": {
          "approved": true,
          "response": "Thank you for your feedback!"
        },
        "userId": "user123",
        "timestamp": "2024-01-16T09:15:00.000Z",
        "metadata": {
          "ip": "192.168.1.1",
          "userAgent": "Mozilla/5.0...",
          "source": "review_service"
        }
      }
    ],
    "approvalHistory": [
      // Deprecated: Same as history array for backward compatibility
      // Use 'history' field for new implementations
    ],
    "meta": {
      "processedAt": "2024-01-16T14:30:00.000Z",
      "totalEntries": 3,
      "note": "Audit log implementation pending"
    }
  }
}
```

## PATCH /api/reviews/:id/approve

**Description**: Approve or unapprove a review with optional response.

**Method**: `PATCH`

**Authentication**: Required (Bearer token)

**Permissions**: `reviews:approve`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Review ID (CUID format) |

### Request Body

```json
{
  "approved": true,
  "response": "Thank you for your feedback!"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `approved` | boolean | Yes | Approval status |
| `response` | string | No | Host response (max 5000 characters) |

### Example Requests

```bash
# Approve a review with response
curl -X PATCH "http://localhost:5000/api/reviews/clx123abc/approve" \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "response": "Thank you for your feedback!"}'

# Unapprove a review
curl -X PATCH "http://localhost:5000/api/reviews/clx123abc/approve" \
  -H "Content-Type: application/json" \
  -d '{"approved": false}'
```

### Response Format

```json
{
  "status": "success",
  "data": {
    "review": {
      "id": "clx123abc",
      "approved": true,
      "guestName": "John Doe",
      "rating": 9.2
    },
    "meta": {
      "processedAt": "2024-01-15T14:30:00.000Z",
      "action": "approved",
      "previousStatus": false
    }
  },
  "message": "Review approved successfully"
}
```

## PATCH /api/reviews/:id/unapprove

**Description**: Convenience endpoint for unapproving a review.

**Method**: `PATCH`

**Authentication**: Required (Bearer token)

**Permissions**: `reviews:approve`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Review ID (CUID format) |

### Example Request

```bash
curl -X PATCH "http://localhost:5000/api/reviews/clx123abc/unapprove"
```

## POST /api/reviews/bulk-approve

**Description**: Bulk approve or unapprove multiple reviews.

**Method**: `POST`

**Authentication**: Required (Bearer token)

**Permissions**: `reviews:approve`

### Request Body

```json
{
  "reviewIds": ["clx123abc", "clx456def", "clx789ghi"],
  "approved": true,
  "response": "Thank you all for your feedback!"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reviewIds` | array | Yes | Array of review IDs (max 100) |
| `approved` | boolean | Yes | Approval status |
| `response` | string | No | Host response (max 5000 characters) |

### Example Request

```bash
curl -X POST "http://localhost:5000/api/reviews/bulk-approve" \
  -H "Content-Type: application/json" \
  -d '{"reviewIds": ["clx123abc", "clx456def"], "approved": true}'
```

### Response Format

```json
{
  "status": "success",
  "data": {
    "result": {
      "success": true,
      "updated": 2,
      "failed": 0,
      "errors": []
    },
    "meta": {
      "processedAt": "2024-01-15T14:30:00.000Z",
      "action": "approved"
    }
  },
  "message": "Successfully approved 2 reviews"
}
```

## GET /api/reviews/stats

**Description**: Get comprehensive review statistics with optional filtering.

**Method**: `GET`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `listingId` | integer | No | - | Filter statistics by listing ID |
| `from` | string (date) | No | - | Statistics from this date |
| `to` | string (date) | No | - | Statistics until this date |
| `channel` | string | No | - | Filter by review channel |
| `approved` | boolean | No | - | Filter by approval status |

### Example Request

```bash
curl "http://localhost:5000/api/reviews/stats?from=2024-01-01&to=2024-01-31"
```

### Response Format

```json
{
  "status": "success",
  "data": {
    "stats": {
      "totalReviews": 156,
      "approvedReviews": 120,
      "pendingReviews": 36,
      "rejectedReviews": 0,
      "averageRating": 8.7,
      "ratingDistribution": {
        "8": 45,
        "9": 62,
        "10": 49
      },
      "channelDistribution": {
        "AIRBNB": 89,
        "BOOKING_COM": 45,
        "VRBO": 22
      },
      "monthlyTrends": [
        {
          "month": "2024-01",
          "count": 23,
          "averageRating": 8.8
        }
      ]
    },
    "filters": {
      "from": "2024-01-01",
      "to": "2024-01-31"
    },
    "meta": {
      "processedAt": "2024-01-15T14:30:00.000Z"
    }
  }
}
```

# Listings API Endpoints

## GET /api/listings

**Description**: Retrieve property listings with optional review statistics.

**Method**: `GET`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `includeStats` | boolean | No | false | Include review statistics |
| `page` | integer | No | 1 | Page number for pagination |
| `limit` | integer | No | 20 | Number of listings per page (max 100) |
| `search` | string | No | - | Text search across name, slug, and ID |
| `name` | string | No | - | Filter by listing name |
| `slug` | string | No | - | Filter by listing slug |
| `sortBy` | string | No | `name` | Sort field (`name`, `createdAt`, `reviewCount`, `averageRating`) |
| `sortOrder` | string | No | `asc` | Sort direction (`asc`, `desc`) |

### Example Requests

```bash
# Get all listings
curl "http://localhost:5000/api/listings"

# Get listings with review statistics
curl "http://localhost:5000/api/listings?includeStats=true"

# Search listings
curl "http://localhost:5000/api/listings?search=apartment"

# Get listings sorted by average rating
curl "http://localhost:5000/api/listings?includeStats=true&sortBy=averageRating&sortOrder=desc"
```

### Response Format

```json
{
  "status": "success",
  "data": {
    "listings": [
      {
        "id": "cls456def",
        "hostawayListingId": "123",
        "name": "Downtown Apartment",
        "slug": "downtown-apartment",
        "createdAt": "2023-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "stats": {
          "totalReviews": 45,
          "approvedReviews": 42,
          "averageRating": 8.7,
          "ratingBreakdown": {
            "8": 12,
            "9": 20,
            "10": 13
          },
          "channelBreakdown": {
            "AIRBNB": 25,
            "BOOKING_COM": 20
          },
          "lastReviewDate": "2024-01-10T14:20:00.000Z"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "meta": {
      "processedAt": "2024-01-15T14:30:00.000Z",
      "totalListings": 3
    }
  },
  "message": "Successfully retrieved 3 listings"
}
```

## GET /api/listings/:id

**Description**: Get a specific listing by its ID.

**Method**: `GET`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Listing ID (CUID format) |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `includeStats` | boolean | No | false | Include review statistics |

### Example Request

```bash
curl "http://localhost:5000/api/listings/cls456def?includeStats=true"
```

## GET /api/listings/slug/:slug

**Description**: Get a listing by its slug.

**Method**: `GET`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | Yes | Listing slug |

### Example Request

```bash
curl "http://localhost:5000/api/listings/slug/downtown-apartment?includeStats=true"
```

## GET /api/listings/hostaway/:hostawayId

**Description**: Get a listing by its Hostaway ID.

**Method**: `GET`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hostawayId` | string | Yes | Hostaway listing ID (numeric) |

### Example Request

```bash
curl "http://localhost:5000/api/listings/hostaway/123?includeStats=true"
```

## GET /api/listings/search

**Description**: Search listings with text query.

**Method**: `GET`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query |
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Results per page |
| `includeStats` | boolean | No | false | Include review statistics |

### Example Request

```bash
curl "http://localhost:5000/api/listings/search?q=luxury%20apartment&includeStats=true"
```

## GET /api/listings/with-stats

**Description**: Get listings with comprehensive review statistics and filtering.

**Method**: `GET`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `minReviews` | integer | No | - | Minimum number of reviews |
| `minRating` | number | No | - | Minimum average rating |
| `maxRating` | number | No | - | Maximum average rating |
| `channels` | array | No | - | Filter by review channels |
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Results per page |

### Example Request

```bash
curl "http://localhost:5000/api/listings/with-stats?minReviews=10&minRating=8.5"
```

This comprehensive API documentation provides everything needed to integrate with the FlexApp Reviews API, including detailed endpoint descriptions, request/response formats, error handling, caching behavior, and practical integration examples.
