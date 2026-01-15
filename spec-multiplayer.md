# Snake Game — P2P Multiplayer Spec

## Overview

Peer-to-peer multiplayer extension for the Snake game. Two players compete on a shared grid via WebRTC, racing for food while avoiding collisions. Desktop-only, no mobile support.

## Technical Stack

| Technology | Purpose |
|------------|---------|
| PeerJS | WebRTC abstraction + signaling |
| WebRTC DataChannels | Direct browser-to-browser communication |
| Google STUN | NAT traversal (`stun:stun.l.google.com:19302`) |

### Why PeerJS?

- Abstracts complex WebRTC negotiation (SDP, ICE candidates)
- Provides free cloud signaling server (or self-hostable)
- ~20 lines of connection code vs hundreds for raw WebRTC
- Handles reconnection and connection state management

## Connection Model

### Architecture

```
┌─────────────┐         ┌─────────────────┐         ┌─────────────┐
│   Host      │◄───────►│  PeerJS Cloud   │◄───────►│   Guest     │
│  (Player 1) │         │   (Signaling)   │         │  (Player 2) │
└─────────────┘         └─────────────────┘         └─────────────┘
       │                                                   │
       │              WebRTC DataChannel                   │
       └───────────────────────────────────────────────────┘
                    (Direct P2P after handshake)
```

### Discovery: Shareable Links

- Host clicks "MULTIPLAYER" → "CREATE GAME"
- System generates unique peer ID using crypto-random: 16 chars (e.g., `snake-7f3a9c2b8e1d4f6a`)
- URL format: `https://[domain]/?join=snake-7f3a9c2b8e1d4f6a`
- Host sees: shareable link + "Copy Link" button + "Waiting for opponent..."
- Guest opens link → auto-connects to host's peer ID

**Peer ID Generation**:
```typescript
// Use crypto API for unpredictable IDs (not Math.random)
const array = new Uint8Array(8)
crypto.getRandomValues(array)
const peerId = 'snake-' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
// Result: snake-7f3a9c2b8e1d4f6a (16 hex chars = 64 bits of entropy)
```

### Link Behavior

- **No expiry**: Link valid until host cancels or closes browser
- **Single use**: Once guest connects, link cannot be used by another player
- **Cancel**: Host can cancel via button or Escape key → returns to menu

### Invalid Link Handling

| Scenario | Guest sees |
|----------|------------|
| Host closed browser | "Game not found. The host may have left." |
| Link already used (game in progress) | "Game already in progress." |
| Malformed/invalid peer ID | "Invalid game link." |
| PeerJS connection timeout (10s) | "Could not connect. Host may be unavailable." |

### Connection Failure Handling

If WebRTC connection fails (strict NAT, corporate firewall, VPN):

```
CONNECTION FAILED

Unable to establish peer-to-peer connection.

Try:
• Disabling VPN
• Using a different network
• Asking your friend to host instead
```

No automatic fallback to relay server (keeps implementation simple).

### Rate Limiting (Anti-Spam)

Protect against malicious peers flooding messages:

| Protection | Limit |
|------------|-------|
| Max messages per second | 30 (well above 12.5 ticks/sec at max speed) |
| Max message size | 256 bytes |
| Exceeding limits | Log warning, ignore excess messages |
| Sustained abuse (>5 seconds) | Disconnect with "Connection terminated" |

## State Synchronization

### Lockstep Model

Both clients must exchange inputs before either advances the game tick.

```
Tick N:
  1. Host sends input (direction or "none") to Guest
  2. Guest sends input (direction or "none") to Host
  3. Both clients receive each other's input
  4. Both clients advance simulation identically
  5. Proceed to Tick N+1
```

### Lockstep Timeout

If opponent's input doesn't arrive within **500ms**, assume disconnect:

| Wait Time | Action |
|-----------|--------|
| 0-500ms | Wait for input (game appears to stutter) |
| 500ms+ | Trigger disconnect → opponent forfeits |

This prevents infinite hangs while allowing for brief network hiccups.

### Why Lockstep?

| Approach | Pros | Cons |
|----------|------|------|
| **Lockstep** ✓ | Perfect sync, no corrections needed | Input lag on bad connections |
| Host Authoritative | Simple, no desync | Host has latency advantage |
| Rollback | Responsive | Complex, visual corrections |

Lockstep works well for Snake because:
- Game is already discrete (80ms–40ms tick intervals)
- Network wait hides within tick interval
- No prediction/correction code needed
- Guaranteed identical game state on both clients

### Determinism Requirements

For lockstep to work, game logic must be **100% deterministic**:

- Use seeded random for food spawning (share seed at game start)
- Process inputs in consistent order (Host input, then Guest input)
- Avoid floating-point operations that vary by platform
- Same collision detection order on both clients

**Seeded PRNG Implementation** (do NOT use Math.random):
```typescript
// Mulberry32 - simple, fast, deterministic PRNG
function createRNG(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Usage: const rng = createRNG(sharedSeed); rng() → 0.0 to 1.0
```

### Tab Throttling Mitigation

Browsers throttle `requestAnimationFrame` and `setTimeout` when tabs are backgrounded.

**Solution**: Use tick-based timing, not wall-clock time:
- Starvation timer = number of ticks (e.g., 15 seconds × 12.5 ticks/sec = ~188 ticks at level 1)
- All timers count ticks, not milliseconds
- If tab was backgrounded, catch up by processing missed ticks (up to a cap)

**Tab visibility handling**:
- On `visibilitychange` to hidden: Continue sending "no input" messages to avoid timeout
- On return: Process any queued opponent inputs immediately

### Message Protocol

```typescript
// Input message (sent every tick)
interface TickInput {
  type: 'tick_input'
  tick: number
  direction: Direction | null  // null = no change
}

// Game start message
interface GameStart {
  type: 'game_start'
  seed: number        // Random seed for food spawning
  timestamp: number   // Synchronized start time
}

// Ready signal
interface PlayerReady {
  type: 'player_ready'
}

// Game result
interface GameResult {
  type: 'game_result'
  winner: 'player1' | 'player2' | 'draw'
  p1Score: number
  p2Score: number
}
```

## Grid & Dimensions

### Multiplayer Grid

| Property | Value |
|----------|-------|
| Grid size | 40 columns × 30 rows (1200 cells) |
| Cell size | 20 × 20 pixels |
| Canvas size | 800 × 600 pixels |

### Single Player Grid (unchanged)

| Property | Value |
|----------|-------|
| Grid size | 30 columns × 20 rows (600 cells) |
| Cell size | 20 × 20 pixels |
| Canvas size | 600 × 400 pixels |

## Visual Design

### Player Colors

| Player | Role | Color | Hex |
|--------|------|-------|-----|
| Player 1 | Host | Blue | `#3399ff` |
| Player 2 | Guest | Orange | `#ff9933` |
| Food | — | White/Bright | `#ffffff` |

### HUD (Multiplayer)

```
┌──────────────────────────────────────────────────────────────┐
│  P1: 5                    LEVEL 2                    P2: 3   │
│  [████████░░░░]                                [████████████] │
└──────────────────────────────────────────────────────────────┘
```

- **Top row**: Scores with player colors, level indicator (center)
- **Second row**: Hunger bars for each player (see Starvation Mechanic)
- Score text matches snake color (blue for P1, orange for P2)
- Level determined by **combined score** (P1 + P2)

### Hunger Bar

- Horizontal bar below each player's score
- Full when just eaten, depletes over 15 seconds
- Color transitions: Green → Yellow → Red as time runs out
- **Last 3 seconds**: Snake body flashes/pulses as warning

## Core Mechanics

### Spawn Positions

Players spawn in **diagonal corners** of the 40×30 grid:

| Player | Position | Direction | Rationale |
|--------|----------|-----------|-----------|
| Player 1 | (7, 7) — top-left area | Right | Moving toward center |
| Player 2 | (32, 22) — bottom-right area | Left | Moving toward center |

Initial snake length: 3 segments each (same as single player)

### Food

- **2 food items** on grid at all times
- When food is eaten, new food spawns immediately
- Food cannot spawn on either snake's body
- Use seeded random for deterministic spawning across clients

**Edge Cases**:

| Scenario | Handling |
|----------|----------|
| Both players eat different food on same tick | Both get points, 2 new food spawn |
| Both heads move to same food cell | Head-to-head collision → both die (food doesn't matter) |
| Grid nearly full (no spawn space) | Spawn food at first empty cell in deterministic scan order |
| Grid 100% full | Skip food spawn until space available (game likely ending anyway) |

### Collision Rules

| Collision Type | Result |
|----------------|--------|
| Wall | Player dies |
| Self (own body) | Player dies |
| Snake-to-snake (any) | **Both players die** |
| Head-to-head | Both die |
| Head-to-body | Both die (mutual destruction) |

### Win Conditions

1. **Last alive wins**: If one player dies (wall/self), opponent wins instantly
2. **Mutual death**: If both die on same tick, **higher score wins**
3. **Score tie + mutual death**: Game is a **draw**
4. **Starvation**: Player starving to death counts as dying (opponent wins)

### Tick Processing Order (Critical for Determinism)

Each tick must process events in this exact order:

```
1. Apply P1 pending direction
2. Apply P2 pending direction
3. Move P1 snake (add head, conditionally remove tail)
4. Move P2 snake (add head, conditionally remove tail)
5. Check P1 wall collision → mark dead
6. Check P2 wall collision → mark dead
7. Check P1 self collision → mark dead
8. Check P2 self collision → mark dead
9. Check snake-to-snake collision → mark both dead
10. Process starvation timers → mark dead if shrink below 1
11. Check P1 food collision → eat, grow, reset hunger, spawn new food
12. Check P2 food collision → eat, grow, reset hunger, spawn new food
13. Determine winner if any deaths occurred
14. Render frame
```

**Key**: Collisions checked BEFORE food eating. If you die reaching food, you don't get the point.

## Starvation Mechanic (Multiplayer Only)

Prevents "turtling" strategy where a player avoids food to stay small and safe.

### Rules

| Parameter | Value |
|-----------|-------|
| Timer duration | 15 seconds |
| Segment loss | 1 segment when timer expires |
| Death condition | Would shrink below 1 segment |
| Timer reset | Eating any food resets to 15 seconds |

### Behavior

```
Start: Snake has 3 segments, 15-second timer starts
...12 seconds pass without eating...
Timer at 3 seconds: Snake starts flashing, hunger bar red
...3 more seconds pass...
Timer expires: Snake loses 1 segment (now 2), timer resets to 15s
...this continues until snake eats or shrinks to 1 segment...
At 1 segment + timer expires: Player dies (starvation)
```

**Edge Case — Eating on Same Tick as Shrink**:
- Tick processing order: Starvation BEFORE food eating (see Tick Processing Order)
- If timer expires on same tick you eat: you shrink first, THEN eat
- Result: If at 1 segment and timer expires, you die even if food was reached

### Visual Feedback

1. **Hunger bar**: Below player's score, depletes left-to-right over 15 seconds
2. **Color progression**: Green (>10s) → Yellow (5-10s) → Red (<5s)
3. **Flash warning**: Snake body pulses/flashes during last 3 seconds
4. **Shrink animation**: Brief visual feedback when segment is lost

### Single Player

Starvation does **NOT** apply to single player mode — classic rules preserved.

## Speed & Levels

### Level Progression (Multiplayer)

Level based on **combined score** (P1 score + P2 score):

| Level | Combined Score | Speed |
|-------|----------------|-------|
| 1 | 0-9 | 80ms |
| 2 | 10-19 | 70ms |
| 3 | 20-29 | 60ms |
| 4 | 30-39 | 50ms |
| 5 | 40+ | 40ms |

Both snakes always move at the same speed (level affects both equally).

### Formula

```typescript
const combinedScore = player1Score + player2Score
const level = Math.min(5, Math.floor(combinedScore / 10) + 1)
const speed = Math.max(40, 80 - (level - 1) * 10)
```

## User Experience Flow

### Main Menu

```
┌─────────────────────────────────┐
│                                 │
│            SNAKE                │
│                                 │
│      [ SINGLE PLAYER ]          │
│                                 │
│      [ MULTIPLAYER ]            │
│                                 │
│      High Score: 42             │
│                                 │
└─────────────────────────────────┘
```

### Multiplayer Flow

```
Main Menu
    │
    ▼
MULTIPLAYER clicked
    │
    ├─► Host: "CREATE GAME"
    │       │
    │       ▼
    │   Waiting Screen
    │   "Share this link: [URL] [Copy]"
    │   "Waiting for opponent..."
    │   [Cancel]
    │       │
    │       ▼ (Guest connects)
    │   Ready Screen
    │   "Player 2 joined!"
    │   "Press SPACE when ready"
    │       │
    │       ▼ (Both ready)
    │   Countdown: 3... 2... 1...
    │       │
    │       ▼
    │   GAME PLAYING
    │
    └─► Guest: Opens shared link
            │
            ▼
        "Connecting..."
            │
            ▼ (Connected)
        Ready Screen
        "Connected to host!"
        "Press SPACE when ready"
            │
            ▼
        (Same flow as host)
```

### Ready-Up System

1. Both players must press SPACE (or click "Ready" button)
2. UI shows checkmarks: `[✓] Player 1 Ready  [ ] Player 2 Ready`
3. When both ready: **3-2-1 countdown** (centered, large text)
4. Countdown synced via host's timestamp

**Countdown Interruption**:
- If player disconnects during countdown → abort, other player sees "Opponent left"
- If player un-readies during countdown → abort countdown, return to ready screen
- Players CAN un-ready before countdown starts (toggle behavior)

### Game Over Screen

```
┌─────────────────────────────────┐
│                                 │
│         PLAYER 1 WINS!          │
│              or                 │
│            DRAW!                │
│                                 │
│     P1: 12        P2: 8         │
│                                 │
│        [ REMATCH ]              │
│        [ MAIN MENU ]            │
│                                 │
│   Waiting for opponent...       │
│   (if one clicked rematch)      │
│                                 │
└─────────────────────────────────┘
```

### Rematch Flow

- Both players must click "REMATCH" to play again
- Shows "Waiting for opponent to accept rematch..." if one clicked
- Either can click "MAIN MENU" to disconnect and return to menu
- Connection persists between rematches (no new link needed)

## Input Handling

### Multiplayer Controls

| Key | Action |
|-----|--------|
| Arrow Keys | Change direction (own snake only) |
| W/A/S/D | Alternative direction keys |
| Space | Ready up (pre-game) |
| Escape | Leave game / Cancel |

### Input Rules (Same as Single Player)

- Reverse direction blocked (can't 180°)
- One input per tick (first valid key wins)
- Input buffered until next tick

### No Pause in Multiplayer

- Spacebar does NOT pause during multiplayer gameplay
- Prevents abuse (pausing to disrupt opponent)
- Tab blur does NOT auto-pause (opponent keeps playing)

## Disconnect Handling

### Mid-Game Disconnect

| Scenario | Result |
|----------|--------|
| Player disconnects | **Forfeit** — opponent wins immediately |
| Host closes browser | Guest sees "Host disconnected" → wins |
| Guest closes browser | Host sees "Opponent disconnected" → wins |
| Network interruption | 5-second grace period, then forfeit |

### Disconnect UI

```
┌─────────────────────────────────┐
│                                 │
│     OPPONENT DISCONNECTED       │
│                                 │
│          YOU WIN!               │
│                                 │
│     Your Score: 15              │
│                                 │
│        [ MAIN MENU ]            │
│                                 │
└─────────────────────────────────┘
```

### Waiting Room Disconnect

- If guest never connects, host can cancel anytime
- If host cancels while guest is connecting, guest sees "Host cancelled"

## Debug Features

### Latency Indicator

Hidden by default. Activated by key combo (e.g., `Ctrl+Shift+L`):

```
┌─────────────────────────────────┐
│ PING: 45ms ●                    │  ← Green dot = good
│ P1: 5         LEVEL 2     P2: 3 │
│ ...                             │
```

| Latency | Indicator |
|---------|-----------|
| < 50ms | 🟢 Green |
| 50-100ms | 🟡 Yellow |
| > 100ms | 🔴 Red |

## Browser Compatibility

### Requirements

| Feature | Minimum Support |
|---------|-----------------|
| WebRTC DataChannels | Chrome 56+, Firefox 52+, Safari 11+, Edge 79+ |
| crypto.getRandomValues | All modern browsers |
| requestAnimationFrame | All modern browsers |

### Unsupported Browser Handling

On page load, check for WebRTC support:
```typescript
const isSupported = typeof RTCPeerConnection !== 'undefined' 
                 && typeof RTCDataChannel !== 'undefined'
```

If unsupported, disable "MULTIPLAYER" button with tooltip: "Multiplayer requires a modern browser with WebRTC support."

## Error Handling

| Scenario | Handling |
|----------|----------|
| PeerJS server unreachable | "Cannot connect to matchmaking server. Try again later." |
| WebRTC fails (NAT/firewall) | Show troubleshooting message (see Connection Failure) |
| Desync detected | Log error, continue (lockstep should prevent this) |
| Invalid message received | Ignore, log warning |
| Opponent sends impossible input | Ignore (anti-cheat minimal, trust-based) |
| Message not valid JSON | Ignore, log warning, increment error counter |
| Error counter > 10 in 5 seconds | Disconnect with "Connection unstable" |
| Tick number mismatch | Log desync warning, resync to higher tick number |

## Implementation Notes

### New Files (Suggested)

```
src/
├── constants.ts          # Add: MP grid size, player colors
├── types.ts              # Add: multiplayer types, messages
├── components/
│   ├── Game.tsx          # Modify: support both modes
│   ├── MainMenu.tsx      # NEW: mode selection
│   ├── WaitingRoom.tsx   # NEW: host waiting screen
│   └── MultiplayerHUD.tsx # NEW: dual-player HUD
├── hooks/
│   ├── useGameLoop.ts    # Modify: multiplayer tick logic
│   └── usePeerConnection.ts # NEW: PeerJS wrapper
└── utils/
    ├── game.ts           # Modify: 2-player collision, starvation
    ├── network.ts        # NEW: message serialization
    └── random.ts         # NEW: seeded random for determinism
```

### Dependencies to Add

```json
{
  "dependencies": {
    "peerjs": "^1.5.2"
  }
}
```

### Key Implementation Challenges

1. **Deterministic random**: Food spawning must use seeded PRNG shared at game start
2. **Tick synchronization**: Both clients must process same tick before advancing
3. **Input ordering**: Always process P1 input before P2 for consistency
4. **Hunger timer sync**: Must be deterministic (based on tick count, not real time)

### Performance Considerations

| Concern | Mitigation |
|---------|------------|
| JSON parse/stringify every tick | Use simple format: `"T:42:R"` (tick:number:direction) instead of full JSON |
| Object allocation per tick | Reuse message objects, avoid `new` in hot path |
| Lockstep latency | At 200ms RTT, accept 100ms input delay; game still playable |
| Canvas redraw | Only redraw changed cells, not full canvas (optimization) |
| GC pauses | Use object pools for snake segments if stuttering observed |

**Acceptable Latency Threshold**: Target <100ms RTT for smooth experience. At >200ms, display latency warning indicator.

## Out of Scope

- Mobile / touch support
- More than 2 players
- Spectator mode
- Text chat
- Sound effects
- TURN relay fallback
- Account system / persistent stats
- Matchmaking / public lobbies
- Different game modes (co-op, teams)
