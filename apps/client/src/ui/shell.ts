import type { AppController } from "../app-controller";
import type { AppState } from "../state";

const renderBanner = (state: AppState): string =>
  state.banner
    ? `<div class="banner banner--${state.banner.kind}">${state.banner.message}</div>`
    : "";

const renderHud = (state: AppState): string => {
  const match = state.latestMatch;
  const localPlayer = match?.players.find((player) => player.id === state.playerId) ?? match?.players[0];
  const enemyPlayer =
    match?.players.find((player) => player.id !== state.playerId) ?? match?.players[1];

  if (!match || !localPlayer || !enemyPlayer || state.view !== "arena") {
    return "";
  }

  const dashCooldownRatio = Math.max(
    0,
    1 - localPlayer.dashCooldownMs / 2200
  );

  return `
    <div class="hud">
      <div class="hud__pane">
        <div class="hud-card">
          <div class="hud-card__row">
            <span class="hud-card__label">${localPlayer.name}</span>
            <span class="hud-card__value">${localPlayer.score}</span>
          </div>
          <div class="meter">
            <div class="meter__fill" style="width:${localPlayer.health}%"></div>
          </div>
        </div>
      </div>
      <div class="hud__pane">
        <div class="hud-card">
          <div class="hud-card__row">
            <span class="hud-card__label">Round</span>
            <span class="hud-card__value">${match.roundNumber} / 5</span>
          </div>
          <div class="hud-card__row">
            <span class="hud-card__label">Ping</span>
            <span class="hud-card__value">${state.pingMs} ms</span>
          </div>
          <div class="hud-card__row">
            <span class="hud-card__label">Dash</span>
            <span class="hud-card__value">${Math.round(dashCooldownRatio * 100)}%</span>
          </div>
        </div>
      </div>
      <div class="hud__pane hud__pane--right">
        <div class="hud-card">
          <div class="hud-card__row">
            <span class="hud-card__label">${enemyPlayer.name}</span>
            <span class="hud-card__value">${enemyPlayer.score}</span>
          </div>
          <div class="meter">
            <div class="meter__fill meter__fill--enemy" style="width:${enemyPlayer.health}%"></div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const renderPanel = (state: AppState): string => {
  if (state.view === "menu") {
    return `
      <div class="panel">
        <p class="panel__eyebrow">Realtime 1v1 Arena</p>
        <h1 class="panel__title">Neon Duel</h1>
        <p class="panel__copy">
          Sharpen the local prototype offline, then jump into a private room for authoritative multiplayer combat.
        </p>
        <div class="stack">
          <label class="field">
            <span class="field__label">Pilot Name</span>
            <input class="field__input" data-action="player-name" value="${state.playerName}" maxlength="24" />
          </label>
        </div>
        <div class="actions">
          <button class="button button--primary" data-action="practice">Practice Offline</button>
          <button class="button button--accent" data-action="online">Private Online Room</button>
        </div>
        <ul class="help-list">
          <li><strong>Move:</strong> WASD or arrow keys</li>
          <li><strong>Aim:</strong> mouse cursor</li>
          <li><strong>Shoot:</strong> hold left click</li>
          <li><strong>Dash:</strong> tap Space</li>
        </ul>
        ${renderBanner(state)}
      </div>
    `;
  }

  if (state.view === "lobby") {
    const localPlayer = state.room?.players.find((player) => player.id === state.playerId);
    const playersMarkup = state.room
      ? state.room.players
          .map(
            (player) => `
              <div class="player-chip">
                <div class="player-chip__meta">
                  <div class="player-chip__name">${player.name}</div>
                  <div class="player-chip__status">
                    ${player.connected ? "Connected" : "Reconnecting"} • ${player.ready ? "Ready" : "Waiting"}
                  </div>
                </div>
                <div class="chip">${player.score} rounds</div>
              </div>
            `
          )
          .join("")
      : "";

    return `
      <div class="panel panel--wide">
        <p class="panel__eyebrow">Private Match Lobby</p>
        <h2 class="panel__title">Room Sync</h2>
        <div class="grid-2 stack">
          <label class="field">
            <span class="field__label">Pilot Name</span>
            <input class="field__input" data-action="player-name" value="${state.playerName}" maxlength="24" />
          </label>
          <label class="field">
            <span class="field__label">Room Code</span>
            <input class="field__input" data-action="room-code" value="${state.roomCodeDraft}" maxlength="6" />
          </label>
        </div>
        <div class="actions">
          <button class="button button--primary" data-action="create-room">Create Room</button>
          <button class="button button--secondary" data-action="join-room">Join Room</button>
          <button class="button button--ghost" data-action="menu">Back</button>
        </div>
        ${
          state.room
            ? `
              <div class="room-grid">
                <div class="room-card">
                  <p class="room-card__label">Room Code</p>
                  <p class="room-card__value">${state.room.roomCode}</p>
                </div>
                <div class="room-card">
                  <p class="room-card__label">Phase</p>
                  <p class="room-card__value">${state.room.phase}</p>
                </div>
              </div>
              <div class="player-list">${playersMarkup}</div>
              <div class="actions">
                <button class="button button--accent" data-action="ready">
                  ${localPlayer?.ready ? "Unready" : "Ready Up"}
                </button>
                <button class="button button--ghost" data-action="leave-room">Leave Room</button>
              </div>
            `
            : ""
        }
        ${renderBanner(state)}
      </div>
    `;
  }

  if (state.view === "result" && state.result) {
    return `
      <div class="panel">
        <p class="panel__eyebrow">Result Screen</p>
        <h2 class="panel__title">${state.result.title}</h2>
        <p class="panel__copy">${state.result.subtitle}</p>
        <div class="actions">
          <button class="button button--primary" data-action="rematch">Rematch</button>
          <button class="button button--ghost" data-action="menu">Main Menu</button>
        </div>
        ${renderBanner(state)}
      </div>
    `;
  }

  return "";
};

export const createUiShell = (
  container: HTMLElement,
  controller: AppController
): void => {
  container.className = "ui-root";

  const root = document.createElement("div");
  root.className = "shell";
  container.append(root);

  const bindActions = (): void => {
    const playerNameInput = root.querySelector<HTMLInputElement>('[data-action="player-name"]');
    playerNameInput?.addEventListener("input", (event) => {
      controller.setPlayerName((event.target as HTMLInputElement).value);
    });

    const roomCodeInput = root.querySelector<HTMLInputElement>('[data-action="room-code"]');
    roomCodeInput?.addEventListener("input", (event) => {
      controller.setRoomCodeDraft((event.target as HTMLInputElement).value);
    });

    const mapping: Record<string, () => void> = {
      practice: () => controller.startPractice(),
      online: () => controller.openOnlineLobby(),
      "back-to-menu": () => controller.returnToMenu(),
      "create-room": () => controller.createRoom(),
      "join-room": () => controller.joinRoom(),
      ready: () => controller.toggleReady(),
      rematch: () => controller.rematch(),
      menu: () => controller.returnToMenu(),
      "leave-room": () => controller.leaveRoom()
    };

    for (const [action, handler] of Object.entries(mapping)) {
      root.querySelector<HTMLElement>(`[data-action="${action}"]`)?.addEventListener("click", handler);
    }

    root.querySelector<HTMLElement>('[data-action="toggle-sound"]')?.addEventListener("click", () => {
      controller.setSoundEnabled(!controller.store.getState().soundEnabled);
    });
  };

  controller.store.subscribe((state) => {
    const focusedInput = document.activeElement;
    const focusedAction =
      focusedInput instanceof HTMLInputElement ? focusedInput.dataset.action ?? null : null;
    const selectionStart =
      focusedInput instanceof HTMLInputElement ? focusedInput.selectionStart : null;
    const selectionEnd = focusedInput instanceof HTMLInputElement ? focusedInput.selectionEnd : null;

    root.innerHTML = `
      <div class="shell__top">
        <div class="brand">
          <span class="brand__eyebrow">Neon Competitive Prototype</span>
          <span class="brand__title">Neon Duel</span>
          <span class="brand__status">${state.connectionLabel}</span>
        </div>
        <div class="chip-row">
          ${
            state.view === "arena"
              ? '<button class="chip chip--back" data-action="back-to-menu">Back to Menu</button>'
              : ""
          }
          <button class="chip" data-action="toggle-sound">
            ${state.soundEnabled ? "Sound On" : "Sound Off"}
          </button>
        </div>
      </div>
      <div class="panel-wrap">
        ${renderPanel(state)}
      </div>
      ${renderHud(state)}
    `;
    bindActions();

    if (focusedAction) {
      const replacementInput = root.querySelector<HTMLInputElement>(
        `input[data-action="${focusedAction}"]`
      );
      if (replacementInput) {
        replacementInput.focus();
        if (selectionStart !== null && selectionEnd !== null) {
          replacementInput.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    }
  });
};
