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

// import { useEffect, useState } from "react";
// import {
//   processArticle,
//   getStoredArticle,
//   getTotalArticles,
//   provider,
// } from "./process";

// function App() {
//   const [fileName, setFileName] = useState("");
//   const [articleId, setArticleId] = useState(1);
//   const [status, setStatus] = useState("Idle");
//   // const [results, setResults] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [readArticleId, setReadArticleId] = useState([]);
//   const [storedSentences, setStoredSentences] = useState([]);

//   const signer = provider.getSigner();

//   async function requestAccount() {
//     await window.ethereum.request({ method: "eth_requestAccounts" });
//   }

//   // const handleProcess = async () => {
//   //   if (!text.trim()) {
//   //     alert("Please enter some text");
//   //     return;
//   //   }

//   //   setStatus(`Processing Article ${articleId}...`);
//   //   try {
//   //     await requestAccount();
//   //     const success = await processArticle(articleId, text, signer);

//   //     setResults((prev) => [
//   //       ...prev,
//   //       `Text ${articleId}: ${success ? "Stored" : "Skipped"}`,
//   //     ]);

//   //     if (success) {
//   //       setArticleId((id) => id + 1);
//   //       setText("");
//   //       setStatus("Idle");
//   //     } else {
//   //       setStatus("skipped");
//   //     }
//   //   } catch (error) {
//   //     console.error("Error:", error);
//   //     setStatus("Error");
//   //     setResults((prev) => [...prev, `Text ${articleId}: Error`]);
//   //   }
//   // };

//   const handleProcess = async () => {
//     if (!fileName.endsWith(".txt")) {
//       setStatus("Please enter a valid .txt file name");
//       return;
//     }

//     setLoading(true);
//     try {
//       const response = await fetch(`/articles1/${fileName}`);
//       if (!response.ok) {
//         throw new Error("File not found");
//       }

//       const text = await response.text();

//       const success = await processArticle(articleId, text, signer);

//       setStatus(success ? "Article processed ✅" : "Article skipped ❌");
//     } catch (err) {
//       console.error(err);
//       setStatus("Failed to load or process file");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleViewStored = async () => {
//     await requestAccount();
//     const storedSentences = await getStoredArticle(readArticleId, signer);
//     if (storedSentences) {
//       setStoredSentences(storedSentences);
//     } else {
//       console.log("No article found or error occurred.");
//     }
//   };

//   useEffect(() => {
//     async function fetchTotalArticles() {
//       try {
//         const total = await getTotalArticles(signer || provider);
//         setArticleId(total + 1); // assuming new articleId = totalArticles
//       } catch (error) {
//         console.error("Failed to fetch total articles:", error);
//       }
//     }

//     fetchTotalArticles();
//   }, [signer]);

//   return (
//     <div style={{ padding: "20px" }}>
//       <h1>Article Processor</h1>
//       {/* <textarea
//         rows="10"
//         cols="50"
//         value={text}
//         onChange={(e) => setText(e.target.value)}
//         placeholder="Enter one sentence per line"
//       /> */}
//       <input
//         type="text"
//         value={fileName}
//         onChange={(e) => setFileName(e.target.value)}
//         placeholder="Enter file name like 1.txt"
//       />
//       <br />
//       <button
//         onClick={handleProcess}
//         // disabled={status !== "Idle" && status !== "skipped"}
//       >
//         {loading ? "Processing..." : "Process"} {articleId}
//       </button>
//       <p>Status: {status}</p>
//       {/* <h2>Results</h2> */}
//       {/* <ul>
//         {results.map((result, i) => (
//           <li key={i}>{result}</li>
//         ))}
//       </ul> */}

//       <input
//         type="number"
//         onChange={(e) => {
//           setReadArticleId(e.target.value);
//         }}
//       />

//       <button onClick={handleViewStored} disabled={articleId <= 1}>
//         show {readArticleId}
//       </button>

//       <h3>text number {readArticleId}</h3>

//       <ul>
//         {storedSentences.map((sentence, i) => {
//           return <li key={i}>{sentence}</li>;
//         })}
//       </ul>
//     </div>
//   );
// }

// export default App;

import { useEffect, useState } from "react";
import {
  processArticle,
  getStoredArticle,
  provider,
  init,
  printRatioStatistics,
} from "./process";
import IPFSUploader from "./components/IPFSUploader";
import IPFSRetriever from "./components/IPFSRetriever";

function App() {
  const [articleList, setArticleList] = useState([]);
  const [status, setStatus] = useState("Idle");
  const [loading, setLoading] = useState(false);
  const [storedSentences, setStoredSentences] = useState([]);
  const [readArticleId, setReadArticleId] = useState("1");
  const [currentCid, setCurrentCid] = useState(""); // Add state for current CID

  const signer = provider.getSigner();

  async function requestAccount() {
    await window.ethereum.request({ method: "eth_requestAccounts" });
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleProcessAll = async () => {
    setLoading(true);
    setStatus("Processing all articles...");

    try {
      for (let i = 0; i < articleList.length; i++) {
        const fileName = i + 1;
        const response = await fetch(`/articles1/${articleList[i]}`);
        if (!response.ok) {
          console.error(`Error fetching article ${fileName}: File not found`);
          continue;
        }

        const text = await response.text();
        const success = await processArticle(fileName, text, signer);
        console.log(`Article ${fileName} processed: ${success ? "✅" : "❌"}`);
        await delay(500);
      }

      setStatus("All articles processed!");
    } catch (err) {
      console.error(err);
      setStatus("Failed to process articles");
    } finally {
      setLoading(false);
    }
  };

  const handleViewStored = async () => {
    await requestAccount();
    const articleId = Number(readArticleId);
    if (isNaN(articleId) || articleId < 1) {
      setStatus("Please enter a valid article ID (positive integer)");
      return;
    }

    try {
      // Updated to work with the new IPFS-based retrieval
      const result = await getStoredArticle(articleId, signer);

      if (result) {
        setStoredSentences(result.sentences);
        setCurrentCid(result.cid); // Store the CID
        setStatus(
          `Successfully retrieved sentences for article ${articleId} (CID: ${result.cid})`
        );
      } else {
        setStoredSentences([]);
        setCurrentCid("");
        setStatus(`No data found for article ${articleId}`);
      }
    } catch (err) {
      console.error("Error retrieving article:", err);
      setStatus(
        `Failed to retrieve sentences for article ${articleId}: ${err.message}`
      );
    }
  };

  // debugPrintCache();

  useEffect(() => {
    async function fetchArticleList() {
      try {
        const response = await fetch("/articles1/list.json");
        const data = await response.json();
        setArticleList(data);
      } catch (err) {
        console.error("Error loading article list:", err);
      }
    }

    init();
    fetchArticleList();
  }, []);

  const findDivisors = (num) => {
    const divisors = [];
    for (let i = 1; i <= num; i++) {
      if (num % i === 0) {
        divisors.push(i);
      }
    }
    return divisors;
  };

  const predictPerformance = (k) => {
    // const r = k / b;

    // فاکتورهای مختلف کارایی
    const accuracyFactor = Math.min(k / 100, 1); // دقت بالاتر با k بیشتر
    const speedFactor = Math.max(1 - k / 200, 0.1); // سرعت کمتر با k بیشتر
    // const balanceFactor = Math.max(1 - Math.abs(r - 8) / 10, 0.1); // r بهینه حول 8
    // const thresholdFactor = Math.max(1 - Math.abs(threshold - 0.7) / 0.3, 0.1); // threshold بهینه 0.7

    return (
      accuracyFactor * 0.6 + speedFactor * 0.4
      // balanceFactor * 0.3 +
      // thresholdFactor * 0.2
    );
  };

  const removeDuplicates = (combinations) => {
    const seen = new Set();
    return combinations.filter((combo) => {
      const key = `${combo.NUM_HASH_FUNCTIONS}-${combo.NUM_BANDS}-${combo.SIMILARITY_THRESHOLD}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const generateSmartCombinations = () => {
    const combinations = [];

    // بر اساس تئوری LSH: s ≈ (1/b)^(1/r) که r = k/b
    const targetSimilarities = [0.6, 0.7, 0.8, 0.9];

    // مقادیر منطقی برای hash functions
    const hashFunctions = [4, 8, 16, 32, 64, 128, 256, 512];

    hashFunctions.forEach((k) => {
      // پیدا کردن تمام مقسوم علیه های k
      const divisors = findDivisors(k);

      divisors.forEach((b) => {
        // if (b < 4 || b > k/2) return; // محدودیت منطقی برای تعداد bands

        const r = k / b;
        // if (r < 2 || r > 40) return; // محدودیت منطقی برای band size

        // محاسبه threshold نظری
        const theoreticalThreshold = Math.pow(1 / b, 1 / r);

        // انتخاب threshold های نزدیک به مقدار نظری
        targetSimilarities.forEach((targetThreshold) => {
          const diff = Math.abs(theoreticalThreshold - targetThreshold);
          if (diff < 0.5) {
            // فقط threshold های نزدیک
            combinations.push({
              NUM_HASH_FUNCTIONS: k,
              NUM_BANDS: b,
              SIMILARITY_THRESHOLD: targetThreshold,
              BAND_SIZE: r,
              theoreticalThreshold: theoreticalThreshold,
              expectedPerformance: predictPerformance(k),
              // expectedPerformance: predictPerformance(k, b, targetThreshold),
            });
          }
        });
      });
    });

    // حذف تکراری ها و مرتب کردن بر اساس کارایی پیش‌بینی شده
    const uniqueCombinations = removeDuplicates(combinations);

    const sortedCombinations = uniqueCombinations.sort(
      (a, b) => b.expectedPerformance - a.expectedPerformance
    );

    // sortedCombinations.forEach((u, index) => {
    //   console.log("=".repeat(30));

    //   console.log("index", index);
    //   console.log("NUM_HASH_FUNCTIONS", u.NUM_HASH_FUNCTIONS);
    //   console.log("NUM_BANDS", u.NUM_BANDS);
    //   console.log("SIMILARITY_THRESHOLD", u.SIMILARITY_THRESHOLD);
    //   console.log("BAND_SIZE", u.BAND_SIZE);
    //   console.log("theoreticalThreshold", u.theoreticalThreshold);
    //   console.log("expectedPerformance", u.expectedPerformance);

    //   console.log("=".repeat(30));
    // });

    return sortedCombinations;
  };

  // const a = generateSmartCombinations();

  // console.log(a);

  return (
    <div style={{ padding: "20px" }}>
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">
          IPFS + Blockchain Demo
        </h1>
        <IPFSUploader />
        <IPFSRetriever />
      </div>

      <h1>Article Processor</h1>

      <button
        onClick={handleProcessAll}
        disabled={loading || !articleList.length}
      >
        {loading ? "Processing all articles..." : "Process All Articles"}
      </button>
      <p>Status: {status}</p>

      <input
        min="1"
        type="number"
        value={readArticleId}
        onChange={(e) => {
          const value = e.target.value;
          if (value === "" || (/^\d+$/.test(value) && Number(value) >= 1)) {
            setReadArticleId(value);
          }
        }}
      />

      <button
        disabled={isNaN(Number(readArticleId)) || Number(readArticleId) < 1}
        onClick={handleViewStored}
      >
        Show Stored Sentences for Article {readArticleId}
      </button>

      {currentCid && (
        <div>
          <h3>IPFS CID for Article {readArticleId}</h3>
          <p>
            <code>{currentCid}</code>
          </p>
        </div>
      )}

      <h3>Stored Sentences for Article {readArticleId}</h3>
      <ul>
        {storedSentences.map((sentence, i) => (
          <li key={i}>{sentence}</li>
        ))}
      </ul>

      <button onClick={() => printRatioStatistics()}>print result</button>
    </div>
  );
}

export default App;
