"use client";

import React, { useState, useEffect } from "react";
import { useReadContract, usePublicClient } from "wagmi";
import { Address, formatEther, isAddress } from "viem";
import { MASTERCHEF_ABI, MASTERCHEF_ADDRESS } from "../contracts/abis";
import {
  fetchPoolInfo,
  fetchTokenSymbols,
  fetchtoken0Address,
  fetchtoken1Address,
  fetchlpTokenAddress,
  fetchTokenReserves,
  fetchTokenPrice,
  fetchTotalSupply,
  calculateRewardPerBlock,
  calculateRewardPercentage,
  retry,
} from "../utils/helpers";
import PoolItem from "./PoolItem";

interface Pool {
  pid: number;
  lpTokenSymbol: string;
  rewardPerBlock: bigint;
  rewardPercentage: number;
  isRegular: boolean;
  lpTokenAddress: string;
  TVL: number;
}

const PoolList: React.FC = () => {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const publicClient = usePublicClient();

  const { data: poolLength } = useReadContract({
    address: MASTERCHEF_ADDRESS,
    abi: MASTERCHEF_ABI,
    functionName: "poolLength",
  });

  const { data: totalSpecialAllocPoint } = useReadContract({
    address: MASTERCHEF_ADDRESS,
    abi: MASTERCHEF_ABI,
    functionName: "totalSpecialAllocPoint",
  });

  const { data: regularCakePerBlock } = useReadContract({
    address: MASTERCHEF_ADDRESS,
    abi: MASTERCHEF_ABI,
    functionName: "cakePerBlock",
    args: [true], // for regular pools
  });

  const { data: specialCakePerBlock } = useReadContract({
    address: MASTERCHEF_ADDRESS,
    abi: MASTERCHEF_ABI,
    functionName: "cakePerBlock",
    args: [false], // for special pools
  });

  useEffect(() => {
    console.log("poolLength", poolLength);
    console.log("totalSpecialAllocPoint", totalSpecialAllocPoint);
    console.log("regularCakePerBlock", regularCakePerBlock);
    console.log("specialCakePerBlock", specialCakePerBlock);
    if (
      poolLength &&
      totalSpecialAllocPoint &&
      regularCakePerBlock &&
      specialCakePerBlock
    ) {
      fetchPools();
    }
  }, [
    poolLength,
    totalSpecialAllocPoint,
    regularCakePerBlock,
    specialCakePerBlock,
  ]);

  const fetchPools = async () => {
    try {
      const poolPromises = [];
      for (let i = 0; i < Number(poolLength); i++) {
        console.log("on pool", i);
        poolPromises.push(fetchPoolData(i));
      }

      const poolsData = await Promise.all(poolPromises);
      setPools(poolsData.filter((pool): pool is Pool => pool !== null));
      setLoading(false);
    } catch (err) {
      console.error("Error fetching pools:", err);
      setError("Failed to fetch pools. Please try again.");
      setLoading(false);
    }
  };

  const fetchPoolData = async (pid: number): Promise<Pool | null> => {
    return retry(async () => {
      const poolInfo = await fetchPoolInfo(publicClient, pid);
      console.log("pid: ", pid);
      console.log("poolInfo: ", poolInfo);

      const accCakePerShare = poolInfo[0]; // uint256 : 17592196679036163
      const lastRewardBlock = poolInfo[1]; // uint256 : 40596821
      const allocPoint = poolInfo[2]; // uint256 : 0
      const totalBoostedShare = poolInfo[3]; // uint256 : 10564818144122263031861
      const isRegular = poolInfo[4]; // bool : true

      // This line is commented cause not all allocPoint === 0 has yoken0 or token1 properties
      // if (Number(allocPoint) === 0) return null; // Skip inactive pools

      const lpTokenAddress = await fetchlpTokenAddress(publicClient, pid);

      // Fetching for token 0 Address, sometimes it's not available
      let token0Address = 0 as unknown as Address;
      let token1Address = 0 as unknown as Address;
      try {
        token0Address = await fetchtoken0Address(publicClient, lpTokenAddress);
        token1Address = await fetchtoken1Address(publicClient, lpTokenAddress);
      } catch (error) {
        console.error("Error fetching token addresses:", error);
      }

      let lpTokenSymbol = "NA";
      let TVL = 0;
      if (isAddress(token0Address) && isAddress(token1Address)) {
        const symbol0 = await fetchTokenSymbols(publicClient, token0Address);
        const symbol1 = await fetchTokenSymbols(publicClient, token1Address);
        lpTokenSymbol = symbol0 + "-" + symbol1;

        // token prices
        const token0Price = await fetchTokenPrice(token0Address);
        const token1Price = await fetchTokenPrice(token1Address);

        // calculate reserve
        // Using this calculation reserve0 = token0_contract.functions.balanceOf(pool)
        const reserve0_BigInt = await fetchTokenReserves(
          publicClient,
          token0Address,
          lpTokenAddress
        );
        const reserve0 = Number(reserve0_BigInt);

        const reserv10_BigInt = await fetchTokenReserves(
          publicClient,
          token1Address,
          lpTokenAddress
        );
        const reserve1 = Number(reserv10_BigInt);

        // token total supply
        const totalSupply0 = await fetchTotalSupply(
          publicClient,
          token0Address
        );
        const totalSupply1 = await fetchTotalSupply(
          publicClient,
          token1Address
        );
        const totalSupply = totalSupply0 + totalSupply1;
        console.log("totaSupply: ", totalSupply);

        TVL =
          (reserve0 * token0Price + reserve1 * token1Price) /
          Number(totalSupply);
      }

      /* const totalDollarValue =
        (reserves[0] * token0Price + reserves[1] * token1Price) / totalSupply;
        */

      const cakePerBlock = isRegular
        ? regularCakePerBlock!
        : specialCakePerBlock!;

      const rewardPerBlock = calculateRewardPerBlock(
        cakePerBlock,
        allocPoint,
        totalSpecialAllocPoint!
      );
      const rewardPercentage = calculateRewardPercentage(
        allocPoint,
        totalSpecialAllocPoint!
      );

      return {
        pid,
        lpTokenSymbol,
        rewardPerBlock,
        rewardPercentage,
        isRegular,
        lpTokenAddress,
        TVL,
      };
    });
  };

  if (loading) return <div>Loading pools...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="pool-list">
      <h2 className="sub_title">Active Staking Pools:</h2>
      <div className="pool_items">
        {pools.map((pool) => (
          <PoolItem
            key={pool.pid}
            poolId={pool.pid}
            lpTokenSymbol={pool.lpTokenSymbol}
            rewardPerBlock={formatEther(pool.rewardPerBlock)}
            rewardPercentage={pool.rewardPercentage}
            isRegular={pool.isRegular}
            lpTokenAddress={pool.lpTokenAddress}
            TVL={pool.TVL}
          />
        ))}
      </div>
    </div>
  );
};

export default PoolList;
