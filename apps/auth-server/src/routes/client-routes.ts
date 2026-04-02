/**
 * Client management routes - delete API key clients (DCR-created).
 * Requires Bearer user JWT; validates user's org matches client's organization_id.
 */
import { Application, Request, Response } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { jwtAuthForIAT } from '../middleware/jwt-auth.js';

const baseLogger = createLogger('auth-server:client-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'client-routes', 'ClientRoutes', 'auth-server');

export default function createClientRoutes(app: Application, provider: any): void {
   // Delete a client (revoke API key). Requires Bearer user JWT; user's org must match client's organization_id.
   app.delete('/oauth/clients/:clientId', jwtAuthForIAT, async (req: Request, res: Response) => {
      const clientId = req.params.clientId;
      const userId = req.userId;
      const organizationId = req.organizationId;

      if (!clientId) {
         return res.status(400).json({ error: 'client_id required' });
      }

      try {
         const client = await provider.Client.find(clientId);
         if (!client) {
            log.warn({ functionName: 'deleteClient', clientId }, 'auth-server:client-routes:deleteClient - Client not found');
            return res.status(404).json({ error: 'client not found' });
         }

         const meta = client.metadata?.() ?? {};
         const clientOrgId = meta.organization_id ?? '';

         if (clientOrgId !== organizationId) {
            log.warn({ functionName: 'deleteClient', clientId, clientOrgId, organizationId }, 'auth-server:client-routes:deleteClient - Organization mismatch');
            return res.status(403).json({ error: 'forbidden', error_description: 'Client does not belong to your organization' });
         }

         await client.destroy();
         log.info({ functionName: 'deleteClient', clientId, userId, organizationId }, 'auth-server:client-routes:deleteClient - Client deleted');

         res.status(204).send();
      } catch (err: any) {
         log.error({ functionName: 'deleteClient', clientId, error: err?.message }, 'auth-server:client-routes:deleteClient - Delete failed');
         res.status(500).json({ error: 'server_error', error_description: 'Failed to delete client' });
      }
   });

   log.info({ routesCreated: true }, 'auth-server:client-routes - Client routes created');
}
