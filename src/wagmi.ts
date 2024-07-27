import { http, createConfig } from "wagmi";
import { bsc } from "wagmi/chains";

export function getConfig() {
  return createConfig({
    chains: [bsc],
    transports: {
      [bsc.id]: http("https://bsc-dataseed1.ninicoin.io/"),
      // [bsc.id]: http("https://bsc-mainnet.chainnodes.org/9a869a02-60a1-46ac-8fd3-83144ac1fa0f"),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
