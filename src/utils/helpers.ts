import { Address, PublicClient } from "viem";
import {
  MASTERCHEF_ABI,
  PANCAKEPAIR_ABI,
  ERC20_ABI,
  MASTERCHEF_ADDRESS,
} from "../contracts/abis";

export const fetchPoolInfo = async (
  publicClient: PublicClient,
  pid: number
) => {
  return publicClient.readContract({
    address: MASTERCHEF_ADDRESS,
    abi: MASTERCHEF_ABI,
    functionName: "poolInfo",
    args: [BigInt(pid)],
  });
};

export const fetchTokenSymbols = async (
  publicClient: PublicClient,
  lpTokenAddress: Address
) => {
  const [token0Address, token1Address] = await Promise.all([
    publicClient.readContract({
      address: lpTokenAddress,
      abi: PANCAKEPAIR_ABI,
      functionName: "token0",
    }),
    publicClient.readContract({
      address: lpTokenAddress,
      abi: PANCAKEPAIR_ABI,
      functionName: "token1",
    }),
  ]);

  const [symbol0, symbol1] = await Promise.all([
    publicClient.readContract({
      address: token0Address,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address: token1Address,
      abi: ERC20_ABI,
      functionName: "symbol",
    }),
  ]);

  return `${symbol0}-${symbol1}`;
};

export const calculateRewardPerBlock = (
  cakePerBlock: bigint,
  allocPoint: bigint,
  totalSpecialAllocPoint: bigint
) => {
  return (cakePerBlock * allocPoint) / totalSpecialAllocPoint;
};

export const calculateRewardPercentage = (
  allocPoint: bigint,
  totalSpecialAllocPoint: bigint
) => {
  return (Number(allocPoint) / Number(totalSpecialAllocPoint)) * 100;
};

export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> => {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};
