// import "./App.css";
// import { useState } from "react";
// import { ethers } from "ethers";
// import Greeter from "./artifacts/contracts/Greeter.sol/Greeter.json";
// // import ArticleTree from "./artifacts/contracts/ArticleTree.sol/ArticleTree.json";
// import ArticleTrees from "./artifacts/contracts/ArticleTrees.sol/ArticleTrees.json";

// // Update with the contract address logged out to the CLI when it was deployed
// const greeterAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
// // const articleTreeAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
// const articleTreesAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// function App() {
//   // store greeting in local state
//   const [greeting, setGreetingValue] = useState("");

//   // article
//   const [tree, setTree] = useState([]);
//   const [treeId, setTreeId] = useState(0); // For adding new nodes

//   // request access to the user's MetaMask account
//   async function requestAccount() {
//     await window.ethereum.request({ method: "eth_requestAccounts" });
//   }

//   // call the smart contract, read the current greeting value
//   async function fetchGreeting() {
//     if (typeof window.ethereum !== "undefined") {
//       const provider = new ethers.providers.Web3Provider(window.ethereum);
//       const contract = new ethers.Contract(
//         greeterAddress,
//         Greeter.abi,
//         provider
//       );
//       try {
//         const data = await contract.greet();
//         console.log("data: ", data);
//       } catch (err) {
//         console.log("Error: ", err);
//       }
//     }
//   }

//   // call the smart contract, send an update
//   async function setGreeting() {
//     if (!greeting) return;
//     if (typeof window.ethereum !== "undefined") {
//       await requestAccount();
//       const provider = new ethers.providers.Web3Provider(window.ethereum);
//       const signer = provider.getSigner();
//       const contract = new ethers.Contract(greeterAddress, Greeter.abi, signer);
//       const transaction = await contract.setGreeting(greeting);
//       await transaction.wait();
//       fetchGreeting();
//     }
//   }

//   async function addTree() {
//     // Example node data (hardcoded for now)
//     const ids = [7, 8, 9];
//     const parentIds = [6, 6, 6];
//     const values = ids.map((id) =>
//       ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`hash_${id}`))
//     );

//     if (typeof window.ethereum !== "undefined") {
//       await requestAccount();
//       const provider = new ethers.providers.Web3Provider(window.ethereum);
//       const signer = provider.getSigner();
//       const contract = new ethers.Contract(
//         articleTreesAddress,
//         ArticleTrees.abi,
//         signer
//       );

//       try {
//         const transaction = await contract.addTree(ids, parentIds, values, {
//           gasLimit: 30000000,
//         });
//         await transaction.wait();
//         console.log("Nodes added!");
//         getTree(); // Refresh the nodes list after adding
//       } catch (err) {
//         console.error("Error adding nodes:", err);
//       }
//     }
//   }

//   // Fetch all nodes from the contract
//   async function getTree() {
//     if (typeof window.ethereum !== "undefined") {
//       const provider = new ethers.providers.Web3Provider(window.ethereum);
//       const contract = new ethers.Contract(
//         articleTreesAddress,
//         ArticleTrees.abi,
//         provider
//       );

//       try {
//         // const nodeCount = await contract.nodeCount(); // Assuming you have a function to get the total count of nodes
//         // const firstTree = await contract.getTree(0);
//         // const tree = await contract.getTree(parseInt(0));

//         // console.log(treeId)
//         const tree = await contract.getTree(treeId);

//         // console.log(tree[2][0][2].toString())

//         setTree(tree);
//       } catch (err) {
//         console.error("Error fetching nodes:", err);
//       }
//     }
//   }

//   // console.log(tree[2].toString());

//   return (
//     <div className="App">
//       <header className="App-header">
//         <button onClick={fetchGreeting}>Fetch Greeting</button>
//         <button onClick={setGreeting}>Set Greeting</button>
//         <input
//           onChange={(e) => setGreetingValue(e.target.value)}
//           placeholder="Set greeting"
//         />

//         <button onClick={addTree}>Add Nodes</button>
//         <button onClick={getTree}>Show Nodes</button>
//         <div>
//           <h3>tree number {treeId}</h3>

//           {/* {tree?.[2][0].toString()} */}

//           {tree?.[2]?.map((item, index) => (
//             <div key={index}>
//               <div>
//                 <span>id: </span>

//                 <span>{item[0].toString()}</span>
//               </div>

//               <div>
//                 <span>parentId: </span>

//                 <span>{item[1].toString()}</span>
//               </div>

//               <div>
//                 <span>value: </span>

//                 <span>{item[2].toString()}</span>
//               </div>
//             </div>
//           ))}

//           {/* {
//             tree[0]?.id
//           } */}

//           {/* const id = result[2][0].id.toString(); const value =
//           result[2][0].value.toString(); const parent =
//           result[2][0].parentId.toString(); */}
//           {/* <ul>
//             {nodes.length > 0 ? (
//               nodes.map((node, index) => (
//                 <li key={index}>
//                   <strong>ID:</strong> {node} <strong>Parent ID:</strong>{" "}
//                   {node.parentId} <strong>Value:</strong> {node.value}
//                 </li>
//               ))
//             ) : (
//               <p>No nodes added yet.</p>
//             )}
//           </ul> */}
//         </div>

//         <input
//           onChange={(e) => setTreeId(e.target.value)}
//           placeholder="Enter data for a new node (not used yet)"
//         />
//       </header>
//     </div>
//   );
// }

// export default App;

// import { useState } from "react";
// import { processText, provider } from "./process";

// function App() {
//   const [text, setText] = useState("");
//   const [textId, setTextId] = useState(1);
//   const [status, setStatus] = useState("Idle");
//   const [results, setResults] = useState([]);

//   async function requestAccount() {
//     await window.ethereum.request({ method: "eth_requestAccounts" });
//   }

//   const handleProcess = async () => {
//     if (!text.trim()) {
//       alert("Please enter text");
//       return;
//     }
//     setStatus(`Processing Text ${textId}...`);
//     try {
//       await requestAccount();
//       const signer = provider.getSigner();
//       const success = await processText(textId, text, signer);
//       setResults([
//         ...results,
//         `Text ${textId}: ${success ? "Stored" : "Skipped"}`,
//       ]);
//       if (success) {
//         setTextId(textId + 1);
//         setText("");
//       }
//       setStatus("Idle");
//     } catch (error) {
//       console.error(error);
//       setStatus("Error");
//       setResults([...results, `Text ${textId}: Error`]);
//     }
//   };

//   return (
//     <div style={{ padding: "20px" }}>
//       <h1>Article Processor</h1>
//       <textarea
//         rows="10"
//         cols="50"
//         value={text}
//         onChange={(e) => setText(e.target.value)}
//         placeholder="Enter text (one sentence per line)"
//       />
//       <br />
//       <button onClick={handleProcess} disabled={status !== "Idle"}>
//         Process Text {textId}
//       </button>
//       <p>Status: {status}</p>
//       <h2>Results</h2>
//       <ul>
//         {results.map((result, i) => (
//           <li key={i}>{result}</li>
//         ))}
//       </ul>
//     </div>
//   );
// }

// export default App;

import { useState } from "react";
import { processText, provider } from "./process";

function App() {
  const [text, setText] = useState("");
  const [textId, setTextId] = useState(1);
  const [status, setStatus] = useState("Idle");
  const [results, setResults] = useState([]);

  async function requestAccount() {
    await window.ethereum.request({ method: "eth_requestAccounts" });
  }

  const handleProcess = async () => {
    if (!text.trim()) {
      alert("Please enter some text");
      return;
    }

    setStatus(`Processing Text ${textId}...`);
    try {
      await requestAccount();
      const signer = await provider.getSigner();
      const success = await processText(textId, text, signer);

      setResults((prev) => [
        ...prev,
        `Text ${textId}: ${success ? "Stored" : "Skipped"}`,
      ]);

      if (success) {
        setTextId((id) => id + 1);
        setText("");
      }
      setStatus("Idle");
    } catch (error) {
      console.error("Error:", error);
      setStatus("Error");
      setResults((prev) => [...prev, `Text ${textId}: Error`]);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Article Processor</h1>
      <textarea
        rows="10"
        cols="50"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter one sentence per line"
      />
      <br />
      <button onClick={handleProcess} disabled={status !== "Idle"}>
        Process Text {textId}
      </button>
      <p>Status: {status}</p>
      <h2>Results</h2>
      <ul>
        {results.map((result, i) => (
          <li key={i}>{result}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
