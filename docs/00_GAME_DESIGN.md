# Neon Duel Game Design

## Pillars

- Tight top-down 1v1 duels with readable neon combat feedback.
- Small feature set with low ambiguity: move, aim, shoot, dash, survive.
- Real multiplayer integrity: the server owns hit detection, health, and round results.

## Match structure

- Private room codes with invitation URL.
- Best of five rounds; first to three round wins takes the match.
- Each player starts each round with 100 health at mirrored spawn points.
- Short spawn protection avoids unfair immediate spawn kills.

## Controls

- `WASD` or arrow keys: move.
- Mouse: aim.
- Left click: shoot.
- `Space`: dash.
- `Escape`: toggle pause and settings overlay.

## Modes

- Local practice: single-player offline sparring against a lightweight AI rival.
- Online duel: real two-player Socket.IO match flow using the same combat rules.

## Arena

- Single symmetrical cyber arena sized for responsive play.
- Solid boundaries, no complex obstacles in MVP.
- Visual identity built from dark surfaces, cyan/magenta lighting, pulses, trails, and reactive HUD.
