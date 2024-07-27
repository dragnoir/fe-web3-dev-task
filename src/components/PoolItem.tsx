"use client";

import React from "react";

interface PoolItemProps {
  poolId: number;
  lpTokenSymbol: string;
  rewardPerBlock: string;
  rewardPercentage: number;
}

const PoolItem: React.FC<PoolItemProps> = ({
  poolId,
  lpTokenSymbol,
  rewardPerBlock,
  rewardPercentage,
}) => {
  return (
    <div className="pool_item">
      <h3 className="pool_item_title">Pool #{poolId}</h3>
      <div className="pool_item_details">
        <p>LP Token: {lpTokenSymbol}</p>
        <p>Reward per block: {rewardPerBlock} CAKE</p>
        <p>Reward percentage: {rewardPercentage.toFixed(2)}%</p>
      </div>
    </div>
  );
};

export default PoolItem;
