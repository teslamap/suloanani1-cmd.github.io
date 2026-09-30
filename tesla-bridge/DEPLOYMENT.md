# Deployment

This stack intentionally separates the browser/API HTTPS endpoint from the Tesla Fleet Telemetry TLS endpoint.

- API: https://api.example.com -> Caddy -> Node app :8080
- Fleet Telemetry: https://telemetry.example.com:8443 -> Tesla reference server :443
- Redis: internal only
- SQLite: internal persistent volume

Tesla's reference server uses TLS/mTLS and a vehicle WebSocket protocol; do not replace it with a normal JSON webhook.

## You must supply

1. A public domain (two DNS names are recommended):
   - api.example.com
   - telemetry.example.com
2. A public HTTPS certificate for telemetry.example.com.
3. A Tesla Developer application with Client ID/Secret.
4. A Tesla Partner Authentication Token for application registration.
5. A persistent host/VPS/cloud service capable of Docker Compose.
6. Your Tesla mobile app approval/pairing step.

## Server key

On the server:
openssl ecparam -name prime256v1 -genkey -noout -out private-key.pem
openssl ec -in private-key.pem -pubout -out public-key.pem

Do not commit private-key.pem.

The public key must remain available at:
https://api.example.com/.well-known/appspecific/com.tesla.3p.public-key.pem

## Tesla registration

Tesla requires the registered application's root/allowed domain to match the public-key domain. Register the application in the correct Fleet API region. For a Georgian user, verify the account's returned region before assuming a region; Tesla documents EMEA at fleet-api.prd.eu.vn.cloud.tesla.com.

Use the partner token to POST the application registration endpoint for that region.

## OAuth

Set:
TESLA_CLIENT_ID
TESLA_CLIENT_SECRET
PUBLIC_BASE_URL=https://api.example.com
FRONTEND_ORIGIN=https://teslamap.github.io

The callback is:
https://api.example.com/auth/callback

The bridge requests only:
openid offline_access vehicle_device_data vehicle_location

No vehicle command scopes are requested.

## Pairing

After registration and user authorization, pair the virtual key through Tesla's mobile app using the application's registered domain.

## Fleet Telemetry

The vehicle configuration must point to:
host = telemetry.example.com
port = 8443
protocol = TLS

Start with the minimum calibration fields:
VehicleSpeed
Location
Soc
Odometer
EstBatteryRange
DriveState
PackVoltage
PackCurrent

Then verify the vehicle's fleet_status and fleet_telemetry_config until synced=true.

## Current Drive

The official Fleet Telemetry server publishes decoded V records to Redis.
The Node bridge subscribes to the VIN channel, stores raw telemetry, and exposes authenticated:
GET /api/current-drive
GET /api/trips

## Trip detection

A trip starts when speed > 1 and odometer is available.
A trip ends after 3 minutes without movement.
This is a first-pass detector; once real telemetry is flowing we can refine it using DriveState and charging state.

## Calibration

Do not treat SOC percentage as exact kWh. The bridge stores SOC, odometer, pack voltage/current and raw records so the calibration engine can later use the best available energy signal.

## Important security rules

- Never commit client secrets, OAuth tokens, refresh tokens, private keys, certificates, VIN histories, or raw GPS history.
- Keep location data private.
- Keep vehicle command scopes disabled.
- Use a persistent encrypted storage volume/backups for the database.
