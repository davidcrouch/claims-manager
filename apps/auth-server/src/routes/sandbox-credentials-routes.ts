/**
 * Sandbox NATS Credential Issuance Routes (STUB).
 *
 * This module defines the endpoint for issuing credentials to connect
 * to sandbox NATS servers. The capabilities-client calls this endpoint
 * via the NatsAuthProvider callback when it needs to connect to a
 * remote/sandbox NATS server.
 *
 * STUB: This is a placeholder implementation. The actual credential issuance
 * logic (determining which sandbox hosts an app, generating NATS credentials,
 * etc.) will be implemented when sandbox infrastructure is ready.
 *
 * @see Docs/registry/15_Federated_Resolution_And_Multi_NATS_Implementation_Plan.md §3
 */

import { Router, type Request, type Response } from "express";

const SERVICE_NAME = "auth-server:sandbox-credentials";

// ── Types ───────────────────────────────────────────────────────────

/**
 * Request body for sandbox credential issuance.
 */
interface SandboxCredentialRequest {
  /** The NATS server URL that credentials are needed for */
  natsUrl: string;
}

/**
 * Response body with NATS credentials for a sandbox.
 */
interface SandboxCredentialResponse {
  /** NATS auth token (if token-based auth) */
  token?: string;
  /** Client ID / username (if user+pass auth) */
  user?: string;
  /** Client secret / password (if user+pass auth) */
  pass?: string;
  /** JWT (if NATS JWT auth) */
  jwt?: string;
  /** NKey seed (if NATS JWT auth) */
  nkeySeed?: string;
  /** When these credentials expire (Unix ms). Undefined = no expiry. */
  expiresAt?: number;
}

// ── Routes ──────────────────────────────────────────────────────────

export function createSandboxCredentialRoutes(): Router {
  const router = Router();

  /**
   * POST /sandbox/credentials
   *
   * Issues NATS credentials for connecting to a sandbox server.
   * Requires a valid access token (Bearer auth).
   *
   * Request body: { natsUrl: string }
   * Response: SandboxCredentialResponse
   *
   * STUB: Currently returns a 501 Not Implemented response.
   * When implemented, this endpoint will:
   * 1. Validate the caller's access token
   * 2. Look up the sandbox associated with the natsUrl
   * 3. Verify the caller has access to that sandbox
   * 4. Generate time-limited NATS credentials
   * 5. Return the credentials
   */
  router.post("/sandbox/credentials", async (req: Request, res: Response) => {
    const { natsUrl } = req.body as SandboxCredentialRequest;

    if (!natsUrl) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: `${SERVICE_NAME} - natsUrl is required`,
      });
      return;
    }

    // TODO: Implement actual credential issuance
    // 1. Extract access token from Authorization header
    // 2. Validate token and extract user/tenant info
    // 3. Look up sandbox by natsUrl in database
    // 4. Verify user has access to the sandbox
    // 5. Generate time-limited NATS credentials (user/pass or token)
    // 6. Return credentials with expiresAt

    console.warn(`${SERVICE_NAME} - Sandbox credential issuance not yet implemented. natsUrl=${natsUrl}`);

    res.status(501).json({
      error: "NOT_IMPLEMENTED",
      message: `${SERVICE_NAME} - Sandbox credential issuance is not yet implemented. This endpoint will issue NATS credentials for sandbox servers once sandbox infrastructure is ready.`,
    });
  });

  return router;
}
