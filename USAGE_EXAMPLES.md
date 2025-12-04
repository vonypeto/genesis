# Using @llm/* Packages in Your Applications

## Example: Using packages in the Agent (NestJS) application

### 1. Import and use decorators

```typescript
// agent/src/app/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiResponse } from '@llm/decorators';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiResponse({ description: 'Get application data' })
  getData() {
    return this.appService.getData();
  }
}
```

### 2. Import and use modules

```typescript
// agent/src/app/app.module.ts
import { Module } from '@nestjs/common';
import { RedisModule } from '@llm/redis';
import { ConfigModule } from '@llm/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisModule.forRoot({
      host: 'localhost',
      port: 6379,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 3. Use filters and interceptors

```typescript
// agent/src/main.ts
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from '@llm/filters';
import { LoggingInterceptor } from '@llm/interceptors';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Apply global filters
  app.useGlobalFilters(new HttpExceptionFilter());
  
  // Apply global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());
  
  await app.listen(3000);
}
bootstrap();
```

### 4. Use utilities and types

```typescript
// agent/src/app/app.service.ts
import { Injectable } from '@nestjs/common';
import { formatDate } from '@llm/utils';
import { UserType } from '@llm/types';

@Injectable()
export class AppService {
  getData(): { message: string; timestamp: string } {
    return {
      message: 'Welcome to agent!',
      timestamp: formatDate(new Date()),
    };
  }
  
  processUser(user: UserType) {
    // Process user with type safety
    return user;
  }
}
```

## Example: Using packages in the Web (React) application

### 1. Import types

```typescript
// web/src/app/types.ts
import { UserType, ApiResponse } from '@llm/types';

export interface AppState {
  users: UserType[];
  loading: boolean;
}
```

### 2. Import utilities

```typescript
// web/src/app/utils.ts
import { formatDate, debounce } from '@llm/utils';

export const displayDate = (date: Date) => {
  return formatDate(date);
};

export const debouncedSearch = debounce((query: string) => {
  console.log('Searching for:', query);
}, 300);
```

## Benefits

- ✅ **Type-safe imports** across frontend and backend
- ✅ **Clean import paths** using `@llm/*` aliases
- ✅ **Code reusability** between applications
- ✅ **Single source of truth** for shared logic
- ✅ **Easy maintenance** with independent packages
