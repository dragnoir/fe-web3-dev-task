"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

function App() {
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <>
      <div>
        <h2>Active staking pools from the MasterChef contract</h2>
      </div>
    </>
  );
}

export default App;
