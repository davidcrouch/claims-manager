import React from 'react';
import { renderToString } from 'react-dom/server';
import { LogoutPage } from '../views/LogoutPage.js';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:logout-renderer', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'logout-renderer', 'LogoutRenderer', 'auth-server');

export async function renderLogoutPage(ctx: any, form: string): Promise<string> {
   try {
      log.debug({
         action: 'render_logout_page',
         clientId: ctx.oidc?.client?.clientId,
         sessionId: ctx.oidc?.session?.id,
         host: ctx.host
      }, 'auth-server:logout-renderer:renderLogoutPage - Rendering logout page with React SSR');

      const html = renderToString(React.createElement(LogoutPage, { form }));
      return `<!DOCTYPE html>${html}`;
   } catch (error) {
      log.error({
         error: error.message,
         stack: error.stack,
         clientId: ctx.oidc?.client?.clientId
      }, 'auth-server:logout-renderer:renderLogoutPage - Failed to render, using fallback');

      return getFallbackLogoutHtml(form);
   }
}

function getFallbackLogoutHtml(form: string): string {
   return `<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="UTF-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <title>Logging out — EnsureOS</title>
</head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
   <div style="text-align:center">
      <h1>Logging out...</h1>
      <p>Please wait while we sign you out.</p>
      ${form}
      <script>
         setTimeout(function(){
            var f=document.getElementById('op.logoutForm');
            if(f){var i=document.createElement('input');i.type='hidden';i.name='logout';i.value='yes';f.appendChild(i);f.submit();}
         },1500);
      </script>
   </div>
</body>
</html>`;
}
