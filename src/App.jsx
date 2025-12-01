import { useEffect, useState } from "react";
import {
  processArticle,
  getStoredArticle,
  provider,
  init,
  printStatistics,
  resetStatistics,
} from "./process";

import IPFSUploader from "./components/IPFSUploader";
import IPFSRetriever from "./components/IPFSRetriever";

function App() {
  const [articleList, setArticleList] = useState([]);
  const [status, setStatus] = useState("Idle");
  const [loading, setLoading] = useState(false);
  const [storedSentences, setStoredSentences] = useState([]);
  const [readArticleId, setReadArticleId] = useState("1");
  const [currentCid, setCurrentCid] = useState("");
  const [isInitialized, setIsInitialized] = useState(false); // ✅ اضافه شد

  const randomNumber = Math.round(Math.random() * 1000);

  const signer = provider.getSigner();

  async function requestAccount() {
    await window.ethereum.request({ method: "eth_requestAccounts" });
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleProcessAll = async () => {
    if (!isInitialized) {
      setStatus("System is still initializing... Please wait.");
      return;
    }

    setLoading(true);
    setStatus("Processing all articles...");

    try {
      for (let i = 0; i < articleList.length; i++) {
        const fileName = i + randomNumber;
        const response = await fetch(`/test/${articleList[i]}`);
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
      const result = await getStoredArticle(articleId, signer);

      if (result) {
        setStoredSentences(result.sentences);
        setCurrentCid(result.cid);
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

  const handlePrintStats = () => {
    printStatistics();
  };

  const handleResetStats = () => {
    if (window.confirm("Are you sure you want to reset all statistics?")) {
      resetStatistics();
      setStatus("Statistics reset successfully!");
    }
  };

  useEffect(() => {
    async function initialize() {
      try {
        setStatus("Initializing system...");

        await init(); // منتظر BERT load شدن
        setIsInitialized(true);
        setStatus("System initialized successfully!");

        // Fetch article list
        const response = await fetch("/test/list.json");
        const data = await response.json();
        setArticleList(data);
      } catch (err) {
        console.error("Error initializing:", err);
        setStatus("Failed to initialize system");
      }
    }

    initialize();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">
          IPFS + Blockchain Demo
        </h1>

        {/* ✅ نمایش وضعیت initialization */}
        {!isInitialized && (
          <div
            style={{
              padding: "10px",
              background: "#c03807ff",
              borderRadius: "5px",
              marginBottom: "20px",
            }}
          >
            ⏳ System is initializing (loading BERT model)... Please wait.
          </div>
        )}

        <IPFSUploader />
        <IPFSRetriever />
      </div>

      <h1>Article Processor</h1>

      <button
        onClick={handleProcessAll}
        disabled={loading || !articleList.length || !isInitialized}
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

      <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
        <button onClick={handlePrintStats}>📊 Print Statistics</button>

        <button
          onClick={handleResetStats}
          style={{ background: "#dc3545", color: "white" }}
        >
          🗑️ Reset Statistics
        </button>
      </div>
    </div>
  );
}

export default App;
