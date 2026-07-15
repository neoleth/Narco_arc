/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { X, ArrowDownUp, Camera } from 'lucide-react';
import { ethers } from 'ethers';
import html2canvas from 'html2canvas';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const HUB_CONTRACT_ADDRESS = "0x150D8A7dc747235D65c5d48784f20a913A912334";
const HUB_ABI = [
  "function postGM() external",
  "function getGMInfo(address) view returns (uint256,uint256,bool)",
  "function send(address token, address to, uint256 amount) external",
  "function swap(address tokenIn, uint256 amountIn, uint256 minOut) external",
  "function totalGMs() view returns (uint256)",
  "function getPoolReserves() view returns (uint256, uint256)",
  "function addLiquidity(uint256 usdcAmount, uint256 eurcAmount) external"
];
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
];

export default function App() {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gm' | 'swap' | 'send' | 'circle' | 'history'>('gm');
  const [circleResponse, setCircleResponse] = useState<any>(null);
  const [isCheckingCircle, setIsCheckingCircle] = useState(false);

  interface TxRecord {
    id: string;
    type: string;
    description: string;
    timestamp: number;
    status: 'success' | 'failed';
  }
  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);
  const [usdcBalance, setUsdcBalance] = useState('0.00');
  const [eurcBalance, setEurcBalance] = useState('0.00');

  const addTxToHistory = (type: string, description: string, status: 'success'|'failed') => {
    setTxHistory(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      type,
      description,
      timestamp: Date.now(),
      status
    }, ...prev]);
  };

  const triggerCircleAction = async (actionDesc: string) => {
    try {
      showToast(`🔄 Triggering Circle API for ${actionDesc}`);
      const res = await fetch("/api/circle/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionDesc })
      });
      const data = await res.json();
      if (data.success) {
        showToast('🔵 Circle API Action Logged!');
      } else {
        showToast('⚠️ Circle API Response error');
      }
    } catch {
      showToast('⚠️ Circle API server ping failed');
    }
  };

  const checkCircleAPI = async () => {
    setIsCheckingCircle(true);
    setCircleResponse(null);
    try {
      const res = await fetch("/api/circle/test");
      if (res.headers.get("content-type")?.includes("text/html")) {
        setCircleResponse({ success: false, error: "Received HTML. Server router misconfigured." });
      } else {
        const data = await res.json();
        setCircleResponse(data);
      }
    } catch (err: any) {
      setCircleResponse({ success: false, error: err.message });
    } finally {
      setIsCheckingCircle(false);
    }
  };
  const [gmStats, setGmStats] = useState({ total: 0, streak: 0, longest: 0 });
  const [gmSentToday, setGmSentToday] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [swapFromAmt, setSwapFromAmt] = useState('');
  const [swapToAmt, setSwapToAmt] = useState('');

  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendTokenSelected, setSendTokenSelected] = useState('USDC');
  const [poolReserves, setPoolReserves] = useState({ usdc: 0, eurc: 0 });

  const gmCardRef = useRef<HTMLDivElement>(null);

  const takeScreenshot = async () => {
    if (!gmCardRef.current) return;
    try {
      const canvas = await html2canvas(gmCardRef.current, {
        backgroundColor: '#111318',
        scale: 2,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'narcoarc-gm-streak.png';
      link.href = dataUrl;
      link.click();
      showToast('📸 Screenshot saved!');
    } catch (err) {
      console.error(err);
      showToast('❌ Failed to take screenshot');
    }
  };

  // Fixed mock exchange rate (e.g., 1 USDC = 0.92 EURC)
  const EXCHANGE_RATE = 0.92;

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSwapFromAmt(val);
    if (val && !isNaN(Number(val))) {
      setSwapToAmt((Number(val) * EXCHANGE_RATE).toFixed(2));
    } else {
      setSwapToAmt('');
    }
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSwapToAmt(val);
    if (val && !isNaN(Number(val))) {
      setSwapFromAmt((Number(val) / EXCHANGE_RATE).toFixed(4));
    } else {
      setSwapFromAmt('');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const ensureArcTestnet = async () => {
    if (!window.ethereum) throw new Error("No wallet installed");
    
    const ARC_CHAIN_ID = 5042002;
    const ARC_CHAIN_ID_HEX = '0x' + ARC_CHAIN_ID.toString(16);

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARC_CHAIN_ID_HEX }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: ARC_CHAIN_ID_HEX,
              chainName: 'Arc Testnet',
              rpcUrls: ['https://rpc.testnet.arc.network'],
              nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
            }],
          });
        } catch (addError: any) {
          throw new Error('User rejected network addition: ' + (addError.message || ''));
        }
      } else if (err.code === 4001) {
        throw new Error('User rejected network switch');
      } else {
        console.error("Switch error", err);
      }
    }

    // Give the provider a short moment to sync the state
    await new Promise(resolve => setTimeout(resolve, 500));

    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== ARC_CHAIN_ID) {
       throw new Error(`Expected Arc Testnet but got Chain ID: ${network.chainId}`);
    }
    
    return provider;
  };

  const connectWallet = async (name: string) => {
    if (!window.ethereum) {
      showToast('❌ Wallet not found. Please install MetaMask.');
      setIsWalletModalOpen(false);
      return;
    }

    try {
      const provider = await ensureArcTestnet();
      
      // 2. Request Accounts
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      
      const shortAddr = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
      setWalletAddress(shortAddr);
      setConnected(true);
      setIsWalletModalOpen(false);
      showToast(`✅ Connected to Arc Testnet`);

      // 3. Sync Stats & Reserves & Balances
      const contract = new ethers.Contract(HUB_CONTRACT_ADDRESS, HUB_ABI, signer);
      
      let gotStats = false;
      try {
        const [streak, last, canGMToday] = await contract.getGMInfo(addr);
        const totalGMs = await contract.totalGMs();
        
        setGmStats({
          total: Number(totalGMs),
          streak: Number(streak),
          longest: Number(streak),
        });
        setGmSentToday(!canGMToday);
        gotStats = true;
      } catch (e) {
        console.error("Failed to fetch GM stats:", e);
      }

      try {
        const [rUsdc, rEurc] = await contract.getPoolReserves();
        setPoolReserves({ usdc: Number(ethers.formatUnits(rUsdc, 6)), eurc: Number(ethers.formatUnits(rEurc, 6)) });
      } catch (e) {
        console.error("Failed to fetch pool reserves:", e);
      }

      try {
        // Sync Balances
        const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
        const eurc = new ethers.Contract(EURC_ADDRESS, ERC20_ABI, signer);
        const usdcBal = await usdc.balanceOf(addr);
        const eurcBal = await eurc.balanceOf(addr);
        setUsdcBalance(Number(ethers.formatUnits(usdcBal, 6)).toFixed(2));
        setEurcBalance(Number(ethers.formatUnits(eurcBal, 6)).toFixed(2));
      } catch (e) {
        console.error("Failed to fetch balances:", e);
      }

      if (!gotStats) {
        showToast(`⚠️ Connected, but could not read stats from contract`);
      }

    } catch (error: any) {
      setIsWalletModalOpen(false);
      const msg = error.reason || error.message || 'failed';
      if (msg.includes('User rejected network switch') || error.code === 4001 || msg.includes('User rejected')) {
        showToast(`❌ Wallet connection cancelled.`);
      } else {
        console.error("Connection Error:", error);
        showToast(`❌ Connection failed. ${msg}`);
      }
    }
  };

  const sendGM = async () => {
    if (!connected || !window.ethereum) {
      setIsWalletModalOpen(true);
      return;
    }
    
    try {
      setIsSending(true);

      const provider = await ensureArcTestnet();
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const hub = new ethers.Contract(HUB_CONTRACT_ADDRESS, HUB_ABI, signer);

      const tx = await hub.postGM();
      showToast('⏳ TX Pending...');
      await tx.wait();

      const [streak, last, canGMToday] = await hub.getGMInfo(addr);
      const totalGMs = await hub.totalGMs();

      setGmStats({
        total: Number(totalGMs),
        streak: Number(streak),
        longest: Number(streak),
      });
      setGmSentToday(!canGMToday);
      
      showToast('🌅 GM sent on-chain!');
      addTxToHistory('gm', 'Daily GM Sent', 'success');
      await triggerCircleAction('GM Posted');
    } catch (error: any) {
      const msg = error.reason || error.message || '';
      if (msg.includes('User rejected network switch') || error.code === 4001 || msg.includes('User rejected')) {
        showToast('❌ Transaction cancelled.');
      } else {
        console.error(error);
        showToast(`❌ Transaction failed or rejected.`);
        addTxToHistory('gm', 'Daily GM Failed', 'failed');
      }
    } finally {
      setIsSending(false);
    }
  };

  const flipSwap = () => {
    const tempFrom = swapFromAmt;
    setSwapFromAmt(swapToAmt);
    setSwapToAmt(tempFrom);
  };

  const executeSwap = async () => {
    if (!connected || !window.ethereum) {
      setIsWalletModalOpen(true);
      return;
    }
    if (!swapFromAmt || Number(swapFromAmt) <= 0) {
      showToast('❌ Enter an amount to swap');
      return;
    }
    
    setIsSwapping(true);
    try {
      const provider = await ensureArcTestnet();
      const signer = await provider.getSigner();
      
      showToast('⏳ Approving tokens...');
      
      // Swap is USDC -> EURC. We need the ERC20 approve
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);

      // ERC20 interface uses 6 decimals
      const amountIn = ethers.parseUnits(swapFromAmt.toString(), 6);
      
      const approveTx = await usdc.approve(HUB_CONTRACT_ADDRESS, amountIn);
      await approveTx.wait();

      showToast('⏳ Swapping on-chain...');
      const hub = new ethers.Contract(HUB_CONTRACT_ADDRESS, HUB_ABI, signer);
      const tx = await hub.swap(USDC_ADDRESS, amountIn, 0);
      await tx.wait();
      
      showToast(`✅ Successfully swapped on-chain!`);
      setSwapFromAmt('');
      setSwapToAmt('');
      addTxToHistory('swap', `Swapped ${swapFromAmt} USDC for EURC`, 'success');
      
      // Update balances
      const eurc = new ethers.Contract(EURC_ADDRESS, ERC20_ABI, signer);
      setUsdcBalance(Number(ethers.formatUnits(await usdc.balanceOf(signer.getAddress()), 6)).toFixed(2));
      setEurcBalance(Number(ethers.formatUnits(await eurc.balanceOf(signer.getAddress()), 6)).toFixed(2));

      await triggerCircleAction('Token Swap');
    } catch(error: any) {
      const msg = error.reason || error.message || 'Rejected';
      if (msg.includes('User rejected network switch') || error.code === 4001 || msg.includes('User rejected')) {
        showToast(`❌ Swap cancelled.`);
      } else {
        console.error(error);
        showToast(`❌ Swap failed: ${msg}`);
        addTxToHistory('swap', `Swap Failed: ${msg.substring(0, 20)}...`, 'failed');
      }
    } finally {
      setIsSwapping(false);
    }
  };

  const executeSend = async () => {
    if (!connected || !window.ethereum) {
      setIsWalletModalOpen(true);
      return;
    }
    if (!ethers.isAddress(sendRecipient)) {
      showToast('❌ Invalid recipient address');
      return;
    }
    if (!sendAmount || Number(sendAmount) <= 0) {
      showToast('❌ Enter a valid amount');
      return;
    }

    try {
      setIsTransferring(true);

      const provider = await ensureArcTestnet();
      const signer = await provider.getSigner();
      
      showToast('⏳ Approving tokens...');
      
      const tokenAddress = sendTokenSelected === "EURC" ? EURC_ADDRESS : USDC_ADDRESS;
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      
      // 6 decimals for ERC20
      const amount = ethers.parseUnits(sendAmount.toString(), 6);

      const approveTx = await token.approve(HUB_CONTRACT_ADDRESS, amount);
      await approveTx.wait();

      showToast('⏳ Transferring on-chain...');
      const hub = new ethers.Contract(HUB_CONTRACT_ADDRESS, HUB_ABI, signer);
      const tx = await hub.send(tokenAddress, sendRecipient, amount);
      await tx.wait();
      
      showToast('✅ Transfer confirmed on Arc Testnet!');
      setSendAmount('');
      setSendRecipient('');
      
      addTxToHistory('send', `Sent ${sendAmount} ${sendTokenSelected}`, 'success');

      // Update balances
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
      const eurc = new ethers.Contract(EURC_ADDRESS, ERC20_ABI, signer);
      setUsdcBalance(Number(ethers.formatUnits(await usdc.balanceOf(signer.getAddress()), 6)).toFixed(2));
      setEurcBalance(Number(ethers.formatUnits(await eurc.balanceOf(signer.getAddress()), 6)).toFixed(2));

      await triggerCircleAction(`Token Transfer (${sendTokenSelected})`);
    } catch (error: any) {
      const msg = error.reason || error.message || 'Rejected';
      if (msg.includes('User rejected network switch') || error.code === 4001 || msg.includes('User rejected')) {
        showToast(`❌ Transfer cancelled.`);
      } else {
        console.error(error);
        showToast(`❌ Transfer failed: ${msg}`);
        addTxToHistory('send', `Transfer Failed: ${msg.substring(0, 20)}...`, 'failed');
      }
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-[-1] bg-stars"></div>
      
      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-8 h-[72px] border-b border-white/[0.08] bg-[#030610]/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad-a" x1="50" y1="10" x2="50" y2="90" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#b53cff" />
                  <stop offset="100%" stopColor="#00f0ff" />
                </linearGradient>
                <linearGradient id="grad-arc" x1="10" y1="80" x2="90" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#00f0ff" />
                  <stop offset="100%" stopColor="#b53cff" />
                </linearGradient>
              </defs>
              
              {/* Outer Ring */}
              <path d="M 45 10 A 40 40 0 0 0 12 50 A 40 40 0 0 0 20 76" stroke="#b53cff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
              <path d="M 55 10 A 40 40 0 0 1 88 50 A 40 40 0 0 1 80 76" stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />

              {/* The "A" shape */}
              <path d="M 50 15 L 20 80 Q 50 65 80 80 Z" fill="url(#grad-a)" />
              
              {/* The swoosh/arc at the bottom */}
              <path d="M 12 84 Q 50 64 88 84 Q 50 72 12 84 Z" fill="url(#grad-arc)" />

              {/* The Star inside */}
              <path d="M 50 48 Q 50 56 58 56 Q 50 56 50 64 Q 50 56 42 56 Q 50 56 50 48 Z" fill="#FFFFFF" opacity="0.9" />
            </svg>
          </div>
          <div className="flex flex-col justify-center">
            <span className="tracking-[0.1em] uppercase text-[18px] leading-[1.1] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#b53cff] to-[#00f0ff]">
              NARCOARC
            </span>
            <span className="text-[7px] tracking-[0.2em] text-[#00f0ff] uppercase font-bold mt-[2px] opacity-80">
              Build • Connect • Transfer
            </span>
          </div>
        </div>
        <div className="flex items-center gap-[16px]">
          <div className="bg-[#1e2535] border border-white/[0.1] rounded-[20px] px-3 py-1.5 text-[11px] font-semibold text-[#00f0ff] uppercase tracking-wide hidden sm:block">
            Testnet Phase 2
          </div>
          <div
            className="bg-[#111318] border border-[#00f0ff]/20 rounded-[12px] px-3 py-1.5 text-[14px] font-semibold text-[#f0f2f7] cursor-pointer flex items-center gap-2 hover:border-[#00f0ff]/40 hover:shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-all"
            onClick={() => setIsWalletModalOpen(true)}
          >
            <div className="w-[20px] h-[20px] rounded-full bg-[#22c55e] flex-shrink-0"></div>
            <span className="hidden sm:inline">Arc Testnet</span>
          </div>
          <button
            className={`rounded-[10px] px-5 py-2.5 text-[13px] font-semibold transition-all shadow-lg
              ${connected 
                ? 'bg-[#181c24] border border-[#b53cff]/20 text-[#f0f2f7] hover:bg-[#181c24]/80 hover:shadow-[0_0_15px_rgba(181,60,255,0.2)]' 
                : 'bg-gradient-to-br from-[#b53cff] to-[#00f0ff] text-[#030610] hover:opacity-90 border-none'
              }
            `}
            onClick={() => setIsWalletModalOpen(true)}
          >
            {connected ? walletAddress : 'Connect Wallet'}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div className="text-center pt-16 px-5 pb-10">
        <div className="inline-block relative">
          <div className="absolute inset-0 bg-[#00f0ff] blur-[40px] opacity-20 rounded-full"></div>
          <h1 className="relative text-[52px] sm:text-[64px] m-0 font-bold tracking-[0.05em] text-transparent bg-clip-text bg-gradient-to-r from-[#b53cff] via-[#7d6aff] to-[#00f0ff] mb-2 uppercase hud-border p-4">
            NARCOARC
          </h1>
        </div>
        <p className="text-[#00f0ff]/80 text-[14px] sm:text-[16px] mt-4 font-mono uppercase tracking-[0.15em]">Build • Connect • Transfer</p>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mx-auto mb-[32px] bg-[#030610]/80 border border-white/[0.05] backdrop-blur-md rounded-xl p-1 w-full max-w-[600px] relative z-10 shadow-[0_0_20px_rgba(0,240,255,0.05)]">
        <button
          className={`flex-1 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${activeTab === 'gm' ? 'bg-[#b53cff]/10 border border-[#b53cff]/30 text-white shadow-[0_0_15px_rgba(181,60,255,0.2)]' : 'text-[#7a8099] hover:text-[#00f0ff] bg-transparent'}`}
          onClick={() => setActiveTab('gm')}
        >
          Daily GM
        </button>
        <button
          className={`flex-1 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${activeTab === 'swap' ? 'bg-gradient-to-r from-[#b53cff]/10 to-[#00f0ff]/10 border border-[#00f0ff]/30 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'text-[#7a8099] hover:text-[#00f0ff] bg-transparent'}`}
          onClick={() => setActiveTab('swap')}
        >
          Swap
        </button>
        <button
          className={`flex-1 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${activeTab === 'send' ? 'bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-white shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'text-[#7a8099] hover:text-[#00f0ff] bg-transparent'}`}
          onClick={() => setActiveTab('send')}
        >
          Send
        </button>
        <button
          className={`flex-1 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${activeTab === 'circle' ? 'bg-white/10 border border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'text-[#7a8099] hover:text-white bg-transparent'}`}
          onClick={() => setActiveTab('circle')}
        >
          Circle API
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-[600px] mx-auto px-4 pb-12 w-full">
        {/* GM CARD */}
        {activeTab === 'gm' && (
          <div ref={gmCardRef} className="bg-[#030610]/80 backdrop-blur-md border border-[#b53cff]/30 rounded-[24px] p-8 shadow-[0_0_40px_rgba(181,60,255,0.15)] relative overflow-hidden hud-border">
            
            {/* Screenshot Button */}
            <button
               onClick={takeScreenshot}
               className="absolute top-4 right-4 bg-[#181c24] border border-[#00f0ff]/30 p-2 rounded-full text-[#00f0ff] hover:text-white hover:bg-[#00f0ff]/20 hover:shadow-[0_0_10px_rgba(0,240,255,0.5)] transition-all z-20"
               title="Take Screenshot"
            >
              <Camera size={18} />
            </button>

            <div className="text-lg font-semibold mb-1.5 hidden">Daily GM</div>
            <div className="text-[13px] text-[#7a8099] mb-6 hidden">Send a daily GM on-chain to maintain your streak and earn rewards!</div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#030610] border border-[#b53cff]/20 rounded-xl p-4 text-center shadow-[inset_0_0_20px_rgba(181,60,255,0.05)]">
                <div className="text-[11px] text-[#b53cff] mb-1.5 uppercase tracking-widest font-mono">Total GMs</div>
                <div className="text-2xl font-bold text-white">{gmStats.total}</div>
              </div>
              <div className="bg-[#030610] border border-[#00f0ff]/20 rounded-xl p-4 text-center shadow-[inset_0_0_20px_rgba(0,240,255,0.05)]">
                <div className="text-[11px] text-[#00f0ff] mb-1.5 uppercase tracking-widest font-mono">Streak</div>
                <div className="text-2xl font-bold text-white">{gmStats.streak}</div>
              </div>
              <div className="bg-[#030610] border border-white/10 rounded-xl p-4 text-center">
                <div className="text-[11px] text-[#7a8099] mb-1.5 uppercase tracking-widest font-mono">Longest</div>
                <div className="text-2xl font-bold text-white">{gmStats.longest}</div>
              </div>
            </div>
            {!connected ? (
              <button
                className="w-full bg-gradient-to-r from-[#b53cff] to-[#00f0ff] rounded-[14px] p-4 text-[15px] font-bold text-[#030610] mt-6 mb-5 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:opacity-90 transition-opacity uppercase tracking-wider"
                onClick={() => setIsWalletModalOpen(true)}
              >
                Connect Wallet
              </button>
            ) : (
              <button
                className={`w-full rounded-[14px] p-4 text-[15px] font-bold mt-6 mb-5 transition-all uppercase tracking-wider
                  ${gmSentToday 
                    ? 'bg-[#181c24] text-[#7a8099] border border-white/[0.08] cursor-not-allowed' 
                    : isSending 
                      ? 'bg-gradient-to-r from-[#b53cff] to-[#00f0ff] opacity-70 text-[#030610] cursor-wait'
                      : 'bg-gradient-to-r from-[#b53cff] to-[#00f0ff] text-[#030610] shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:opacity-90'}
                `}
                onClick={sendGM}
                disabled={gmSentToday || isSending}
              >
                {gmSentToday ? '✓ GM Sent Today!' : isSending ? 'Sending...' : '🌅 Send GM'}
              </button>
            )}
            <div className="h-px bg-gradient-to-r from-transparent via-[#00f0ff]/30 to-transparent my-5"></div>
            <div className="flex justify-between items-center text-[13px] py-1.5">
              <span className="text-[#7a8099]">Network</span>
              <span className="font-medium flex items-center gap-1.5">
                <span className="bg-gradient-to-br from-[#4f8ef7] to-[#7c5cfc] text-white text-[10px] font-bold rounded-md px-2 py-0.5">Arc</span>
                Arc Testnet
              </span>
            </div>
            <div className="flex justify-between items-center text-[13px] py-1.5">
              <span className="text-[#7a8099]">Chain ID</span>
              <span className="font-medium">5042002</span>
            </div>
            <div className="flex justify-between items-center text-[13px] py-1.5">
              <span className="text-[#7a8099]">Gas Token</span>
              <span className="font-medium">USDC</span>
            </div>
          </div>
        )}

        {/* SWAP CARD */}
        {activeTab === 'swap' && (
          <div className="bg-[#030610]/80 backdrop-blur-md border border-[#00f0ff]/30 rounded-[24px] p-8 shadow-[0_0_40px_rgba(0,240,255,0.1)] relative hud-border">
            <div className="text-lg font-semibold mb-1.5 hidden">Swap</div>
            <div className="text-[13px] text-[#7a8099] mb-4 hidden">Swap tokens on Narcoarc</div>
            
            <div className="bg-[#181c24] border border-white/[0.08] rounded-[16px] p-4 mb-3">
              <div className="flex justify-between text-[#7a8099] text-[12px] mb-2">
                <span>From</span>
                <span>Balance: {connected ? usdcBalance : '0.00'} USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  placeholder="0.0"
                  className="bg-transparent border-none text-[24px] font-bold text-white w-[50%] outline-none"
                  value={swapFromAmt}
                  onChange={handleFromChange}
                />
                <button className="bg-[#1e2535] border border-white/[0.05] rounded-xl px-3 py-1.5 text-[14px] font-semibold flex items-center gap-2 transition-colors">
                  <div className="w-5 h-5 rounded-full bg-[#22c55e]"></div>
                  USDC
                </button>
              </div>
            </div>
            
            <div className="flex justify-center -my-6 relative z-10 pointer-events-none">
              <button
                className="bg-[#181c24] border border-white/[0.08] hover:border-white/[0.2] rounded-full w-9 h-9 flex items-center justify-center transition-all mx-auto text-[#7a8099] cursor-pointer pointer-events-auto shadow-md"
                onClick={flipSwap}
              >
                <ArrowDownUp size={16} />
              </button>
            </div>
            
            <div className="bg-[#181c24] border border-white/[0.08] rounded-[16px] p-4 mb-2 mt-3">
              <div className="flex justify-between text-[#7a8099] text-[12px] mb-2">
                <span>To (Estimated)</span>
                <span>Balance: {connected ? eurcBalance : '0.00'} EURC</span>
              </div>
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  placeholder="0.0"
                  className="bg-transparent border-none text-[24px] font-bold text-white w-[50%] outline-none"
                  value={swapToAmt}
                  onChange={handleToChange}
                />
                <button className="bg-[#1e2535] border border-white/[0.05] rounded-xl px-3 py-1.5 text-[14px] font-semibold flex items-center gap-2 transition-colors">
                  <div className="w-5 h-5 rounded-full bg-[#ec4899]"></div>
                  EURC
                </button>
              </div>
            </div>
            
            <button
              className={`mt-6 w-full shadow-[0_10px_20px_rgba(79,142,247,0.2)] rounded-[14px] p-4 text-[15px] font-bold text-white transition-all
                ${isSwapping ? 'bg-gradient-to-br from-[#4f8ef7] to-[#7c5cfc] opacity-70 cursor-wait' : 'bg-gradient-to-br from-[#4f8ef7] to-[#7c5cfc] hover:opacity-90'}
              `}
              onClick={executeSwap}
              disabled={isSwapping}
            >
              {isSwapping ? 'Swapping...' : connected ? 'Swap Tokens' : 'Connect Wallet to Swap'}
            </button>
            
            <div className="mt-6 border-t border-white/[0.08] pt-4">
              <div className="flex justify-between text-[12px] py-1">
                <span className="text-[#7a8099]">Price Impact</span>
                <span className="text-white font-medium">&lt; 0.01%</span>
              </div>
              <div className="flex justify-between text-[12px] py-1">
                <span className="text-[#7a8099]">Network Fee</span>
                <span className="text-white font-medium">0.3% pool fee</span>
              </div>
              <div className="flex justify-between text-[12px] py-1">
                <span className="text-[#7a8099]">Minimum Received</span>
                <span className="text-white font-medium">{swapToAmt ? (Number(swapToAmt) * 0.99).toFixed(4) : "0.00"} EURC</span>
              </div>
            </div>
          </div>
        )}

        {/* SEND CARD */}
        {activeTab === 'send' && (
          <div className="bg-[#030610]/80 backdrop-blur-md border border-[#b53cff]/30 rounded-[24px] p-8 shadow-[0_0_40px_rgba(181,60,255,0.1)] relative hud-border">
            <div className="text-lg font-semibold mb-1.5 hidden">Send Tokens</div>
            <div className="text-[13px] text-[#7a8099] mb-6 hidden">Transfer tokens to any address on Narcoarc</div>
            
            <div className="mb-4">
              <div className="text-[12px] text-[#7a8099] mb-2">Recipient Address</div>
              <input
                type="text"
                placeholder="0x..."
                className="w-full bg-[#181c24] border border-white/[0.08] focus:border-[#4f8ef7] rounded-[16px] px-4 py-3.5 text-sm text-white font-medium outline-none transition-colors"
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
              />
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between text-[12px] text-[#7a8099] mb-2">
                <span>Amount</span>
                <span>Balance: {connected ? (sendTokenSelected === 'USDC' ? usdcBalance : eurcBalance) : '0.00'} {sendTokenSelected}</span>
              </div>
              <input
                type="number"
                placeholder="0.0"
                className="w-full bg-[#181c24] border border-white/[0.08] focus:border-[#4f8ef7] rounded-[16px] px-4 py-3.5 text-sm text-white font-medium outline-none transition-colors"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
              />
            </div>
            
            <div className="mb-6">
              <div className="text-[12px] text-[#7a8099] mb-2">Token</div>
              <select 
                className="w-full bg-[#181c24] border border-white/[0.08] focus:border-[#4f8ef7] rounded-[16px] px-4 py-3.5 text-sm text-white font-medium outline-none transition-colors cursor-pointer appearance-none"
                value={sendTokenSelected}
                onChange={(e) => setSendTokenSelected(e.target.value)}
              >
                <option value="USDC">USDC (6 Decimals)</option>
                <option value="EURC">EURC (6 Decimals)</option>
              </select>
            </div>
            
            <button
              className={`mt-2 w-full rounded-[14px] p-4 text-[15px] font-bold mt-6 mb-5 transition-all uppercase tracking-wider
                ${isTransferring 
                  ? 'bg-gradient-to-r from-[#b53cff] to-[#00f0ff] opacity-70 text-[#030610] cursor-wait' 
                  : 'bg-gradient-to-r from-[#b53cff] to-[#00f0ff] text-[#030610] shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:opacity-90'}
              `}
              onClick={executeSend}
              disabled={isTransferring}
            >
              {isTransferring ? 'Broadcasting...' : connected ? 'Send Tokens' : 'Connect Wallet to Send'}
            </button>
          </div>
        )}

        {/* CIRCLE API CARD */}
        {activeTab === 'circle' && (
          <div className="bg-[#030610]/80 backdrop-blur-md border border-white/20 rounded-[24px] p-8 shadow-[0_0_40px_rgba(255,255,255,0.05)] relative hud-border">
            <h2 className="text-xl font-bold mb-2">Circle API Status</h2>
            <p className="text-[13px] text-[#7a8099] mb-6">
              Test your connection and key with Circle's Web3 Services API.
            </p>

            <button
              className={`w-full rounded-[14px] p-4 text-[15px] font-bold mt-6 mb-5 transition-all uppercase tracking-wider
                ${isCheckingCircle 
                  ? 'bg-gradient-to-r from-white/80 to-white/60 opacity-70 text-[#030610] cursor-wait' 
                  : 'bg-gradient-to-r from-white to-white/80 text-[#030610] shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:opacity-90'}
              `}
              onClick={checkCircleAPI}
              disabled={isCheckingCircle}
            >
              {isCheckingCircle ? 'Checking API...' : 'Ping Circle API'}
            </button>

            {circleResponse && (
              <div className="mt-6 p-4 bg-[#0a0c10] border border-white/[0.05] rounded-[16px] overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${circleResponse.success ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}></div>
                  <div className="text-[14px] font-semibold">
                    {circleResponse.success ? 'Connected successfully' : 'Connection failed'}
                  </div>
                </div>
                <pre className="text-[11px] text-[#7a8099] overflow-x-auto p-2 bg-[#181c24] rounded-lg">
                  {JSON.stringify(circleResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex justify-center gap-6 pb-8 text-xs text-[#00f0ff] uppercase tracking-wider opacity-60">
        <a href="#" className="hover:text-white hover:opacity-100 transition-all">Arc Network</a>
        <a href="#" className="hover:text-white hover:opacity-100 transition-all">Developer</a>
      </div>

      {/* WALLET / PROFILE MODAL */}
      {isWalletModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsWalletModalOpen(false);
          }}
        >
          <div className="bg-[#111318] border border-white/[0.12] rounded-[20px] p-7 w-[340px] max-w-full relative shadow-2xl">
            {connected ? (
              <>
                <div className="flex justify-between items-center mb-5">
                  <div className="text-[17px] font-semibold">Profile</div>
                  <button
                    className="text-[#7a8099] hover:text-[#f0f2f7] transition-colors"
                    onClick={() => setIsWalletModalOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="mb-5">
                  <div className="text-[12px] text-[#7a8099] mb-1">Connected Address</div>
                  <div className="text-sm font-medium">{walletAddress}</div>
                </div>

                <div className="bg-[#181c24] border border-white/[0.08] rounded-[16px] p-4 mb-5">
                  <div className="text-[12px] text-[#7a8099] mb-3">Balances</div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">USDC</span>
                    <span className="font-medium text-[#22c55e]">{usdcBalance}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">EURC</span>
                    <span className="font-medium text-[#ec4899]">{eurcBalance}</span>
                  </div>
                </div>

                <div>
                  <div className="text-[12px] text-[#7a8099] mb-3 flex items-center justify-between">
                    <span>Recent Activity</span>
                  </div>
                  {txHistory.length === 0 ? (
                    <div className="text-[12px] text-center text-[#7a8099] py-4 bg-[#181c24]/50 rounded-xl">No recent transactions</div>
                  ) : (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                      {txHistory.map(tx => (
                        <div key={tx.id} className="bg-[#181c24] border border-white/[0.05] rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <div className="text-[13px] font-medium mb-0.5">{tx.description}</div>
                            <div className="text-[10px] text-[#7a8099]">{new Date(tx.timestamp).toLocaleTimeString()}</div>
                          </div>
                          <div className={`text-[11px] font-bold px-2 py-1 rounded-md ${tx.status === 'success' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-red-500/10 text-red-500'}`}>
                            {tx.status.toUpperCase()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => { setConnected(false); setIsWalletModalOpen(false); setWalletAddress(null); }}
                  className="w-full mt-6 py-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-colors"
                >
                  Disconnect Wallet
                </button>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="text-[17px] font-semibold">Connect a Wallet</div>
                  <button
                    className="text-[#7a8099] hover:text-[#f0f2f7] transition-colors"
                    onClick={() => setIsWalletModalOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="text-[13px] text-[#7a8099] mb-5">Choose your wallet to connect to Arc Testnet</div>
                
                <div
                  className="flex items-center gap-3 p-3.5 border border-white/[0.08] hover:border-[#4f8ef7] hover:bg-[#4f8ef7]/10 rounded-xl mb-2.5 cursor-pointer transition-all"
                  onClick={() => connectWallet('MetaMask')}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#f6851b]/10 flex items-center justify-center text-[18px]">🦊</div>
                  <div>
                    <div className="text-sm font-medium">MetaMask</div>
                    <div className="text-[11px] text-[#7a8099]">Popular browser extension wallet</div>
                  </div>
                </div>
                
                <div
                  className="flex items-center gap-3 p-3.5 border border-white/[0.08] hover:border-[#4f8ef7] hover:bg-[#4f8ef7]/10 rounded-xl mb-2.5 cursor-pointer transition-all"
                  onClick={() => connectWallet('WalletConnect')}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#3b99fc]/10 flex items-center justify-center text-[18px]">🔗</div>
                  <div>
                    <div className="text-sm font-medium">WalletConnect</div>
                    <div className="text-[11px] text-[#7a8099]">Scan with any mobile wallet</div>
                  </div>
                </div>
                
                <div
                  className="flex items-center gap-3 p-3.5 border border-white/[0.08] hover:border-[#4f8ef7] hover:bg-[#4f8ef7]/10 rounded-xl cursor-pointer transition-all"
                  onClick={() => connectWallet('Coinbase Wallet')}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#0052ff]/10 flex items-center justify-center text-[18px]">🔵</div>
                  <div>
                    <div className="text-sm font-medium">Coinbase Wallet</div>
                    <div className="text-[11px] text-[#7a8099]">Connect using Coinbase</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TOAST */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#22c55e] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 z-[999] shadow-xl ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {toastMessage}
      </div>
    </>
  );
}
