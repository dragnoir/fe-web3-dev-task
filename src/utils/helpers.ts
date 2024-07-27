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

export const fetchlpTokenAddress = async (
  publicClient: PublicClient,
  pid: number
) => {
  return publicClient.readContract({
    address: MASTERCHEF_ADDRESS,
    abi: MASTERCHEF_ABI,
    functionName: "lpToken",
    args: [BigInt(pid)],
  });
};

export const fetchTokenReserves = async (
  publicClient: PublicClient,
  tokenAddress: Address,
  lpTokenAddress: Address
) => {
  return publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [lpTokenAddress],
  });
};

export const fetchtoken0Address = async (
  publicClient: PublicClient,
  lpTokenAddress: Address
) => {
  return publicClient.readContract({
    address: lpTokenAddress,
    abi: PANCAKEPAIR_ABI,
    functionName: "token0",
  });
};

export const fetchtoken1Address = async (
  publicClient: PublicClient,
  lpTokenAddress: Address
) => {
  return publicClient.readContract({
    address: lpTokenAddress,
    abi: PANCAKEPAIR_ABI,
    functionName: "token1",
  });
};

export const fetchTokenSymbols = async (
  publicClient: PublicClient,
  token1Address: Address
) => {
  return publicClient.readContract({
    address: token1Address,
    abi: ERC20_ABI,
    functionName: "symbol",
  });
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

export const fetchTokenPrice = async (
  tokenAddress: string
): Promise<number> => {
  const response = await fetch("/.netlify/functions/fetchTokenPrices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tokenAddress }),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch token price");
  }
  const priceData = await response.json();
  return priceData[tokenAddress];
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
