# 🚀 Narcoarc

Narcoarc is a Next-Generation Web3 Finance Platform built to interact seamlessly with the **Arc Testnet**. Experience decentralized finance with stablecoins, offering fast and secure actions right from your browser. 

---

## 📌 Features

* **🔗 Wallet Integration:** Easily connect with MetaMask, WalletConnect, or Coinbase Wallet to Arc Testnet.
* **🌅 GM On-Chain:** Post GM transactions on-chain to earn daily streaks and build your on-chain reputation.
* **💱 Token Swap:** Seamlessly swap Testnet USDC to EURC right through the Narcoarc Hub contract.
* **💸 Token Transfer:** Send stablecoins (USDC or EURC) securely to other EVM addresses.
* **📊 Comprehensive Portfolio:** Real-time balances and transaction history sync.
* **🔵 Circle API Integration (W3S):** Logs and verifies on-chain actions directly using Circle's Web3 Services API.
* **📡 Real-time RPC Interactivity:** Interrogates specific smart contracts (`0x150D...`) for accurate smart contract data and pool reserves.

---

## 🛠️ Installation

Clone the repository:

```bash
git clone https://github.com/neoleth/Narco_arc.git
cd Narco_arc
```

Install dependencies:

```bash
npm install
```

Configure Environment variables by creating a `.env` file from the example:
```bash
cp .env.example .env
```
Ensure that `CIRCLE_API_KEY` is present.

---

## ▶️ Usage

Start the development server:

```bash
npm run dev
```
Open `http://localhost:3000` to view the application in your browser.

---

## 🗺️ Smart Contracts & Network

- **Network:** Arc Testnet (`https://rpc.testnet.arc.network`)
- **Hub Contract:** `0x150D8A7dc747235D65c5d48784f20a913A912334`
- **USDC Address:** `0x3600000000000000000000000000000000000000`
- **EURC Address:** `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`

You will need testnet USDC/EURC to interact. Visit [faucet.circle.com](https://faucet.circle.com) to fund your wallet on Arc Testnet.

---

## ⚡ Purpose

Narcoarc serves as a unified hub demonstrating:
* Reliable on-chain stablecoin utility via EVM tooling (`ethers.js`).
* Modern UI/UX patterns for Web3 using React + Tailwind CSS.
* Frictionless Circle API workflows interacting together with smart contract mechanisms.

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a new branch (`feature/your-feature`)
3. Commit your changes
4. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License.

---

## 📬 Contact

For questions or suggestions, feel free to open an issue or reach out.

---

## ⭐ Support

If you find this project useful, don’t forget to give it a ⭐!
