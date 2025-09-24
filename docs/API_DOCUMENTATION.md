# FlexLiving Reviews Dashboard - API Documentation

## Overview

The FlexLiving Reviews Dashboard API provides comprehensive endpoints for managing property reviews, listings, and analytics. This RESTful API supports review aggregation from multiple sources including Hostaway, Google Reviews, and manual entries.

**Base URL:** `https://api.flexliving.com/api` (Production)  
**Base URL:** `http://localhost:3001/api` (Development)

**API Version:** v1  
**Authentication:** JWT Bearer Tokens  
**Content-Type:** `application/json`

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Pagination](#pagination)
- [Rate Limiting](#rate-limiting)
- [Health Endpoints](#health-endpoints)
- [Listings API](#listings-api)
- [Reviews API](#reviews-api)
- [Hostaway Integration](#hostaway-integration)
- [Google Reviews Integration](#google-reviews-integration)
- [Review Approval](#review-approval)
- [Metrics & Analytics](#metrics--analytics)

## Authentication

### JWT Bearer Authentication

All protected endpoints require authentication via JWT bearer tokens in the `Authorization` header:

```http
Authorization: Bearer <your-jwt-token>
```

### Login Endpoint

```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@flexliving.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@flexliving.com",
    "name": "User Name",
    "role": "manager"
  },
  "expiresIn": "24h"
}
```

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details",
  "timestamp": "2024-01-15T10:00:00Z",
  "path": "/api/reviews",
  "requestId": "uuid"
}
```

### HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Internal Server Error |

### Common Error Codes

| Error Code | Description |
|------------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_REQUIRED` | Authentication token required |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `DUPLICATE_RESOURCE` | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `EXTERNAL_API_ERROR` | Third-party API error |

## Pagination

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (1-100) |
| `sort` | string | id | Sort field |
| `order` | string | desc | Sort order (asc/desc) |

### Pagination Response

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Rate Limiting

### Limits by Endpoint Type

| Endpoint Category | Rate Limit | Window |
|------------------|------------|--------|
| Authentication | 5 requests | 15 minutes |
| Read Operations | 100 requests | 15 minutes |
| Write Operations | 50 requests | 15 minutes |
| Import Operations | 10 requests | 60 minutes |
| External API Calls | 20 requests | 60 minutes |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Health Endpoints

### Application Health

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### Detailed Health Check

```http
GET /api/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": "15ms",
      "connections": {
        "active": 5,
        "idle": 15
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": "2ms",
      "memory": "45MB"
    },
    "hostaway": {
      "status": "healthy",
      "responseTime": "250ms",
      "lastSync": "2024-01-15T09:30:00Z"
    }
  }
}
```

## Listings API

### Get All Listings

```http
GET /api/listings
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name or address |
| `city` | string | Filter by city |
| `country` | string | Filter by country |
| `status` | string | Filter by status (active/inactive) |

**Response:**
```json
{
  "listings": [
    {
      "id": "uuid",
      "externalId": "hostaway-12345",
      "name": "Luxury Downtown Apartment",
      "address": "123 Main Street",
      "city": "New York",
      "country": "United States",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "status": "active",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z",
      "_count": {
        "reviews": 25
      }
    }
  ],
  "pagination": { /* pagination object */ }
}
```

### Get Single Listing

```http
GET /api/listings/{id}
```

**Response:**
```json
{
  "listing": {
    "id": "uuid",
    "externalId": "hostaway-12345",
    "name": "Luxury Downtown Apartment",
    "address": "123 Main Street",
    "city": "New York",
    "country": "United States",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "status": "active",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "reviews": [
      {
        "id": "uuid",
        "rating": 5,
        "comment": "Excellent property!",
        "guestName": "John Doe",
        "source": "airbnb",
        "status": "approved",
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ]
  }
}
```

### Import Listings from Hostaway

```http
POST /api/listings/hostaway/import
```

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "imported": 25,
  "updated": 5,
  "skipped": 2,
  "errors": []
}
```

## Reviews API

### Get All Reviews

```http
GET /api/reviews
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `source` | string | Filter by source (airbnb, booking, google, manual) |
| `status` | string | Filter by status (pending, approved, rejected) |
| `rating` | integer | Filter by rating (1-5) |
| `listingId` | uuid | Filter by listing ID |
| `startDate` | date | Filter from date (ISO 8601) |
| `endDate` | date | Filter to date (ISO 8601) |
| `search` | string | Search in comments |

**Response:**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "externalId": "airbnb-123456",
      "guestName": "John Doe",
      "rating": 5,
      "comment": "Amazing stay! The property was clean and well-maintained.",
      "source": "airbnb",
      "status": "approved",
      "listingId": "uuid",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z",
      "listing": {
        "id": "uuid",
        "name": "Luxury Downtown Apartment",
        "city": "New York"
      },
      "metadata": {
        "reservationId": "res-12345",
        "checkInDate": "2024-01-10",
        "checkOutDate": "2024-01-12"
      }
    }
  ],
  "pagination": { /* pagination object */ },
  "stats": {
    "total": 150,
    "pending": 10,
    "approved": 130,
    "rejected": 10,
    "averageRating": 4.3
  }
}
```

### Get Single Review

```http
GET /api/reviews/{id}
```

**Response:**
```json
{
  "review": {
    "id": "uuid",
    "externalId": "airbnb-123456",
    "guestName": "John Doe",
    "rating": 5,
    "comment": "Amazing stay! The property was clean and well-maintained.",
    "source": "airbnb",
    "status": "approved",
    "listingId": "uuid",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "listing": {
      "id": "uuid",
      "name": "Luxury Downtown Apartment",
      "city": "New York",
      "country": "United States"
    },
    "auditLog": [
      {
        "id": "uuid",
        "action": "approved",
        "performedBy": "manager@flexliving.com",
        "performedAt": "2024-01-15T10:00:00Z",
        "notes": "Approved after review"
      }
    ]
  }
}
```

### Create Manual Review

```http
POST /api/reviews
```

**Authentication:** Required

**Request Body:**
```json
{
  "guestName": "Jane Smith",
  "rating": 4,
  "comment": "Good stay overall. Minor issues with WiFi.",
  "source": "manual",
  "listingId": "uuid",
  "metadata": {
    "checkInDate": "2024-01-10",
    "checkOutDate": "2024-01-12",
    "notes": "Guest contacted directly"
  }
}
```

**Response:**
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "guestName": "Jane Smith",
    "rating": 4,
    "comment": "Good stay overall. Minor issues with WiFi.",
    "source": "manual",
    "status": "pending",
    "listingId": "uuid",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Update Review

```http
PUT /api/reviews/{id}
```

**Authentication:** Required

**Request Body:**
```json
{
  "comment": "Updated comment text",
  "rating": 5,
  "metadata": {
    "notes": "Updated after guest clarification"
  }
}
```

### Delete Review

```http
DELETE /api/reviews/{id}
```

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

## Hostaway Integration

### Import Reviews from Hostaway

```http
POST /api/reviews/hostaway
```

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `forceRefresh` | boolean | Skip cache and force fresh import |
| `listingId` | uuid | Import reviews for specific listing only |

**Response:**
```json
{
  "success": true,
  "processed": 45,
  "imported": 40,
  "updated": 3,
  "skipped": 2,
  "errors": [
    {
      "reviewId": "hostaway-12345",
      "error": "Invalid rating value",
      "details": "Rating must be between 1 and 5"
    }
  ],
  "processingTime": "2.5s"
}
```

### Get Hostaway Sync Status

```http
GET /api/reviews/hostaway/status
```

**Authentication:** Required

**Response:**
```json
{
  "lastSync": "2024-01-15T09:30:00Z",
  "status": "completed",
  "nextScheduledSync": "2024-01-15T12:00:00Z",
  "totalReviews": 1250,
  "pendingSync": 5,
  "errors": []
}
```

## Google Reviews Integration

### Search Google Places

```http
GET /api/reviews/google/places/search
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query (3-200 chars) |
| `lat` | float | No | Latitude (-90 to 90) |
| `lng` | float | No | Longitude (-180 to 180) |
| `radius` | integer | No | Search radius in meters (1-50000) |

**Response:**
```json
{
  "success": true,
  "places": [
    {
      "place_id": "ChIJ123456789",
      "name": "Downtown Hotel",
      "formatted_address": "123 Main St, New York, NY, USA",
      "geometry": {
        "location": {
          "lat": 40.7128,
          "lng": -74.0060
        }
      },
      "rating": 4.2,
      "user_ratings_total": 150,
      "business_status": "OPERATIONAL",
      "types": ["lodging", "point_of_interest"]
    }
  ],
  "count": 1,
  "cached": false
}
```

### Get Google Place Details

```http
GET /api/reviews/google/places/{placeId}
```

**Response:**
```json
{
  "success": true,
  "place": {
    "place_id": "ChIJ123456789",
    "name": "Downtown Hotel",
    "formatted_address": "123 Main St, New York, NY, USA",
    "rating": 4.2,
    "user_ratings_total": 150,
    "reviews": [
      {
        "author_name": "Google User",
        "rating": 5,
        "text": "Excellent hotel with great service!",
        "time": 1640995200,
        "relative_time_description": "2 weeks ago",
        "language": "en"
      }
    ],
    "website": "https://hotel.example.com",
    "formatted_phone_number": "+1 555-123-4567"
  },
  "reviewsCount": 5,
  "cached": false
}
```

### Import Google Places Reviews

```http
POST /api/reviews/google/import/places
```

**Authentication:** Required

**Request Body:**
```json
{
  "placeId": "ChIJ123456789",
  "listingId": "uuid",
  "autoApprove": false
}
```

**Response:**
```json
{
  "success": true,
  "place": {
    "id": "ChIJ123456789",
    "name": "Downtown Hotel",
    "address": "123 Main St, New York, NY, USA"
  },
  "imported": 5,
  "skipped": 0,
  "errors": []
}
```

### Google API Health Check

```http
GET /api/reviews/google/health
```

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "apis": {
    "placesApi": {
      "available": true
    },
    "businessProfileApi": {
      "available": false,
      "error": "Not configured"
    }
  },
  "usage": {
    "requestCount": 45,
    "lastRequestTime": 1640995200000,
    "rateLimitDelay": 1000,
    "placesApiEnabled": true,
    "businessProfileEnabled": false
  }
}
```

## Review Approval

### Approve Review

```http
POST /api/reviews/{id}/approve
```

**Authentication:** Required

**Request Body:**
```json
{
  "approvedBy": "manager@flexliving.com",
  "notes": "Review approved after verification"
}
```

**Response:**
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "status": "approved",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "auditLog": {
    "id": "uuid",
    "action": "approved",
    "performedBy": "manager@flexliving.com",
    "performedAt": "2024-01-15T10:00:00Z",
    "notes": "Review approved after verification"
  }
}
```

### Reject Review

```http
POST /api/reviews/{id}/reject
```

**Authentication:** Required

**Request Body:**
```json
{
  "rejectedBy": "manager@flexliving.com",
  "reason": "inappropriate_content",
  "notes": "Contains inappropriate language"
}
```

**Response:**
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "status": "rejected",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "auditLog": {
    "id": "uuid",
    "action": "rejected",
    "performedBy": "manager@flexliving.com",
    "performedAt": "2024-01-15T10:00:00Z",
    "reason": "inappropriate_content",
    "notes": "Contains inappropriate language"
  }
}
```

### Bulk Approve Reviews

```http
POST /api/reviews/bulk/approve
```

**Authentication:** Required

**Request Body:**
```json
{
  "reviewIds": ["uuid1", "uuid2", "uuid3"],
  "approvedBy": "manager@flexliving.com",
  "notes": "Bulk approval for verified reviews"
}
```

**Response:**
```json
{
  "success": true,
  "approved": 3,
  "failed": 0,
  "results": [
    {
      "reviewId": "uuid1",
      "status": "approved"
    },
    {
      "reviewId": "uuid2", 
      "status": "approved"
    },
    {
      "reviewId": "uuid3",
      "status": "approved"
    }
  ]
}
```

## Metrics & Analytics

### Review Analytics

```http
GET /api/reviews/analytics
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | Time period (7d, 30d, 90d, 1y) |
| `listingId` | uuid | Filter by listing |
| `source` | string | Filter by source |

**Response:**
```json
{
  "summary": {
    "totalReviews": 1250,
    "averageRating": 4.3,
    "ratingDistribution": {
      "1": 15,
      "2": 25,
      "3": 120,
      "4": 450,
      "5": 640
    },
    "sourceDistribution": {
      "airbnb": 600,
      "booking": 450,
      "google": 150,
      "manual": 50
    },
    "statusDistribution": {
      "approved": 1100,
      "pending": 100,
      "rejected": 50
    }
  },
  "trends": {
    "reviewsOverTime": [
      {
        "date": "2024-01-01",
        "count": 45,
        "averageRating": 4.2
      }
    ],
    "ratingTrend": "increasing",
    "volumeTrend": "stable"
  }
}
```

### Listing Performance

```http
GET /api/listings/{id}/analytics
```

**Response:**
```json
{
  "listing": {
    "id": "uuid",
    "name": "Luxury Downtown Apartment"
  },
  "metrics": {
    "totalReviews": 25,
    "averageRating": 4.6,
    "responseRate": 0.95,
    "sentimentScore": 0.8,
    "recentReviews": 8,
    "ratingImprovement": 0.3
  },
  "comparisons": {
    "cityAverage": 4.2,
    "portfolioAverage": 4.3,
    "performanceRank": 3
  }
}
```

### System Metrics

```http
GET /api/metrics
```

**Authentication:** Required

**Response:**
```json
{
  "system": {
    "uptime": "15d 4h 32m",
    "version": "1.0.0",
    "environment": "production",
    "lastDeploy": "2024-01-10T14:30:00Z"
  },
  "api": {
    "requestsPerMinute": 45,
    "averageResponseTime": "150ms",
    "errorRate": 0.02,
    "cacheHitRate": 0.85
  },
  "integrations": {
    "hostaway": {
      "status": "healthy",
      "lastSync": "2024-01-15T09:30:00Z",
      "successRate": 0.98
    },
    "google": {
      "status": "healthy",
      "quotaUsed": 0.45,
      "requestsToday": 150
    }
  }
}
```

## Webhooks

### Review Status Changed

```json
{
  "event": "review.status_changed",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "reviewId": "uuid",
    "previousStatus": "pending",
    "newStatus": "approved",
    "performedBy": "manager@flexliving.com"
  }
}
```

### New Review Imported

```json
{
  "event": "review.imported",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "reviewId": "uuid",
    "source": "airbnb",
    "listingId": "uuid",
    "rating": 5
  }
}
```

## SDKs and Examples

### cURL Examples

#### Get Reviews
```bash
curl -X GET "https://api.flexliving.com/api/reviews?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

#### Import Hostaway Reviews
```bash
curl -X POST "https://api.flexliving.com/api/reviews/hostaway" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

#### Approve Review
```bash
curl -X POST "https://api.flexliving.com/api/reviews/UUID/approve" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approvedBy": "manager@flexliving.com", "notes": "Approved"}'
```

### JavaScript/Node.js Example

```javascript
const FlexLivingAPI = require('@flexliving/api-client');

const api = new FlexLivingAPI({
  baseURL: 'https://api.flexliving.com/api',
  apiKey: 'your-api-key'
});

// Get reviews
const reviews = await api.reviews.list({
  page: 1,
  limit: 20,
  source: 'airbnb',
  status: 'pending'
});

// Approve review
await api.reviews.approve('review-uuid', {
  approvedBy: 'manager@flexliving.com',
  notes: 'Looks good!'
});
```

### Python Example

```python
import requests

class FlexLivingAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_reviews(self, **params):
        response = requests.get(
            f'{self.base_url}/reviews',
            headers=self.headers,
            params=params
        )
        return response.json()
    
    def approve_review(self, review_id, approved_by, notes):
        data = {
            'approvedBy': approved_by,
            'notes': notes
        }
        response = requests.post(
            f'{self.base_url}/reviews/{review_id}/approve',
            headers=self.headers,
            json=data
        )
        return response.json()

# Usage
api = FlexLivingAPI('https://api.flexliving.com/api', 'your-token')
reviews = api.get_reviews(status='pending', limit=10)
```

## Support

### Getting Help

- **Documentation:** [https://docs.flexliving.com](https://docs.flexliving.com)
- **API Status:** [https://status.flexliving.com](https://status.flexliving.com)
- **Support Email:** [api-support@flexliving.com](mailto:api-support@flexliving.com)

### Report Issues

Please include the following information when reporting API issues:

- Request ID (from response headers)
- Endpoint URL and HTTP method
- Request payload (excluding sensitive data)
- Response body and status code
- Timestamp of the request

### Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history and breaking changes.
