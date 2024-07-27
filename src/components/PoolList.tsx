"use client";

import React, { useState, useEffect } from "react";
import { useReadContract, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { MASTERCHEF_ABI, MASTERCHEF_ADDRESS } from "../contracts/abis";
import {
  fetchPoolInfo,
  fetchTokenSymbols,
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

      if (Number(allocPoint) === 0) return null; // Skip inactive pools

      /* const lpTokenSymbol = await fetchTokenSymbols(
        publicClient,
        poolInfo.lpToken
      );*/

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
        lpTokenSymbol: "CAKE",
        rewardPerBlock,
        rewardPercentage,
      };
    });
  };

  if (loading) return <div>Loading pools...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="pool-list">
      <h2 className="sub_title">Active Staking Pools:</h2>
      {pools.map((pool) => (
        <PoolItem
          key={pool.pid}
          poolId={pool.pid}
          lpTokenSymbol={pool.lpTokenSymbol}
          rewardPerBlock={formatEther(pool.rewardPerBlock)}
          rewardPercentage={pool.rewardPercentage}
        />
      ))}
    </div>
  );
};

export default PoolList;
