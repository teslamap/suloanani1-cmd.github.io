# Tesla Fleet Bridge

Backend foundation for connecting the Tesla Fleet API / Fleet Telemetry to Tesla Smart Navigation.

## Architecture

Tesla vehicle -> Tesla Fleet Telemetry -> public backend -> trip database -> Smart Navigation frontend.

## Important

- Never commit Tesla Client Secret, OAuth tokens, refresh tokens, or Fleet Telemetry private keys.
- GitHub Pages cannot receive Fleet Telemetry directly; the telemetry receiver must run on a public backend.
- Before production use, register the Tesla application, obtain API credentials, configure the EU Fleet API endpoint, create/pair the virtual key, and deploy this backend over HTTPS.

## Current target

Vehicle: 2020 Tesla Model 3 SR+

Initial telemetry goals:
- VehicleSpeed
- Location
- Soc
- Odometer
- EstBatteryRange
- DriveState
- ClimateState / temperature fields when available

The next implementation step is the authenticated Tesla OAuth + Fleet Telemetry receiver and persistent trip storage.
