import { http, cookieStorage, createConfig, createStorage } from "wagmi";
import { mainnet, bsc } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

export function getConfig() {
  return createConfig({
    chains: [mainnet, bsc],
    connectors: [injected(), coinbaseWallet()],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [mainnet.id]: http(),
      [bsc.id]: http(),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
