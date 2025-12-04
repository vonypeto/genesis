# LLM Visibility Mono

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

A monorepo containing a React frontend (**web**) and NestJS backend (**agent**), built with Nx.

## Project Structure

```
llm-visibility-mono/
├── web/                 # React frontend application (port 3001)
├── agent/               # NestJS backend application (port 3000)
└── packages/            # Shared libraries
    ├── @llm/circuit-breaker
    ├── @llm/config
    ├── @llm/decorators
    ├── @llm/filters
    ├── @llm/interceptors
    ├── @llm/rate-limiter
    ├── @llm/redis
    ├── @llm/repository
    ├── @llm/shared
    ├── @llm/types
    └── @llm/utils
```

## Shared Packages

The monorepo includes the following shared packages that can be imported using `@llm/*` aliases:

- **@llm/circuit-breaker** - Circuit breaker pattern implementation
- **@llm/config** - NestJS configuration module
- **@llm/decorators** - Custom decorators (API response, timing, cache)
- **@llm/filters** - Exception filters
- **@llm/interceptors** - Request/response interceptors
- **@llm/rate-limiter** - Rate limiting functionality
- **@llm/redis** - Redis integration module
- **@llm/repository** - Repository pattern implementation
- **@llm/shared** - Shared utilities and constants
- **@llm/types** - TypeScript type definitions
- **@llm/utils** - Utility functions

### Using Shared Packages

Import from packages using the path aliases:

```typescript
// In agent or web applications
import { SomeDecorator } from '@llm/decorators';
import { RedisModule } from '@llm/redis';
import { CircuitBreaker } from '@llm/circuit-breaker';
```

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v10 or higher)

## Getting Started

### 1. Install Dependencies

```sh
pnpm install
```

### 2. Run Applications

#### Run the React frontend (web)

```sh
pnpm nx serve web
```

The frontend will be available at **http://localhost:3001**

#### Run the NestJS backend (agent)

```sh
pnpm nx serve agent
```

The backend will be available at **http://localhost:3000**

#### Run both applications concurrently

```sh
pnpm nx run-many -t serve -p web agent
```

### 3. Build Applications

#### Build the frontend

```sh
pnpm nx build web
```

#### Build the backend

```sh
pnpm nx build agent
```

#### Build all applications

```sh
pnpm nx run-many -t build
```

### 4. Testing

#### Run tests for the backend

```sh
pnpm nx test agent
```

### 5. Linting

#### Lint the frontend

```sh
pnpm nx lint web
```

#### Lint the backend

```sh
pnpm nx lint agent
```

#### Lint all projects

```sh
pnpm nx run-many -t lint
```

## Common Nx Commands

### View project details

```sh
pnpm nx show project web
pnpm nx show project agent
```

### Generate a new library

```sh
pnpm nx g @nx/js:lib my-lib
```

### View the project graph

```sh
pnpm nx graph
```

### Run any task with Nx

```sh
pnpm nx <target> <project-name>
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Versioning and releasing

To version and release the library use

```
npx nx release
```

Pass `--dry-run` to see what would happen without actually releasing the library.

[Learn more about Nx release &raquo;](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Keep TypeScript project references up to date

Nx automatically updates TypeScript [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) in `tsconfig.json` files to ensure they remain accurate based on your project dependencies (`import` or `require` statements). This sync is automatically done when running tasks such as `build` or `typecheck`, which require updated references to function correctly.

To manually trigger the process to sync the project graph dependencies information to the TypeScript project references, run the following command:

```sh
npx nx sync
```

You can enforce that the TypeScript project references are always in the correct state when running in CI by adding a step to your CI job configuration that runs the following command:

```sh
npx nx sync:check
```

[Learn more about nx sync](https://nx.dev/reference/nx-commands#sync)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/js?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
