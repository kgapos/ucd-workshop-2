// Prints the USDC and ETH balance of your wallet, or of any address passed as an argument.
import { erc20Abi, formatEther, formatUnits } from "viem";
import { account, publicClient, USDC, EXPLORER } from "../config.js";

const address = process.argv[2] || account().address;
const [usdc, eth] = await Promise.all([
  publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
  publicClient.getBalance({ address }),
]);
console.log(`Address: ${address}`);
console.log(`USDC:    ${formatUnits(usdc, 6)}`);
console.log(`ETH:     ${formatEther(eth)}`);
console.log(`Explorer: ${EXPLORER}/address/${address}#tokentxns`);
