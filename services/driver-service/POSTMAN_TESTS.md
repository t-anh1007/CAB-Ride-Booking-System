# Driver Service - API Test Examples

## Base URL
```
http://localhost:3107/api/v1/drivers
```

## Common Headers
All requests should include:
```
Content-Type: application/json
x-request-id: <uuid>
x-correlation-id: <uuid>
```

---

## 1. PATCH /api/v1/drivers/:driverId - Create/Update Driver

### Request
```
PATCH http://localhost:3107/api/v1/drivers/uuid-driver-001
Content-Type: application/json
x-request-id: 12345678-1234-1234-1234-123456789001
x-correlation-id: 87654321-4321-4321-4321-987654321001

{
  "fullName": "Tran Van B",
  "phone": "0912345678",
  "vehicleType": "bike",
  "vehiclePlate": "59A1-12345",
  "status": "OFFLINE",
  "availability": "BUSY"
}
```

### Response - Success (201/200)
```json
{
  "success": true,
  "message": "Driver created",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "driverId": "uuid-driver-001",
    "fullName": "Tran Van B",
    "phone": "0912345678",
    "vehicleType": "bike",
    "vehiclePlate": "59A1-12345",
    "status": "OFFLINE",
    "availability": "BUSY",
    "location": {
      "lat": null,
      "lng": null,
      "address": null
    },
    "updatedAt": "2026-04-08T16:30:00.000Z",
    "createdAt": "2026-04-08T16:30:00.000Z"
  },
  "meta": {
    "requestId": "12345678-1234-1234-1234-123456789001",
    "correlationId": "87654321-4321-4321-4321-987654321001",
    "timestamp": "2026-04-08T16:30:00.000Z"
  }
}
```

### Response - Bad Request (400)
```json
{
  "success": false,
  "message": "status must be one of ONLINE, OFFLINE",
  "data": {},
  "meta": {
    "requestId": "12345678-1234-1234-1234-123456789001",
    "correlationId": "87654321-4321-4321-4321-987654321001",
    "timestamp": "2026-04-08T16:30:00.000Z"
  }
}
```

---

## 2. GET /api/v1/drivers/:driverId - Get Driver by ID

### Request
```
GET http://localhost:3107/api/v1/drivers/uuid-driver-001
Content-Type: application/json
x-request-id: 12345678-1234-1234-1234-123456789002
x-correlation-id: 87654321-4321-4321-4321-987654321002
```

### Response - Success (200)
```json
{
  "success": true,
  "message": "Driver fetched",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "driverId": "uuid-driver-001",
    "fullName": "Tran Van B",
    "phone": "0912345678",
    "vehicleType": "bike",
    "vehiclePlate": "59A1-12345",
    "status": "OFFLINE",
    "availability": "BUSY",
    "location": {
      "lat": 10.762622,
      "lng": 106.660172,
      "address": "Quận 1, TP.HCM"
    },
    "updatedAt": "2026-04-08T16:30:00.000Z",
    "createdAt": "2026-04-08T16:30:00.000Z"
  },
  "meta": {
    "requestId": "12345678-1234-1234-1234-123456789002",
    "correlationId": "87654321-4321-4321-4321-987654321002",
    "timestamp": "2026-04-08T16:30:00.000Z"
  }
}
```

### Response - Not Found (404)
```json
{
  "success": false,
  "message": "Driver not found",
  "data": {},
  "meta": {
    "requestId": "12345678-1234-1234-1234-123456789002",
    "correlationId": "87654321-4321-4321-4321-987654321002",
    "timestamp": "2026-04-08T16:30:00.000Z"
  }
}
```

---

## 3. POST /api/v1/drivers/:driverId/go-online - Set Driver Online

### Request
```
POST http://localhost:3107/api/v1/drivers/uuid-driver-001/go-online
Content-Type: application/json
x-request-id: 12345678-1234-1234-1234-123456789003
x-correlation-id: 87654321-4321-4321-4321-987654321003

{}
```

### Response - Success (200)
```json
{
  "success": true,
  "message": "Driver is now ONLINE",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "driverId": "uuid-driver-001",
    "fullName": "Tran Van B",
    "phone": "0912345678",
    "vehicleType": "bike",
    "vehiclePlate": "59A1-12345",
    "status": "ONLINE",
    "availability": "AVAILABLE",
    "location": {
      "lat": 10.762622,
      "lng": 106.660172,
      "address": "Quận 1, TP.HCM"
    },
    "updatedAt": "2026-04-08T16:31:00.000Z",
    "createdAt": "2026-04-08T16:30:00.000Z"
  },
  "meta": {
    "requestId": "12345678-1234-1234-1234-123456789003",
    "correlationId": "87654321-4321-4321-4321-987654321003",
    "timestamp": "2026-04-08T16:31:00.000Z"
  }
}
```

---

## 4. POST /api/v1/drivers/:driverId/go-offline - Set Driver Offline

### Request
```
POST http://localhost:3107/api/v1/drivers/uuid-driver-001/go-offline
Content-Type: application/json
x-request-id: 12345678-1234-1234-1234-123456789004
x-correlation-id: 87654321-4321-4321-4321-987654321004

{}
```

### Response - Success (200)
```json
{
  "success": true,
  "message": "Driver is now OFFLINE",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "driverId": "uuid-driver-001",
    "fullName": "Tran Van B",
    "phone": "0912345678",
    "vehicleType": "bike",
    "vehiclePlate": "59A1-12345",
    "status": "OFFLINE",
    "availability": "AVAILABLE",
    "location": {
      "lat": 10.762622,
      "lng": 106.660172,
      "address": "Quận 1, TP.HCM"
    },
    "updatedAt": "2026-04-08T16:32:00.000Z",
    "createdAt": "2026-04-08T16:30:00.000Z"
  },
  "meta": {
    "requestId": "12345678-1234-1234-1234-123456789004",
    "correlationId": "87654321-4321-4321-4321-987654321004",
    "timestamp": "2026-04-08T16:32:00.000Z"
  }
}
```

---

## 5. GET /api/v1/drivers/available - List Available Drivers

### Request
```
GET http://localhost:3107/api/v1/drivers/available
Content-Type: application/json
x-request-id: 12345678-1234-1234-1234-123456789005
x-correlation-id: 87654321-4321-4321-4321-987654321005
```

### Response - Success (200)
```json
{
  "success": true,
  "message": "Available drivers fetched",
  "data": {
    "drivers": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "driverId": "uuid-driver-001",
        "fullName": "Tran Van B",
        "phone": "0912345678",
        "vehicleType": "bike",
        "vehiclePlate": "59A1-12345",
        "status": "ONLINE",
        "availability": "AVAILABLE",
        "location": {
          "lat": 10.762622,
          "lng": 106.660172,
          "address": "Quận 1, TP.HCM"
        },
        "updatedAt": "2026-04-08T16:31:00.000Z",
        "createdAt": "2026-04-08T16:30:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439012",
        "driverId": "uuid-driver-002",
        "fullName": "Nguyen Thi C",
        "phone": "0987654321",
        "vehicleType": "car",
        "vehiclePlate": "59B2-54321",
        "status": "ONLINE",
        "availability": "AVAILABLE",
        "location": {
          "lat": 10.750000,
          "lng": 106.650000,
          "address": "Quận 3, TP.HCM"
        },
        "updatedAt": "2026-04-08T16:31:00.000Z",
        "createdAt": "2026-04-08T16:30:00.000Z"
      }
    ]
  },
  "meta": {
    "requestId": "12345678-1234-1234-1234-123456789005",
    "correlationId": "87654321-4321-4321-4321-987654321005",
    "timestamp": "2026-04-08T16:31:00.000Z"
  }
}
```

---

## 6. PATCH /api/v1/drivers/:driverId/location - Update Driver Location

### Request
```
PATCH http://localhost:3107/api/v1/drivers/uuid-driver-001/location
Content-Type: application/json
x-request-id: 12345678-1234-1234-1234-123456789006
x-correlation-id: 87654321-4321-4321-4321-987654321006

{
  "lat": 10.765000,
  "lng": 106.675000,
  "address": "Phở Bến Thành, Quận 1, TP.HCM"
}
```

### Response - Success (200)
```json
{
  "success": true,
  "message": "Driver location updated",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "driverId": "uuid-driver-001",
    "fullName": "Tran Van B",
    "phone": "0912345678",
    "vehicleType": "bike",
    "vehiclePlate": "59A1-12345",
    "status": "ONLINE",
    "availability": "AVAILABLE",
    "location": {
      "lat": 10.765000,
      "lng": 106.675000,
      "address": "Phố Bến Thành, Quận 1, TP.HCM"
    },
    "updatedAt": "2026-04-08T16:35:00.000Z",
    "createdAt": "2026-04-08T16:30:00.000Z"
  },
  "meta": {
    "requestId": "12345678-1234-1234-1234-123456789006",
    "correlationId": "87654321-4321-4321-4321-987654321006",
    "timestamp": "2026-04-08T16:35:00.000Z"
  }
}
```

### Response - Bad Request (400)
```json
{
  "success": false,
  "message": "lat must be between -90 and 90",
  "data": {},
  "meta": {
    "requestId": "12345678-1234-1234-1234-123456789006",
    "correlationId": "87654321-4321-4321-4321-987654321006",
    "timestamp": "2026-04-08T16:35:00.000Z"
  }
}
```

---

## cURL Examples

### Create/Update Driver
```bash
curl -X PATCH http://localhost:3107/api/v1/drivers/uuid-driver-001 \
  -H "Content-Type: application/json" \
  -H "x-request-id: abc123" \
  -H "x-correlation-id: def456" \
  -d '{
    "fullName": "Tran Van B",
    "phone": "0912345678",
    "vehicleType": "bike",
    "vehiclePlate": "59A1-12345"
  }'
```

### Get Driver
```bash
curl -X GET http://localhost:3107/api/v1/drivers/uuid-driver-001 \
  -H "Content-Type: application/json"
```

### Go Online
```bash
curl -X POST http://localhost:3107/api/v1/drivers/uuid-driver-001/go-online \
  -H "Content-Type: application/json"
```

### Go Offline
```bash
curl -X POST http://localhost:3107/api/v1/drivers/uuid-driver-001/go-offline \
  -H "Content-Type: application/json"
```

### List Available Drivers
```bash
curl -X GET http://localhost:3107/api/v1/drivers/available \
  -H "Content-Type: application/json"
```

### Update Location
```bash
curl -X PATCH http://localhost:3107/api/v1/drivers/uuid-driver-001/location \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 10.765000,
    "lng": 106.675000,
    "address": "Phố Bến Thành, Quận 1, TP.HCM"
  }'
```

---

## Postman Collection JSON

Import này vào Postman để test toàn bộ APIs:

```json
{
  "info": {
    "name": "Driver Service - CAB Booking",
    "description": "API tests for Driver Microservice",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create/Update Driver",
      "request": {
        "method": "PATCH",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "x-request-id",
            "value": "{{$randomUUID}}"
          },
          {
            "key": "x-correlation-id",
            "value": "{{$randomUUID}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"fullName\":\"Tran Van B\",\"phone\":\"0912345678\",\"vehicleType\":\"bike\",\"vehiclePlate\":\"59A1-12345\",\"status\":\"OFFLINE\",\"availability\":\"BUSY\"}"
        },
        "url": {
          "raw": "http://localhost:3107/api/v1/drivers/uuid-driver-001",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3107",
          "path": ["api", "v1", "drivers", "uuid-driver-001"]
        }
      }
    },
    {
      "name": "Get Driver",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "http://localhost:3107/api/v1/drivers/uuid-driver-001",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3107",
          "path": ["api", "v1", "drivers", "uuid-driver-001"]
        }
      }
    },
    {
      "name": "Go Online",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{}"
        },
        "url": {
          "raw": "http://localhost:3107/api/v1/drivers/uuid-driver-001/go-online",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3107",
          "path": ["api", "v1", "drivers", "uuid-driver-001", "go-online"]
        }
      }
    },
    {
      "name": "Go Offline",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{}"
        },
        "url": {
          "raw": "http://localhost:3107/api/v1/drivers/uuid-driver-001/go-offline",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3107",
          "path": ["api", "v1", "drivers", "uuid-driver-001", "go-offline"]
        }
      }
    },
    {
      "name": "List Available Drivers",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "http://localhost:3107/api/v1/drivers/available",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3107",
          "path": ["api", "v1", "drivers", "available"]
        }
      }
    },
    {
      "name": "Update Location",
      "request": {
        "method": "PATCH",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"lat\":10.765000,\"lng\":106.675000,\"address\":\"Phố Bến Thành, Quận 1, TP.HCM\"}"
        },
        "url": {
          "raw": "http://localhost:3107/api/v1/drivers/uuid-driver-001/location",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3107",
          "path": ["api", "v1", "drivers", "uuid-driver-001", "location"]
        }
      }
    }
  ]
}
```
