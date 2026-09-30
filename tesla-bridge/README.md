# Tesla Fleet Bridge

This project is the private backend foundation for Tesla Smart Navigation.

## Architecture

Tesla vehicle -> Tesla Fleet Telemetry (official reference server) -> Redis -> Node bridge -> SQLite trip history -> Smart Navigation.

The browser never receives Tesla client secrets, OAuth refresh tokens, or signing private keys.

## Current implementation

- Tesla OAuth authorization-code flow
- EU Fleet API token endpoint
- refresh-token rotation
- vehicle discovery endpoint
- SQLite telemetry/trip storage
- Current Drive API
- official Tesla Fleet Telemetry server as a Docker service
- Redis dispatcher for decoded vehicle telemetry
- public-key endpoint for Tesla virtual-key registration
- frontend connection panel in the Smart Navigation branch
- no vehicle-command scopes or command endpoints

## Required external setup

1. Create/register the Tesla Developer application.
2. Obtain Client ID and Client Secret.
3. Deploy this backend on a public HTTPS hostname.
4. Generate the secp256r1 application key pair on the server.
5. Publish the public key at the required .well-known path.
6. Register the application for the correct region.
7. Pair the virtual key with the vehicle.
8. Configure Fleet Telemetry fields.
9. Start driving and verify Current Drive records.

Tesla's official Fleet Telemetry reference implementation uses a WebSocket connection from the vehicle, TLS client authentication, and configurable dispatchers. It is not a normal JSON webhook; the official server decodes the telemetry protocol before dispatching records.

## First telemetry fields

VehicleSpeed
Location
Soc
Odometer
EstBatteryRange
DriveState
PackVoltage
PackCurrent
ACChargingEnergyIn
DCChargingEnergyIn

The field list should be kept minimal at first for privacy and cost. Tesla documents change-based delivery and interval controls.

## Calibration goal

For each completed drive:
- capture start/end SOC
- capture start/end odometer
- calculate distance
- capture energy telemetry where available
- correlate speed, temperature, elevation and route
- compare predicted vs actual
- update the personal energy model without silently overwriting manual settings

The calibration model will only learn from completed trips with sufficient data quality.
