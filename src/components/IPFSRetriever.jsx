import { useState } from "react";
import { getFromIPFS } from "../services/ipfsService";

const IPFSRetriever = () => {
  const [cid, setCid] = useState("");
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (e) => {
    setCid(e.target.value);
  };

  const handleRetrieve = async () => {
    if (!cid) return;

    try {
      setLoading(true);
      setError("");
      const data = await getFromIPFS(cid);
      setFileData(data);
      setLoading(false);
    } catch (error) {
      console.error("Retrieval error:", error);
      setError("Failed to retrieve file. Please check the CID and try again.");
      setLoading(false);
    }
  };

  const renderFilePreview = () => {
    if (!fileData) return null;

    // Try to determine the file type
    const firstBytes = Array.from(fileData.slice(0, 4));
    const hexString = firstBytes
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Simple magic number detection
    let fileType;
    if (hexString.startsWith("89504e47")) fileType = "image/png";
    else if (hexString.startsWith("ffd8ff")) fileType = "image/jpeg";
    else if (hexString.startsWith("47494638")) fileType = "image/gif";
    else if (hexString.startsWith("25504446")) fileType = "application/pdf";
    else fileType = "application/octet-stream";

    // Create a blob and URL for display/download
    const blob = new Blob([fileData], { type: fileType });
    const url = URL.createObjectURL(blob);

    return (
      <div className="mt-4">
        <h3 className="text-lg font-medium mb-2">File Preview</h3>

        {fileType.startsWith("image/") ? (
          <img
            src={url}
            alt="IPFS file"
            className="max-w-full h-auto rounded border"
          />
        ) : (
          <p>File retrieved successfully (not an image)</p>
        )}

        <a
          href={url}
          download={`ipfs-${cid}`}
          className="mt-2 inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Download File
        </a>
      </div>
    );
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm max-w-md mx-auto mt-8">
      <h2 className="text-xl font-semibold mb-4">IPFS File Retriever</h2>

      <div className="mb-4">
        <label
          htmlFor="cid-input"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Enter IPFS CID
        </label>
        <input
          id="cid-input"
          type="text"
          value={cid}
          onChange={handleInputChange}
          placeholder="Qm..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <button
        onClick={handleRetrieve}
        disabled={!cid || loading}
        className="px-4 py-2 bg-purple-600 text-white rounded-md
                  hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed"
      >
        {loading ? "Retrieving..." : "Retrieve from IPFS"}
      </button>

      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}

      {fileData && renderFilePreview()}
    </div>
  );
};

export default IPFSRetriever;
