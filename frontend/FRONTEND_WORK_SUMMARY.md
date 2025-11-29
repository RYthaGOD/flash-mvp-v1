## Frontend Work Summary (UI & Flow)

### High-level changes
- **Rebranded UI**: Updated main brand from "FLASH Bridge" to **"Flash"** in the header.
- **New layout**: Replaced the old centered card + gradient background with a dark, app-style layout:
  - Background: `#0a0a0a`
  - Process modal background: `#171717`
  - Accent / hover color: `#a4e977`
- **Custom font**: Added `PolySans Neutral.ttf` (under `src/assets`) and wired it via `src/styles/fonts.css` and `index.css`.

### New main flow (`TabbedInterface` + `BridgeFlow`)

#### 1. Header & navigation (`TabbedInterface.js` / `TabbedInterface.css`)
- Created a sticky top header similar to a DEX UI:
  - **Logo**: `Flash` (left).
  - **Nav buttons**: `Bridge`, `Portfolio`, `History` (center, non-functional for now).
  - **Actions (right)**:
    - Solana balance pill showing `SOL` balance when wallet is connected.
    - Solana `WalletMultiButton` for connect/disconnect.
- Wallet connect is now *always visible* in the header instead of inside the content.
- Main content area renders the new `BridgeFlow` component.

#### 2. Three‑screen bridge experience (`BridgeFlow.js` / `BridgeFlow.css`)

**Screen 1 – Generate BTC Wallet**
- Card: “Generate Bitcoin Wallet – Create a testnet wallet to bridge BTC”.
- Primary button: **Generate BTC Wallet**.
- On click:
  - Uses `TestnetWalletGenerator` (`src/utils/wallet-generator/index.js`, which internally uses `bitcoin-testnet.js`) to generate a **Bitcoin testnet wallet**.
  - Shows loading state with a circular **loading roller** animation and “Generating secure wallet...” text.
  - On success, stores the generated BTC wallet in state and transitions to **Screen 2**.
  - On error, shows a red error box with a dismiss button.

**Screen 2 – Input Form (Bridge configuration)**
- Shows the generated **BTC address** in a card with:
  - Label + monospace address.
  - **Copy** button using `navigator.clipboard.writeText`.
- Form fields:
  - **BTC Amount** (number input with 8 decimal support).
  - **Bitcoin Transaction Hash** (text input).
- Validations:
  - Amount > 0 required.
  - BTC transaction hash required.
  - Solana wallet must be connected (`useWallet`).
- Buttons:
  - **Back** (returns to Screen 1, keeps styling/state consistent).
  - **Start Bridge** (disabled until amount, tx hash, and wallet connection are present).
- On **Start Bridge**, moves to Screen 3 and triggers `startBridgeProcess()` – this is where the backend call happens.

**Screen 3 – Backend Process Modal**
- Full‑screen dark overlay with centered modal (`process-modal`), background `#171717`.
- Displays a vertical **stepper** showing the bridge pipeline:
  1. Verifying BTC Transaction
  2. Shielding to Zcash
  3. Encrypting with Arcium MPC
  4. Minting zenZEC on Solana
  5. Completing Bridge
- Each step has:
  - Circle indicator (number / spinner / check / error).
  - Step name.
  - Optional completion timestamp.
- The steps animate in sequence with small delays using `await delay(...)` to simulate progress.
- Real backend call:
  - `axios.post(`${API_URL}/api/bridge/`, { solanaAddress, bitcoinTxHash, amount, swapToSol:false })`.
  - On success, logs result to console (UI can be extended to show a success screen).
  - On error, marks the active step as `error` and shows an error box with “Start Over”.
- Close / reset:
  - `×` button in modal header calls `resetFlow()` → returns to Screen 1 and clears state.

### Styling & theme

- **Global styles (`index.css`)**
  - Imports `fonts.css` and sets `body` to:
    - Font: `PolySans` (with system fallbacks).
    - Background: `#0a0a0a`.
    - Base text color: `#ffffff`.

- **Buttons**
  - Primary button (`.primary-btn`):
    - Background: `#a4e977`, text `#0a0a0a`.
    - Rounded corners (12px), bold text.
    - Hover: slightly darker green with small upward translate and shadow.
  - Secondary button (`.secondary-btn`):
    - Transparent with green border, subtle hover background.

- **Wallet button**
  - Global override in `App.css` for `.wallet-adapter-button` to match the green primary style, with hover elevation.

### Bitcoin wallet generator (`bitcoin-testnet.js`)

- **Current state**:
  - File is reset to a **simple, static initialization**:
    - Imports `bitcoinjs-lib`, `ecpair`, and `@noble/secp256k1`.
    - Calls `bitcoin.initEccLib(secp256k1)` once at module load.
    - Creates `ECPair` via `ECPairFactory(secp256k1)`.
    - `generateWallet()`:
      - `ECPair.makeRandom({ network: bitcoin.networks.testnet })`.
      - Derives P2WPKH (`tb1...`) address and WIF.
  - Known issue: on some setups, `bitcoin.initEccLib(secp256k1)` can still throw `ecc library invalid`. If that happens, it’s purely a **frontend crypto library mismatch**, not related to the backend or MXE.

### Known issues / next steps

- **Wallet generation ECC error**:
  - Occasional `ecc_lib.js: Error: ecc library invalid` when initializing ECC.
  - Root cause: `bitcoinjs-lib` v6 expects a specific ECC interface; `@noble/secp256k1` sometimes needs an adapter.
  - For now, we’ve reverted `bitcoin-testnet.js` to the original simple version to keep the code understandable. Further work is needed to:
    - Either use an officially supported ECC adapter, or
    - Pin `bitcoinjs-lib` / `@noble/secp256k1` versions known to work together.

- **Backend dependency**:
  - The frontend bridge flow **does call** the backend (`POST /api/bridge/` and `GET /api/bridge/info` in older code).
  - If the backend on `http://localhost:3001` is not running, the process step for minting zenZEC will fail with `AxiosError` / `ERR_CONNECTION_REFUSED`.

### How to run / test

1. **Start backend** (from `backend/`):
   - `npm install`
   - `npm start`
2. **Start frontend** (from `frontend/`):
   - `npm install --legacy-peer-deps`
   - `npm start`
3. **In the browser**:
   - Connect Solana wallet (Phantom, etc.) via the header button.
   - Click **Generate BTC Wallet**.
   - Copy the generated BTC testnet address to a faucet, fund it, then:
   - Enter **BTC amount** + **BTC tx hash**, click **Start Bridge** to watch the process modal animate through the steps.

This file is meant as a quick handover for teammates so they can understand the new flow, where the main components live, and what’s still flaky (ECC + backend availability).


