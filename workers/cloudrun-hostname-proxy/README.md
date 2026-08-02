# Cloud Run hostname proxy

Cloudflare Worker that terminates TLS for staging branlamie.com hostnames and
proxies to Cloud Run `*.run.app` origins with the correct `Host` header.

Required because:

- Cloud Run domain mappings are unsupported in `australia-southeast1`
- Cloudflare Free does not allow Origin Rule Host header overrides

## Routes

| Public host | Cloud Run origin |
|-------------|------------------|
| `app-staging.branlamie.com` | `frontend-981956656190.australia-southeast1.run.app` |
| `auth-staging.branlamie.com` | `auth-server-981956656190.australia-southeast1.run.app` |
| `providers-staging.branlamie.com` | `provider-server-981956656190.australia-southeast1.run.app` |

DNS CNAMEs must be **proxied** (orange cloud). Target can be the run.app host
(or a dummy A record); the Worker handles origin fetch.

## Deploy

```bash
cd workers/cloudrun-hostname-proxy
npm install
npx wrangler deploy
```

Requires a Cloudflare API token with Workers Scripts Edit + Workers Routes Edit
on `branlamie.com`.

## After deploy

Set `use_public_hostnames=true` in staging terraform and apply so OIDC issuer /
callbacks use these hostnames.
