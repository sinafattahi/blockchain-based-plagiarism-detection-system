import { useState } from "react";
import { uploadToIPFS } from "../services/ipfsService";

const IPFSUploader = () => {
  const [file, setFile] = useState(null);
  const [cid, setCid] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      const fileData = await file.arrayBuffer();
      const result = await uploadToIPFS(new Uint8Array(fileData));
      setCid(result);
      setUploading(false);
    } catch (error) {
      console.error("Upload error:", error);
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">IPFS File Uploader</h2>

      <div className="mb-4">
        <input
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md
                  hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
      >
        {uploading ? "Uploading..." : "Upload to IPFS"}
      </button>

      {cid && (
        <div className="mt-4">
          <p className="text-sm font-medium">File uploaded successfully!</p>
          <p className="text-sm break-all">CID: {cid}</p>
          <p className="text-sm mt-2">
            Access your file at:{" "}
            <a
              href={`https://ipfs.io/ipfs/${cid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              https://ipfs.io/ipfs/{cid}
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

export default IPFSUploader;
