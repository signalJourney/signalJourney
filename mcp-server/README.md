# SignalJourney MCP Server

This server implements the Model Context Protocol (MCP) to provide tools for analyzing biosignal processing pipelines and generating SignalJourney documentation.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Configuration](#environment-configuration)
- [Running the Server](#running-the-server)
  - [Development Mode](#development-mode)
  - [Production Mode](#production-mode)
  - [Stdio Transport](#stdio-transport)
- [Running Tests](#running-tests)
- [Available MCP Tools](#available-mcp-tools)
  - [System Tools](#system-tools)
  - [Authentication Tools (via HTTP Endpoints)](#authentication-tools-via-http-endpoints)
  - [Resource Management Tools](#resource-management-tools)
- [Transports](#transports)
- [Project Structure](#project-structure)
- [Future Work & TODOs](#future-work--todos)

## Overview

The SignalJourney MCP Server provides a backend for analyzing code repositories (e.g., MATLAB/Python biosignal processing pipelines), extracting metadata, processing steps, parameters, and data flow information. This data is then used to generate SignalJourney compliant documentation.

It utilizes the `@modelcontextprotocol/sdk` and exposes functionality through MCP tools accessible via various transports.

## Prerequisites

- Node.js (v18+ recommended, as per `package.json` engines)
- npm (usually comes with Node.js)

## Setup

1.  **Clone the repository (if not already done):**
    ```bash
    git clone <repository-url>
    cd signalJourney/mcp-server
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Environment Configuration

The server uses a `.env` file in the `mcp-server` root directory for configuration. Copy the example file and customize it:

```bash
cp .env.example .env
```

Key environment variables (see `.env.example` for a full list and defaults):

-   `PORT`: Port for the HTTP server (default: `3000`).
-   `NODE_ENV`: Environment mode (`development`, `test`, `production`).
-   `MCP_SERVER_NAME`: Name of the MCP server.
-   `MCP_SERVER_VERSION`: Version of the MCP server.
-   `LOG_LEVEL`: Logging verbosity (`info`, `debug`, `warn`, `error`).
-   `LOG_DIR`: Directory to store log files.
-   `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS.
-   `JWT_SECRET`: A strong, random secret key for signing JWTs (critical for production).
-   `JWT_EXPIRES_IN`: JWT expiration time (e.g., `1h`, `15m`).
-   `RATE_LIMIT_WINDOW_MS`: Window for rate limiting in milliseconds.
-   `RATE_LIMIT_MAX`: Max requests per window per IP for rate limiting.

## Running the Server

### Development Mode

For development with hot-reloading (uses `nodemon` and `ts-node`):

```bash
npm run dev
```

The server will typically start on `http://localhost:3000` (or the port specified in `.env`).

### Production Mode

For production, first build the TypeScript source:

```bash
npm run build
```

Then start the server:

```bash
npm start 
# or directly: NODE_ENV=production node dist/index.js
```

### Stdio Transport

To run the server with the Stdio transport enabled (in addition to HTTP if configured):
Ensure `ENABLE_STDIO_TRANSPORT=true` in your `.env` file or pass the `--stdio` flag when running (the latter is not explicitly handled by npm scripts by default but can be added).

If `ENABLE_STDIO_TRANSPORT` is true in `.env`:
```bash
npm run dev
# or
npm start
```

## Running Tests

-   Run all tests (unit and integration - current integration tests for auth are blocked):
    ```bash
    npm test
    ```
-   Run tests in watch mode:
    ```bash
    npm run test:watch
    ```
-   Run tests with coverage report:
    ```bash
    npm run test:cov
    ```

**Note:** Integration tests requiring the `@modelcontextprotocol/sdk` are currently blocked due to a Jest module resolution issue. Unit tests for services are passing.

## Available MCP Tools

The server exposes the following tools. They can be called using an MCP client via the configured transports (e.g., HTTP POST to `/mcp`).

*(This section will be populated with details of each tool, its parameters, and example calls. Parameter details can be derived from the Zod schemas in the `*.handlers.ts` files.)*

### System Tools

-   **`system.getServerStatus`**
    -   Description: Get the current status of the MCP server.
    -   Parameters: None (empty object `{}`)
    -   Handler: `handleGetServerStatus`
    -   Example MCP Request (HTTP):
        ```json
        POST /mcp
        Content-Type: application/json

        {
          "command": "system.getServerStatus",
          "args": {},
          "metadata": { "requestId": "client-req-123" }
        }
        ```

-   **`system.getServerVersion`**
    -   Description: Get the version of the MCP server.
    -   Parameters: None (empty object `{}`)
    -   Handler: `handleGetServerVersion`

### Authentication Tools (via HTTP Endpoints)

While not strictly MCP tools, these HTTP endpoints provide authentication functionality crucial for securing MCP tool access.

-   **`POST /auth/login`**
    -   Description: Authenticate a user and receive a JWT.
    -   Request Body Schema (`LoginSchema`):
        -   `username` (string, required)
        -   `password` (string, required)
    -   Response: JWT `accessToken`, `tokenType`, `expiresIn`, `userId`, `username`, `scopes`.

-   **`POST /auth/validate-token`**
    -   Description: Validate an existing JWT.
    -   Request Body Schema (`ValidateTokenSchema`):
        -   `token` (string, required)
    -   Response: `{ valid: boolean, payload?: AuthPayload }` on success, error on failure.

-   **`POST /auth/logout`**
    -   Description: Logout a user by blacklisting their current token.
    -   Requires: `Authorization: Bearer <token>` header.
    -   Response: Success message or error.

### Resource Management Tools

These tools require authentication and specific scopes (defined in `server.ts`).

-   **`resource.create`**
    -   Description: Create a new resource.
    -   Handler: `handleCreateResource`
    -   Required Scope: `write:resource`
    -   Parameters (`CreateResourceParamsSchema`):
        -   `type` (string, required): Type of resource (e.g., 'document', 'pipeline_config').
        -   `content` (any, required): The resource content.
        -   `metadata` (object, optional): Key-value metadata.

-   **`resource.get`**
    -   Description: Get a resource by its ID.
    -   Handler: `handleGetResource`
    -   Required Scope: `read:resource`
    -   Parameters (`GetResourceParamsSchema`):
        -   `id` (string, UUID, required): The ID of the resource.

-   **`resource.update`**
    -   Description: Update an existing resource.
    -   Handler: `handleUpdateResource`
    -   Required Scope: `write:resource`
    -   Parameters (`UpdateResourceParamsSchema`):
        -   `id` (string, UUID, required): The ID of the resource to update.
        -   `type` (string, optional): New type for the resource.
        -   `content` (any, optional): New content for the resource.
        -   `metadata` (object, optional): New metadata (will be merged or replaced based on service logic - currently replaces).

-   **`resource.delete`**
    -   Description: Delete a resource by its ID.
    -   Handler: `handleDeleteResource`
    -   Required Scope: `write:resource` (or a more specific `delete:resource`)
    -   Parameters (`DeleteResourceParamsSchema`):
        -   `id` (string, UUID, required): The ID of the resource to delete.

-   **`resource.list`**
    -   Description: List resources, optionally filtered by type (owned by the authenticated user).
    -   Handler: `handleListResources`
    -   Required Scope: `read:resource`
    -   Parameters (`ListResourcesParamsSchema`):
        -   `type` (string, optional): Filter resources by this type.

## Transports

Currently supported transports:

-   **StreamableHTTP**: Accessible via HTTP POST requests to the `/mcp` endpoint.
-   **Stdio**: Can be enabled for communication over standard input/output, typically for direct integration with other processes.

## Project Structure

```
mcp-server/
├── coverage/       # Test coverage reports
├── dist/           # Compiled JavaScript output
├── logs/           # Log files
├── node_modules/   # Dependencies
├── src/
│   ├── config/       # Environment configuration (index.ts, .env handling)
│   ├── core/         # Core MCP server logic (server.ts, mcp-types.ts)
│   ├── handlers/     # MCP tool handlers (system.handlers.ts, resource.handlers.ts)
│   ├── middleware/   # Express middleware (auth.middleware.ts, requestId.middleware.ts)
│   ├── routes/       # Express routes (auth.routes.ts)
│   ├── services/     # Business logic services (token.service.ts, resource.service.ts)
│   ├── transports/   # (Future: if custom transport logic beyond SDK needed)
│   └── utils/        # Utility functions (logger.ts)
├── tests/
│   ├── integration/  # Integration tests (auth.routes.test.ts)
│   └── setup.ts      # Global Jest setup
├── .env            # Local environment variables (gitignored)
├── .env.example    # Example environment variables
├── .env.test       # Environment variables for tests
├── .eslintignore
├── .eslintrc.js
├── .gitignore
├── .prettierignore
├── .prettierrc.js
├── jest.config.js  # Jest configuration
├── package.json
├── package-lock.json
└── tsconfig.json   # TypeScript configuration
```

## Future Work & TODOs

-   Resolve Jest module resolution issue for `@modelcontextprotocol/sdk` to enable integration tests for MCP tools and full coverage.
-   Implement remaining MCP tools as per `mcp-plan.txt` (pipeline analysis, documentation generation).
-   Add more robust persistence for resources and token blacklist (e.g., database) instead of in-memory.
-   Enhance authorization with more granular scopes/roles.
-   Complete documentation for all tools with detailed examples.
-   Expand test coverage, especially integration tests for MCP tools.
-   Implement client-side SDK or examples for interacting with the MCP server.
-   Consider adding OpenAPI/Swagger documentation for HTTP-exposed parts.


</rewritten_file> 