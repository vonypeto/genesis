# Account Module

This module implements an account management system following the Opexa repository pattern.

## Structure

```
account/
├── controllers/
│   └── account.controller.ts    # REST API endpoints
├── services/
│   └── account.service.ts       # Business logic layer
├── repositories/
│   └── account.repository.ts    # Data access layer using MongooseRepository
├── dto/
│   ├── create-account.dto.ts    # Create account validation
│   └── update-account.dto.ts    # Update account validation
├── account.module.ts            # NestJS module definition
└── index.ts                     # Public exports

```

## Architecture Pattern (Opexa Style)

### Repository Layer

The repository uses a factory pattern with the `MongooseRepository` class from `@llm/repository`:

```typescript
export type Account = {
  id: Buffer;
  email: string;
  username: string;
  // ...other fields
};

export type AccountRepository = Repository<Account>;

export function AccountRepositoryFactory(
  connection: Connection
): AccountRepository {
  return new MongooseRepository<Account>(
    connection,
    'Account',
    schemaDefinition,
    indexes
  );
}
```

### Service Layer

The service layer handles business logic and data operations:

```typescript
@Injectable()
export class AccountService {
  private readonly accountRepository: AccountRepository;

  constructor(@InjectConnection() private connection: Connection) {
    this.accountRepository = AccountRepositoryFactory(this.connection);
  }

  // Business logic methods...
}
```

### Controller Layer

REST API endpoints for account management.

## Features

### Account Types

- **AccountStatus**: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING`

### Available Operations

#### Create Account

```typescript
POST /accounts
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepass123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Get All Accounts (with pagination)

```typescript
GET /accounts?page=1&limit=10
```

#### Get Account by ID

```typescript
GET /accounts/:id
```

#### Get Account by Email

```typescript
GET /accounts/email/:email
```

#### Get Account by Username

```typescript
GET /accounts/username/:username
```

#### Search Accounts

```typescript
GET /accounts/search?q=john&page=1&limit=10
```

#### Get Active Accounts

```typescript
GET /accounts/active?page=1&limit=10
```

#### Get Account Statistics

```typescript
GET / accounts / stats;
```

#### Update Account

```typescript
PATCH /accounts/:id
{
  "firstName": "Jane",
  "phoneNumber": "+1234567890"
}
```

#### Activate Account

```typescript
PATCH /accounts/:id/activate
```

#### Deactivate Account

```typescript
PATCH /accounts/:id/deactivate
```

#### Suspend Account

```typescript
PATCH /accounts/:id/suspend
```

#### Delete Account

```typescript
DELETE /accounts/:id
```

## Service Methods

### Core Operations

- `create(createAccountDto)` - Create a new account (password is hashed automatically)
- `findAll(page, limit)` - Get paginated list of accounts
- `findById(id)` - Find account by ID
- `findByEmail(email)` - Find account by email
- `findByUsername(username)` - Find account by username
- `update(id, updateAccountDto)` - Update account details
- `remove(id)` - Delete account

### Status Management

- `activate(id)` - Activate an account
- `deactivate(id)` - Deactivate an account
- `suspend(id)` - Suspend an account

### Utility Methods

- `updateLastLogin(id)` - Update last login timestamp
- `countAll()` - Count total accounts
- `countByStatus(status)` - Count accounts by status
- `existsByEmail(email)` - Check if email exists
- `existsByUsername(username)` - Check if username exists
- `verifyPassword(plain, hashed)` - Verify password
- `search(term, page, limit)` - Search accounts

## Database Schema

### Fields

- `id` (Buffer) - Primary key
- `email` (String, required, unique) - User email
- `username` (String, required, unique) - Username
- `password` (String, required) - Hashed password
- `status` (String, enum) - Account status
- `firstName` (String, optional) - First name
- `lastName` (String, optional) - Last name
- `phoneNumber` (String, optional) - Phone number
- `lastLoginAt` (Date, optional) - Last login timestamp
- `isActive` (Boolean, default: true) - Active flag
- `metadata` (Mixed) - Additional metadata
- `createdAt` (Date) - Creation timestamp (auto)
- `updatedAt` (Date) - Update timestamp (auto)

### Indexes

- `email` (unique)
- `username` (unique)
- `status`
- `createdAt` (descending)

## Usage Example

```typescript
import { AccountService, AccountStatus } from './account';

@Injectable()
export class AuthService {
  constructor(private accountService: AccountService) {}

  async register(data: CreateAccountDto) {
    // Check if email exists
    const exists = await this.accountService.existsByEmail(data.email);
    if (exists) {
      throw new ConflictException('Email already exists');
    }

    // Create account
    return this.accountService.create(data);
  }

  async login(email: string, password: string) {
    const account = await this.accountService.findByEmail(email);
    if (!account) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.accountService.verifyPassword(
      password,
      account.password
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.accountService.updateLastLogin(account.id);

    return account;
  }
}
```

## Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/llm-visibility
```

## Dependencies

- `@llm/repository` - Custom repository package
- `mongoose` - MongoDB ODM
- `bcrypt` - Password hashing
- `class-validator` - DTO validation
- `class-transformer` - DTO transformation
- `@nestjs/mongoose` - NestJS MongoDB integration
