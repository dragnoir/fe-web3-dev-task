"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

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

      const lpTokenAddress = await fetchlpTokenAddress(publicClient, pid);

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

        const token0Price = await fetchTokenPrice(token0Address);
        const token1Price = await fetchTokenPrice(token1Address);

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

  const columnDefs: ColDef<Pool>[] = useMemo(
    () => [
      { headerName: "PID", field: "pid", sortable: true, filter: true },
      {
        headerName: "LP Token Symbol",
        field: "lpTokenSymbol",
        sortable: true,
        filter: true,
      },
      {
        headerName: "Reward Per Block",
        field: "rewardPerBlock",
        sortable: true,
        filter: true,
        valueFormatter: (params) => formatEther(params.value as bigint),
      },
      {
        headerName: "Reward Percentage",
        field: "rewardPercentage",
        sortable: true,
        filter: true,
      },
      {
        headerName: "Is Regular",
        field: "isRegular",
        sortable: true,
        filter: true,
      },
      {
        headerName: "LP Token Address",
        field: "lpTokenAddress",
        sortable: true,
        filter: true,
      },
      { headerName: "TVL", field: "TVL", sortable: true, filter: true },
    ],
    []
  );

  if (loading) return <div>Loading pools...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="pool-list">
      <h2 className="sub_title">List of Staking Pools:</h2>
      <div className="ag-theme-alpine" style={{ height: 600, width: "100%" }}>
        <AgGridReact
          rowData={pools}
          columnDefs={columnDefs}
          pagination={true}
          paginationPageSize={10}
        />
      </div>
    </div>
  );
};

export default PoolList;
