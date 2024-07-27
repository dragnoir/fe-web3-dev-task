"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  lpTokenAddress: `0x${string}`;
  TVL: number | "N/A";
}

const BATCH_SIZE = 10; // Number of pools to fetch in each batch
const RETRY_DELAY = 2000; // Delay between retries in milliseconds
const PRICE_FETCH_TIMEOUT = 5000; // Timeout for price fetching in milliseconds

const PoolList: React.FC = () => {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

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

  const fetchPoolData = useCallback(
    async (pid: number): Promise<Pool | null> => {
      return retry<Pool | null>(
        async () => {
          const poolInfo = await fetchPoolInfo(publicClient, pid);
          const [
            accCakePerShare,
            lastRewardBlock,
            allocPoint,
            totalBoostedShare,
            isRegular,
          ] = poolInfo;

          const lpTokenAddress = await fetchlpTokenAddress(publicClient, pid);

          let token0Address = 0 as unknown as Address;
          let token1Address = 0 as unknown as Address;
          try {
            token0Address = await fetchtoken0Address(
              publicClient,
              lpTokenAddress
            );
            token1Address = await fetchtoken1Address(
              publicClient,
              lpTokenAddress
            );
          } catch (error) {
            console.error("Error fetching token addresses:", error);
          }

          let lpTokenSymbol = "NA";
          let TVL: number | "N/A" = "N/A";
          if (isAddress(token0Address) && isAddress(token1Address)) {
            const [symbol0, symbol1] = await Promise.all([
              fetchTokenSymbols(publicClient, token0Address),
              fetchTokenSymbols(publicClient, token1Address),
            ]);
            lpTokenSymbol = `${symbol0}-${symbol1}`;

            const fetchPriceWithTimeout = async (
              tokenAddress: string
            ): Promise<number> => {
              try {
                const price = await Promise.race([
                  fetchTokenPrice(tokenAddress),
                  new Promise<number>((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Price fetch timeout")),
                      PRICE_FETCH_TIMEOUT
                    )
                  ),
                ]);
                return price;
              } catch (error) {
                console.error(
                  `Error fetching price for token ${tokenAddress}:`,
                  error
                );
                return 0;
              }
            };

            const [token0Price, token1Price] = await Promise.all([
              fetchPriceWithTimeout(token0Address),
              fetchPriceWithTimeout(token1Address),
            ]);

            if (token0Price === 0 || token1Price === 0) {
              TVL = "N/A";
            } else {
              const [
                reserve0_BigInt,
                reserv10_BigInt,
                totalSupply0,
                totalSupply1,
              ] = await Promise.all([
                fetchTokenReserves(publicClient, token0Address, lpTokenAddress),
                fetchTokenReserves(publicClient, token1Address, lpTokenAddress),
                fetchTotalSupply(publicClient, token0Address),
                fetchTotalSupply(publicClient, token1Address),
              ]);

              const reserve0 = Number(reserve0_BigInt);
              const reserve1 = Number(reserv10_BigInt);
              const totalSupply = totalSupply0 + totalSupply1;

              TVL =
                (reserve0 * token0Price + reserve1 * token1Price) /
                Number(totalSupply);
            }
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
        },
        3,
        RETRY_DELAY
      );
    },
    [
      publicClient,
      regularCakePerBlock,
      specialCakePerBlock,
      totalSpecialAllocPoint,
    ]
  );

  const fetchPoolsBatch = useCallback(
    async (start: number, end: number) => {
      const poolPromises = [];
      for (let i = start; i < end && i < Number(poolLength); i++) {
        poolPromises.push(fetchPoolData(i));
      }
      const poolsData = await Promise.all(poolPromises);
      return poolsData.filter((pool): pool is Pool => pool !== null);
    },
    [fetchPoolData, poolLength]
  );

  useEffect(() => {
    if (
      poolLength &&
      totalSpecialAllocPoint &&
      regularCakePerBlock &&
      specialCakePerBlock
    ) {
      const fetchAllPools = async () => {
        try {
          setLoading(true);
          setError(null);
          const allPools: Pool[] = [];
          const totalPools = Number(poolLength);

          for (let i = 0; i < totalPools; i += BATCH_SIZE) {
            const batchPools = await fetchPoolsBatch(i, i + BATCH_SIZE);
            allPools.push(...batchPools);
            setProgress(Math.min(100, ((i + BATCH_SIZE) / totalPools) * 100));
            setPools((prevPools) => [...prevPools, ...batchPools]);
          }

          setLoading(false);
        } catch (err) {
          console.error("Error fetching pools:", err);
          setError("Failed to fetch all pools. Please try again.");
          setLoading(false);
        }
      };

      fetchAllPools();
    }
  }, [
    poolLength,
    totalSpecialAllocPoint,
    regularCakePerBlock,
    specialCakePerBlock,
    fetchPoolsBatch,
  ]);

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
      {
        headerName: "TVL",
        field: "TVL",
        sortable: true,
        filter: true,
        valueFormatter: (params) =>
          params.value === "N/A"
            ? "N/A"
            : `$${Number(params.value).toFixed(2)}`,
      },
    ],
    []
  );

  if (loading) {
    return (
      <div>
        <p>Loading pools... {progress.toFixed(2)}% complete</p>
        <progress value={progress} max="100" />
      </div>
    );
  }
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
