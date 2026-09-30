# Deployment checklist

## 1. Tesla Developer application
Create an application at Tesla Developer and set:
- Allowed origin: the root domain used by this backend
- Redirect URI: `https://YOUR_DOMAIN/auth/callback`
- Scopes: `openid offline_access vehicle_device_data vehicle_location`

Tesla's third-party authorization uses authorization-code OAuth. The access token is then used against the Fleet API; with offline_access a refresh token is returned. Never put client secrets in frontend code.

## 2. HTTPS backend
Deploy this directory to a public HTTPS Node.js host. GitHub Pages is only the frontend and cannot be the Fleet Telemetry receiver.

Set:
- TESLA_CLIENT_ID
- TESLA_CLIENT_SECRET
- TESLA_API_BASE=https://fleet-api.prd.eu.vn.cloud.tesla.com
- PUBLIC_BASE_URL=https://YOUR_DOMAIN
- TESLA_PUBLIC_KEY
- DATA_DIR (persistent volume)

## 3. Virtual key
Generate a prime256v1 key pair. Keep the private key only on the backend. Publish the public key at:
`https://YOUR_DOMAIN/.well-known/appspecific/com.tesla.3p.public-key.pem`

Register the application's domain with Tesla, then use Tesla's pairing link to add the virtual key to the vehicle.

## 4. Fleet Telemetry
Configure the vehicle to stream the fields needed for calibration. Start with:
- VehicleSpeed
- Location
- Soc
- Odometer
- EstBatteryRange
- DriveState
- outside/inside temperature or climate fields when available

Do not enable vehicle commands for this first version.

## 5. Calibration
Once telemetry is flowing:
- detect trip start/stop from drive state and odometer
- persist trip start/end snapshots
- calculate distance and SOC delta
- retain raw telemetry for validation
- feed completed trips into the Smart Navigation personal calibration engine

The current code intentionally does not fabricate completed trips from partial telemetry.
