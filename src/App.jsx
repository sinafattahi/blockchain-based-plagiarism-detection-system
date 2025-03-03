import "./App.css";
import { useState } from "react";
import { ethers } from "ethers";
import Greeter from "./artifacts/contracts/Greeter.sol/Greeter.json";
import ArticleTree from "./artifacts/contracts/ArticleTree.sol/ArticleTree.json";

// Update with the contract address logged out to the CLI when it was deployed
const greeterAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const articleTreeAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

function App() {
  // store greeting in local state
  const [greeting, setGreetingValue] = useState("");

  // article
  const [nodes, setNodes] = useState([]);
  // const [nodeData, setNodeData] = useState(""); // For adding new nodes

  // request access to the user's MetaMask account
  async function requestAccount() {
    await window.ethereum.request({ method: "eth_requestAccounts" });
  }

  // call the smart contract, read the current greeting value
  async function fetchGreeting() {
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(
        greeterAddress,
        Greeter.abi,
        provider
      );
      try {
        const data = await contract.greet();
        console.log("data: ", data);
      } catch (err) {
        console.log("Error: ", err);
      }
    }
  }

  // call the smart contract, send an update
  async function setGreeting() {
    if (!greeting) return;
    if (typeof window.ethereum !== "undefined") {
      await requestAccount();
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(greeterAddress, Greeter.abi, signer);
      const transaction = await contract.setGreeting(greeting);
      await transaction.wait();
      fetchGreeting();
    }
  }

  async function addNodes() {
    // Example node data (hardcoded for now)
    const ids = [12];
    const parentIds = [3];
    const values = ids.map((id) =>
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`hash_${id}`))
    );

    if (typeof window.ethereum !== "undefined") {
      await requestAccount();
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        articleTreeAddress,
        ArticleTree.abi,
        signer
      );

      try {
        const transaction = await contract.addNodes(ids, parentIds, values, {
          gasLimit: 30000000,
        });
        await transaction.wait();
        console.log("Nodes added!");
        fetchNodes(); // Refresh the nodes list after adding
      } catch (err) {
        console.error("Error adding nodes:", err);
      }
    }
  }

  // Fetch all nodes from the contract
  async function fetchNodes() {
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(
        articleTreeAddress,
        ArticleTree.abi,
        provider
      );

      try {
        // const nodeCount = await contract.nodeCount(); // Assuming you have a function to get the total count of nodes
        const allNodes = await contract.getAllNodeIds();
        setNodes(allNodes.map((item) => item.toString())); // Set nodes in state
      } catch (err) {
        console.error("Error fetching nodes:", err);
      }
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <button onClick={fetchGreeting}>Fetch Greeting</button>
        <button onClick={setGreeting}>Set Greeting</button>
        <input
          onChange={(e) => setGreetingValue(e.target.value)}
          placeholder="Set greeting"
        />

        <button onClick={addNodes}>Add Nodes</button>
        <button onClick={fetchNodes}>Show Nodes</button>
        <div>
          <h3>Stored Nodes:</h3>
          <ul>
            {nodes.length > 0 ? (
              nodes.map((node, index) => (
                <li key={index}>
                  <strong>ID:</strong> {node} <strong>Parent ID:</strong>{" "}
                  {node.parentId} <strong>Value:</strong> {node.value}
                </li>
              ))
            ) : (
              <p>No nodes added yet.</p>
            )}
          </ul>
        </div>

        <input
          // onChange={(e) => setNodeData(e.target.value)}
          placeholder="Enter data for a new node (not used yet)"
        />
      </header>
    </div>
  );
}

export default App;
