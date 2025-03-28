import "dotenv/config";
import { ethers } from "ethers";
import fetch from "node-fetch";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  CHAIN_ID: 16600,
  RPC_URL: "https://evmrpc-testnet.0g.ai",
  NETWORK_NAME: "0G-Newton-Testnet",
  CURRENCY_SYMBOL: "A0GI",
  TOKENS: {
    USDT: "0x9A87C2412d500343c073E5Ae5394E3bE3874F76b",
    BTC: "0x1e0d871472973c562650e991ed8006549f8cbefc",
    ETH: "0xce830D0905e0f7A9b300401729761579c5FB6bd6",
    A0GI: "0x493eA9950586033eA8894B5E684bb4DF6979A0D3",
  },
  UNISWAP: {
    ROUTER: "0xD86b764618c6E3C078845BE3c3fCe50CE9535Da7",
    FACTORY: "0xe1aAD0bac492F6F46BFE1992080949401e1E90aD",
    QUOTER: "0x8B4f88a752Fd407ec911A716075Ca7809ADdBadd",
  },
  FEE_TIERS: [500, 3000, 10000],
};

const SWAP_DELAY = process.env.SWAP_DELAY || 60;
const MIN_BALANCE_FOR_SWAP = process.env.MIN_BALANCE_FOR_SWAP || "0.1";
const MIN_DELAY = 30;
const MAX_DELAY = 300;

const TOKEN_DECIMALS = {
  USDT: 18,
  BTC: 18,
  ETH: 18,
  A0GI: 18,
};

const AVAILABLE_PAIRS = [
  ["USDT", "BTC"],
  ["USDT", "ETH"],
  ["BTC", "USDT"],
  ["ETH", "USDT"],
];

const GAS_SETTINGS = {
  BASE_FEE: 100000000, // 0.1 gwei
  MAX_FEE: 500000000, // 0.5 gwei
  PRIORITY_FEE: 100000000, // 0.1 gwei
};

const ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
  "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)",
];


const QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

class ZeroGSwapBot {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.router = null;
  }

  async initialize() {
    try {
      const privateKey = process.env.WALLET_PRIVATE_KEY;
      if (!privateKey || privateKey === "your_private_key_here") {
        throw new Error("Invalid PK sir .env file");
      }

      const formattedKey = privateKey.startsWith("0x")
        ? privateKey
        : `0x${privateKey}`;

      this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      this.wallet = new ethers.Wallet(formattedKey, this.provider);
      this.router = new ethers.Contract(
        CONFIG.UNISWAP.ROUTER,
        ROUTER_ABI,
        this.wallet
      );

      console.log(`Inisialisasi selesai dengan dompet: ${this.wallet.address}`);
    } catch (error) {
      console.error("Gagal melakukan inisialisasi:", error.message);
      throw error;
    }
  }

  async checkBalance(token) {
    const tokenAddress = CONFIG.TOKENS[token];
    if (!tokenAddress) {
      throw new Error("Simbol token tidak valid");
    }

    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      this.wallet
    );
    const balance = await tokenContract.balanceOf(this.wallet.address);
    const decimals = await tokenContract
      .decimals()
      .catch(() => TOKEN_DECIMALS[token]);
    console.log(`${token} Balance: ${ethers.formatUnits(balance, decimals)}`);
    return balance;
  }

  async getAllBalances() {
    const balances = {};
    for (const [symbol, address] of Object.entries(CONFIG.TOKENS)) {
      try {
        const contract = new ethers.Contract(address, ERC20_ABI, this.wallet);
        const balance = await contract.balanceOf(this.wallet.address);
        const decimals = await contract
          .decimals()
          .catch(() => TOKEN_DECIMALS[symbol]);

        balances[symbol] = {
          raw: balance,
          formatted: ethers.formatUnits(balance, decimals),
        };
        console.log(`${symbol}: ${balances[symbol].formatted}`);
      } catch (error) {
        console.error(`Gagal mengambil saldo ${symbol} :`, error);
        balances[symbol] = {
          raw: BigInt(0),
          formatted: "0.0",
        };
      }
    }
    return balances;
  }

  async findSwappableToken(balances) {

    const swappableTokens = Object.entries(balances)
      .filter(
        ([symbol, balance]) =>
          symbol !== "A0GI" &&
          parseFloat(balance.formatted) >= parseFloat(MIN_BALANCE_FOR_SWAP)
      )
      .map(([symbol]) => symbol);

    if (swappableTokens.length === 0) {
      throw new Error("Tidak ada token dengan saldo yang cukup untuk di swap");
    }


    console.log("\nToken yang bisa swap:", swappableTokens.join(", "));


    return swappableTokens[Math.floor(Math.random() * swappableTokens.length)];
  }

  getRandomToken(fromToken) {

    const availableTokens = AVAILABLE_PAIRS.filter(
      (pair) => pair[0] === fromToken
    ).map((pair) => pair[1]);

    if (availableTokens.length === 0) {
      throw new Error(`Tidak ada pair trading untuk ${fromToken}`);
    }

    console.log("Token tujuan yang tersedia:", availableTokens.join(", "));

    return availableTokens[Math.floor(Math.random() * availableTokens.length)];
  }

  getRandomAmount(balance, symbol) {
    const balanceFloat = parseFloat(balance);
    const percentage = Math.random() * 0.9 + 0.1; 


    let amount = balanceFloat * percentage;

    switch (symbol) {
      case "BTC":
        amount = parseFloat(amount.toFixed(8));
        break;
      case "ETH":
        amount = parseFloat(amount.toFixed(6));
        break;
      default:
        amount = parseFloat(amount.toFixed(2));
    }

    return amount.toString();
  }

  async startRandomSwaps(txCount, delayInSeconds) {
    console.log("\nBot Status:");
    console.log(`Target: ${txCount} transactions`);
    if (delayInSeconds === "random") {
      console.log(`Delay: Random (${MIN_DELAY}-${MAX_DELAY} seconds)`);
    } else {
      console.log(`Delay: ~${delayInSeconds.toFixed(1)} seconds`);
    }
    console.log(`Min Balance: ${MIN_BALANCE_FOR_SWAP}`);
    console.log("\nSaldo:");
    const balances = await this.getAllBalances();

    let completedTx = 0;

    while (completedTx < txCount) {
      let swapSuccess = false;
      while (!swapSuccess) {
        try {
          const fromToken = await this.findSwappableToken(balances);
          const toToken = this.getRandomToken(fromToken);


          const amount = this.getRandomAmount(
            balances[fromToken].formatted,
            fromToken
          );

          console.log(`\nSwap ${completedTx + 1}/${txCount}:`);
          console.log(`From: ${fromToken} (${amount})`);
          console.log(`To: ${toToken}`);

          await this.executeSwap(fromToken, toToken, amount);


          const newBalances = await this.getAllBalances();
          Object.assign(balances, newBalances);

          swapSuccess = true;
          completedTx++;

          if (completedTx < txCount) {
            let nextDelay;
            if (delayInSeconds === "random") {
              nextDelay = Math.floor(
                Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY
              );
            } else {

              nextDelay = delayInSeconds * (0.9 + Math.random() * 0.2);
            }

            console.log(`\nProgress: ${completedTx}/${txCount} swaps`);
            console.log(
              ` Waiting ${nextDelay.toFixed(1)}s untuk next swap...`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, nextDelay * 1000)
            );
          }
        } catch (error) {
          console.error("Swap gagal:", error.message);
          console.log("\nMencoba ulang segera dengan token yang berbeda...");
        }
      }
    }

    console.log("\nAll swaps completed!");
    console.log(`Final Saldo:`);
    await this.getAllBalances();
  }

  async executeSwap(fromToken, toToken, amount) {
    try {

      const isPairAvailable = AVAILABLE_PAIRS.some(
        ([from, to]) => from === fromToken && to === toToken
      );

      if (!isPairAvailable) {
        throw new Error(
          `Tidak ada liquidity pool untuk  ${fromToken}-${toToken} pair`
        );
      }

      if (fromToken === "A0GI" || toToken === "A0GI") {
        throw new Error("A0GI swaps tidak di dukung");
      }

      const tokenIn = CONFIG.TOKENS[fromToken];
      const tokenOut = CONFIG.TOKENS[toToken];
      if (!tokenIn || !tokenOut) {
        throw new Error("Invalid token symbols");
      }


      const tokenInContract = new ethers.Contract(
        tokenIn,
        ERC20_ABI,
        this.wallet
      );


      const amountIn = ethers.parseUnits(amount.toString(), 18);


      const balance = await tokenInContract.balanceOf(this.wallet.address);
      if (balance < amountIn) {
        throw new Error(
          `Saldo tidak cukup ${fromToken}. Required: ${amount}, Available: ${ethers.formatUnits(
            balance,
            18
          )}`
        );
      }

      console.log("\nSwap Progress:");

      const gasPrice = await this.fetchGasPrice();
      console.log(
        `Using network gas price: ${ethers.formatUnits(
          gasPrice,
          "gwei"
        )} gwei`
      );

      const optimalFeeTier = await this.detectOptimalFee(tokenIn, tokenOut);
      console.log(`Detected optimal fee tier: ${optimalFeeTier / 10000}%`);

      const allowance = await tokenInContract.allowance(
        this.wallet.address,
        CONFIG.UNISWAP.ROUTER
      );
      if (allowance < amountIn) {
        console.log("Approving tokens...");
        const approveTx = await tokenInContract.approve(
          CONFIG.UNISWAP.ROUTER,
          ethers.MaxUint256
        );
        await approveTx.wait();
        console.log("Tokens di setujui");
      }

      const factoryContract = new ethers.Contract(
        CONFIG.UNISWAP.FACTORY,
        [
          "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
        ],
        this.provider
      );


      let pool = null;
      let usableFeeTier = null;

      for (const feeTier of CONFIG.FEE_TIERS) {
        const poolAddress = await factoryContract.getPool(
          tokenIn,
          tokenOut,
          feeTier
        );
        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
          pool = poolAddress;
          usableFeeTier = feeTier;
          break;
        }
      }

      if (!pool) {
        throw new Error(
          `Tidak ada liquidity pool untuk ${fromToken}-${toToken} pair`
        );
      }

      const params = {
        tokenIn,
        tokenOut,
        fee: usableFeeTier,
        recipient: this.wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 60 * 20,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      };

        const tx = await this.router.exactInputSingle(params, {
        gasLimit: 300000,
        gasPrice: gasPrice,
        nonce: await this.wallet.getNonce(),
      });

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`\nSwap Success:`);
      console.log(`${amount} ${fromToken} → ${toToken}`);
      console.log(`Hash: ${receipt.hash}`);
      console.log(
        `Gas Used: ${receipt.gasUsed} @ ${ethers.formatUnits(
          gasPrice,
          "gwei"
        )} gwei`
      );

      return receipt;
    } catch (error) {
      console.error("Swap failed:", error.message);
      throw error;
    }
  }

  async detectOptimalFee(tokenIn, tokenOut) {
    try {
      const factoryContract = new ethers.Contract(
        CONFIG.UNISWAP.FACTORY,
        ["function getPool(address,address,uint24) view returns (address)"],
        this.provider
      );

      for (const fee of CONFIG.FEE_TIERS) {
        const poolAddress = await factoryContract.getPool(
          tokenIn,
          tokenOut,
          fee
        );
        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
          return fee;
        }
      }

      return CONFIG.FEE_TIERS[1];
    } catch (error) {
      console.warn(
        "Gagal mendeteksi fee, menggunakan biaya default:",
        error.message
      );
      return CONFIG.FEE_TIERS[1];
    }
  }

  async fetchGasPrice() {
    try {
      const response = await fetch(
        "https://chainscan-newton.0g.ai/stat/gasprice/tracker",
        {
          headers: {
            Accept: "*/*",
            "User-Agent": "Mozilla/5.0",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Use tp50 (median) from gasPriceMarket
      if (
        data.result &&
        data.result.gasPriceMarket &&
        data.result.gasPriceMarket.tp50
      ) {
        const gasPrice = BigInt(data.result.gasPriceMarket.tp50);
        console.log(
          `gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`
        );
        return gasPrice;
      }

      throw new Error("Invalid gas price data structure");
    } catch (error) {
      console.warn(
        "Gagal mengambil harga gas, menggunakan harga lain:",
        error.message
      );
      // Safe default of 3 gwei
      const fallbackPrice = BigInt(3000000000);
      console.log(
        `Gunakan biaya cadangan: ${ethers.formatUnits(
          fallbackPrice,
          "gwei"
        )} gwei`
      );
      return fallbackPrice;
    }
  }
}


async function getUserInput() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => rl.question(query, resolve));

  try {
    const txCount = await question("Masukkan jumlah transaksi yang akan dilakukan: ");
    const hours = await question("Masukkan waktu dalam jam (opsional, tekan Enter untuk lewati): ");

    if (isNaN(txCount) || parseInt(txCount) <= 0) {
      throw new Error("Masukkan jumlah transaksi yang valid");
    }

    rl.close();

    let delayInSeconds;
    if (hours && hours.trim() !== "") {
      if (isNaN(hours) || parseFloat(hours) <= 0) {
        throw new Error("Masukkan waktu yang valid");
      }
      // Calculate delay based on period
      delayInSeconds = (parseFloat(hours) * 3600) / parseInt(txCount);
    } else {
      // Use random delay if no period specified
      delayInSeconds = "random";
    }

    return {
      txCount: parseInt(txCount),
      delayInSeconds,
    };
  } catch (error) {
    rl.close();
    throw error;
  }
}

async function main() {
  try {
    // Get user input first
    const { txCount, delayInSeconds } = await getUserInput();

    console.log("\nMemulai Bot Swap...");
    const bot = new ZeroGSwapBot();
    await bot.initialize();
    await bot.startRandomSwaps(txCount, delayInSeconds);

    console.log("\nEksekusi bot selesai!!");
    process.exit(0);
  } catch (error) {
    console.error("Eksekusi bot gagal:", error);
    process.exit(1);
  }
}

export default ZeroGSwapBot;

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
