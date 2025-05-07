# SignalJourney MCP Server

This directory contains the Node.js/TypeScript implementation of the Model Context Protocol (MCP) server for the SignalJourney project. This server provides tools for analyzing biosignal processing pipelines and generating standardized documentation.

## Features

*   **MCP Compliant:** Implements the Model Context Protocol standard.
*   **Transports:** Supports StreamableHTTP and stdio transports.
*   **Authentication:** JWT-based authentication via `/auth` endpoints.
*   **Resource Management:** Basic CRUD operations for managing generic resources via MCP tools.
*   **System Tools:** Provides basic server status and version information.

## Prerequisites

*   Node.js (v18 or higher)
*   npm

## Setup

1.  **Clone the Repository:**
    ```bash
    # If you haven't already cloned the main SignalJourney repo
    git clone <repository_url>
    cd signalJourney/mcp-server
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file and provide the necessary values, especially:
        *   `JWT_SECRET`: A strong, unique secret key for signing JWTs.
        *   `MOCK_AUTH_USERNAME`/`MOCK_AUTH_PASSWORD`: Credentials for the mock login (for development).
    *   Review other variables like `PORT`, `LOG_LEVEL`, etc.

## Running the Server

*   **Development Mode (with hot-reloading):**
    ```bash
    npm run dev
    ```
    This uses `nodemon` to automatically restart the server on file changes.

*   **Production Mode:**
    1.  Build the TypeScript code:
        ```bash
        npm run build
        ```
    2.  Start the server:
        ```bash
        npm run start
        ```

## Available MCP Tools (via HTTP/stdio)

The server exposes the following tools through its MCP transports:

*   **System Tools:**
    *   `system.getServerStatus`: Retrieves server status information.
    *   `system.getServerVersion`: Retrieves server name and version.
*   **Resource Management Tools (Require Authentication & Scopes):**
    *   `resource.create`: Creates a new resource (requires `write:resource` scope).
        *   Params: `type` (string), `content` (any), `metadata` (object, optional)
    *   `resource.get`: Retrieves a resource by ID (requires `read:resource` scope).
        *   Params: `id` (string)
    *   `resource.update`: Updates a resource by ID (requires `write:resource` scope).
        *   Params: `id` (string), `type` (string, optional), `content` (any, optional), `metadata` (object, optional)
    *   `resource.delete`: Deletes a resource by ID (requires `write:resource` scope).
        *   Params: `id` (string)
    *   `resource.list`: Lists resources owned by the authenticated user, optionally filtered by type (requires `read:resource` scope).
        *   Params: `type` (string, optional)

## Authentication (HTTP Only)

The server provides standard HTTP endpoints for JWT authentication:

*   **`POST /auth/login`**: Authenticate with username/password (uses mock credentials defined in `.env`). Returns an `accessToken`.
    *   Request Body: `{ "username": "...", "password": "..." }`
*   **`POST /auth/validate-token`**: Validates an existing access token.
    *   Request Body: `{ "token": "..." }`
*   **`POST /auth/logout`**: Logs out the user by blacklisting the provided token (requires Bearer token in Authorization header).

**Note:** Use the obtained `accessToken` in the `Authorization: Bearer <token>` header when calling scope-protected MCP tools via the HTTP transport. Authentication via the stdio transport is not currently implemented.

## Configuration Variables

See `.env.example` for a full list of environment variables and their descriptions.

## TODO

*   Implement actual database for users and resources instead of mock/in-memory stores.
*   Implement `executionContextBuilder` for cleaner context propagation.
*   Add more sophisticated authorization logic if needed.
*   Implement the core SignalJourney analysis tools.
*   Expand test coverage.
*   Add detailed API documentation (e.g., using Swagger/OpenAPI for HTTP routes).


</rewritten_file> 