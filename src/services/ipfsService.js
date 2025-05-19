// Step 2: Create an IPFS service file (src/services/ipfsService.js)
import { create } from "ipfs-http-client";
import { Buffer } from "buffer";

// Connect to the IPFS node
// Option 1: Connect to local IPFS node (if you have IPFS Desktop or daemon running)
const ipfs = create({ url: "http://localhost:5001/api/v0" });

// Option 2: Connect to Infura's IPFS node (requires authentication)
// const ipfs = create({
//   host: 'ipfs.infura.io',
//   port: 5001,
//   protocol: 'https',
//   headers: {
//     authorization: 'Basic ' + Buffer.from(PROJECT_ID + ':' + API_KEY).toString('base64')
//   }
// });

// Upload a file to IPFS
export const uploadToIPFS = async (file) => {
  try {
    const added = await ipfs.add(file, {
      progress: (prog) => console.log(`Received: ${prog}`),
    });
    return added.cid.toString();
  } catch (error) {
    console.error("Error uploading file to IPFS:", error);
    throw error;
  }
};

// Get a file from IPFS
export const getFromIPFS = async (cid) => {
  try {
    const stream = ipfs.cat(cid);
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Error getting file from IPFS:", error);
    throw error;
  }
};
