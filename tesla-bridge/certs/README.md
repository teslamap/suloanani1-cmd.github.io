Fleet Telemetry requires a public HTTPS endpoint and TLS certificate.

Use a real certificate for the deployment hostname. Do not commit certificate or private-key files.

The Fleet Telemetry server should terminate TLS on port 443 with:
- tls.crt
- tls.key
