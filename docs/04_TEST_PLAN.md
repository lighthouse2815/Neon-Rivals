# Test Plan

## Unit coverage

- Room-code generation.
- Two-player room limit.
- Movement validation and normalization.
- Cooldown enforcement for shooting and dash.
- Projectile hit detection.
- Damage application.
- Round completion.
- Match completion.
- Reconnect timeout handling.
- Invalid event payload rejection.
- Input rate limiting.

## Integration coverage

- Two Socket.IO clients create and join a room.
- Ready flow starts the countdown.
- Authoritative snapshots reflect movement and damage on both clients.
- Third-player join attempt is rejected.
- Reconnect timer restores or times out correctly.

## End-to-end coverage

- Two isolated browser contexts create, join, ready, play, damage, score, reload, reconnect, and rematch.
- Evidence screenshots are captured during the multiplayer flow.
- Console errors are inspected and treated as failures if serious.
