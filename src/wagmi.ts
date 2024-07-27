import { http, createConfig } from "wagmi";
import { bsc } from "wagmi/chains";

export function getConfig() {
  return createConfig({
    chains: [bsc],
    transports: {
      [bsc.id]: http("https://bsc-dataseed1.ninicoin.io/"),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
