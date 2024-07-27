"use client";

import React from "react";

interface PoolItemProps {
  poolId: number;
  lpTokenSymbol: string;
  rewardPerBlock: string;
  rewardPercentage: number;
  isRegular: boolean;
  lpTokenAddress: string;
}

const PoolItem: React.FC<PoolItemProps> = ({
  poolId,
  lpTokenSymbol,
  rewardPerBlock,
  rewardPercentage,
  isRegular,
  lpTokenAddress,
}) => {
  return (
    <div className="pool_item">
      <h3 className="pool_item_title">Pool #{poolId}</h3>
      <div className="pool_item_details">
        <p>LP Token: {lpTokenSymbol}</p>
        <p>Reward per block: {rewardPerBlock} CAKE</p>
        <p>Reward percentage: {rewardPercentage.toFixed(2)}%</p>
        <p>Pool type: {isRegular ? "Regular" : "Special"}</p>
        <p>LP Token Address: {lpTokenAddress}</p>
      </div>
    </div>
  );
};

export default PoolItem;
