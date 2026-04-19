#!/usr/bin/env node
// deploy/scripts/generate-jwks.mjs
//
// Emits a single JSON document on stdout with the RSA-2048 and EC P-256
// JWK components auth-server reads via getJwksConfig() in
// apps/auth-server/src/config/env-validation.ts. The component names match
// the secret IDs defined in deploy/terraform/modules/secrets/main.tf so the
// calling PowerShell script can loop over them directly.
//
// Usage:
//   node deploy/scripts/generate-jwks.mjs > jwks.json
//
// Output shape:
// {
//   "rsa": { "n": "...", "d": "...", "p": "...", "q": "...", "dp": "...", "dq": "...", "qi": "..." },
//   "ec":  { "x": "...", "y": "...", "d": "..." }
// }

import { generateKeyPairSync } from 'node:crypto';

function rsaJwk() {
   const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
   const jwk = privateKey.export({ format: 'jwk' });
   return {
      n: jwk.n,
      d: jwk.d,
      p: jwk.p,
      q: jwk.q,
      dp: jwk.dp,
      dq: jwk.dq,
      qi: jwk.qi,
   };
}

function ecJwk() {
   const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
   const jwk = privateKey.export({ format: 'jwk' });
   return {
      x: jwk.x,
      y: jwk.y,
      d: jwk.d,
   };
}

process.stdout.write(JSON.stringify({ rsa: rsaJwk(), ec: ecJwk() }));
