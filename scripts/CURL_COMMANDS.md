# API Curl Commands

Base URL: `http://localhost:3000/api`

## 1. App Controller (Root)

### Get Application Data

```bash
curl -X GET http://localhost:3000/api/
```

---

## 2. Account Controller (`/accounts`)

### Create Account

```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -H "request-id: 1231231" \
  -d '{
    "email": "user@example.com",
    "username": "johndoe",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890"
  }'
```

### Get All Accounts (with pagination)

```bash
# Default pagination (page=1, limit=10)
curl -X GET http://localhost:3000/api/accounts

# With custom pagination
curl -X GET "http://localhost:3000/api/accounts?page=2&limit=20"
```

---

## 3. Postgres Account Controller (`/postgres-accounts`)

### Create Postgres Account

```bash
curl -X POST http://localhost:3000/api/postgres-accounts \
  -H "Content-Type: application/json" \
  -H "request-id: 1231231" \
  -d '{
    "email": "pguser@example.com",
    "username": "janedoe",
    "password": "SecurePass456!",
    "firstName": "Jane",
    "lastName": "Doe",
    "phoneNumber": "+9876543210"
  }'
```

### Get All Postgres Accounts (with pagination)

```bash
# Default pagination (page=1, limit=10)
curl -X GET http://localhost:3000/api/postgres-accounts

# With custom pagination
curl -X GET "http://localhost:3000/api/postgres-accounts?page=1&limit=5"
```

---

## 4. Agent Controller (LLM Runs)

### Create Run

**Available Models:**

- **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo`
- **Anthropic**: `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`

```bash
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -H "request-id: 1231231" \
  -d '{
    "prompts": ["What is AI?", "Explain machine learning"],
    "brands": ["OpenAI", "Anthropic", "Google"],
    "models": [
      { "model": "gpt-4o", "provider": "openai" },
      { "model": "gpt-4o-mini", "provider": "openai" },
      { "model": "claude-3-5-sonnet-20241022", "provider": "anthropic" }
    ],
    "notes": "Testing run with multiple models",
    "config": {
      "concurrencyLimit": 3,
      "retryAttempts": 2,
      "timeout": 30000,
      "rateLimitPerSecond": 10,
      "enableCircuitBreaker": true
    }
  }'
```

**Minimal Example:**

```bash
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -H "request-id: 1231231" \
  -d '{
    "prompts": ["What is AI?"],
    "brands": ["OpenAI"],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" }
    ]
  }'
```

### List All Runs (with pagination)

```bash
# Default pagination (page=1, limit=10)
curl -X GET http://localhost:3000/api/runs

# With custom pagination
curl -X GET "http://localhost:3000/api/runs?page=1&limit=20"
```

### Get Run by ID

```bash
# Note: This endpoint returns "Not implemented" currently
curl -X GET http://localhost:3000/api/runs/65f1a2b3c4d5e6f7g8h9i0j1
```

### Get Run Summary

```bash
curl -X GET http://localhost:3000/api/runs/65f1a2b3c4d5e6f7g8h9i0j1/summary
```

### Get Run Chat View

```bash
# Note: This endpoint returns "Not implemented" currently
curl -X GET http://localhost:3000/api/runs/65f1a2b3c4d5e6f7g8h9i0j1/chat
```

### Health Check

```bash
curl -X GET http://localhost:3000/api/gethealth
```

---

## Sample Response Formats

### Account Creation Success

```json
true
```

### Postgres Account Creation Success

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "pguser@example.com",
  "username": "janedoe",
  "firstName": "Jane",
  "lastName": "Doe",
  "phoneNumber": "+9876543210",
  "status": "active",
  "isActive": true,
  "metadata": {},
  "createdAt": "2025-12-08T17:00:00.000Z",
  "updatedAt": "2025-12-08T17:00:00.000Z"
}
```

### Run Creation Success

```json
{
  "run": {
    "id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "status": "processing",
    "prompts": ["What is AI?", "Explain machine learning"],
    "brands": ["OpenAI", "Anthropic"],
    "models": ["gpt-4", "claude-3"],
    "createdAt": "2025-12-08T17:00:00.000Z"
  },
  "message": "Run created successfully. Processing has started in the background.",
  "isNew": true
}
```

### Health Check Response

```json
{
  "status": "ok",
  "redis": {
    "connected": true,
    "uptime": 3600
  },
  "rateLimiting": {
    "distributedEnabled": true,
    "localLimiters": {},
    "distributedLimiters": {}
  },
  "timestamp": "2025-12-08T17:00:00.000Z"
}
```

---

## Testing Tips

1. **Using jq for pretty JSON output:**

   ```bash
   curl -X GET http://localhost:3000/api/gethealth | jq
   ```

2. **Save response to file:**

   ```bash
   curl -X GET http://localhost:3000/api/runs > runs.json
   ```

3. **Include response headers:**

   ```bash
   curl -i -X GET http://localhost:3000/api/
   ```

4. **Verbose output for debugging:**

   ```bash
   curl -v -X POST http://localhost:3000/api/accounts -H "Content-Type: application/json" -d '{"email":"test@test.com"}'
   ```

5. **Set timeout:**
   ```bash
   curl --max-time 30 -X GET http://localhost:3000/api/runs
   ```
