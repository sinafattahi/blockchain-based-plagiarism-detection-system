// src/pdf/new.mjs
import fs from "node:fs";
import pkg from "pdfjs-dist/build/pdf.js"; // Default import for CommonJS
const { getDocument, GlobalWorkerOptions } = pkg;

async function extractText(pdfPath) {
  try {
    // // Set the worker source correctly for ES modules with CommonJS module
    // GlobalWorkerOptions.workerSrc = new URL(
    //   "../../../node_modules/pdfjs-dist/build/pdf.worker.js",
    //   import.meta.url
    // ).href;

    const pdf = await getDocument(pdfPath).promise;
    let paragraphs = [];
    let currentParagraph = "";
    let lastY = null;
    const yThreshold = 14;
    let startCollecting = false; // Flag to start after "Abstract"
    let stopCollecting = false; // Stop at "References"

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      console.log(`Page ${i} - Raw Text Chunks:`);
      for (const [idx, item] of textContent.items.entries()) {
        const text = item.str;
        const yPos = item.transform[5];
        console.log(`[${idx}] y:${yPos}, text:"${text}"`);

        // Start at "Abstract"
        if (text.toLowerCase().includes("abstract")) {
          startCollecting = true;
          currentParagraph = ""; // Reset to avoid pre-Abstract text
          continue; // Skip this chunk
        }

        // Stop completely at "References"
        if (text.toLowerCase().includes("references")) {
          if (currentParagraph.trim()) {
            paragraphs.push(currentParagraph.trim()); // Add last paragraph
          }
          console.log("Stopping at 'References'");
          // Filter and write paragraphs before exiting
          const filteredParagraphs = paragraphs.filter(
            (para) => para.length >= 100
          );
          const outputPath = "bye.txt";
          fs.writeFileSync(
            outputPath,
            filteredParagraphs
              .map(
                (p, i) => `Paragraph ${i + 1}:\n${p}\n\n${"=".repeat(50)}\n\n`
              )
              .join("")
          );
          console.log(
            `Wrote ${
              filteredParagraphs.length
            } paragraphs to ${outputPath} (filtered: ${
              paragraphs.length - filteredParagraphs.length
            } removed)`
          );
          return; // Exit the function entirely
        }

        if (!startCollecting) continue; // Skip before "Abstract"

        if (lastY !== null && Math.abs(yPos - lastY) > yThreshold) {
          if (currentParagraph.trim()) {
            paragraphs.push(currentParagraph.trim());
          }
          currentParagraph = "";
        }

        currentParagraph += text + (text && !text.endsWith(" ") ? " " : "");
        lastY = yPos;
      }
    }

    // If we reach here (no "References" found), write what we have
    if (startCollecting && currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim());
    }

    console.log(`\nDetected ${paragraphs.length} paragraphs:`);
    paragraphs.forEach((para, i) => {
      console.log(`Paragraph ${i + 1}: ${para.slice(0, 50)}...`);
    });

    // Filter paragraphs with length >= 100 characters
    const filteredParagraphs = paragraphs.filter((para) => para.length >= 100);

    const outputPath = "bye.txt";
    fs.writeFileSync(
      outputPath,
      filteredParagraphs
        .map((p, i) => `Paragraph ${i + 1}:\n${p}\n\n${"=".repeat(50)}\n\n`)
        .join("")
    );
    console.log(
      `Wrote ${filteredParagraphs.length} paragraphs to ${outputPath}`
    );
  } catch (error) {
    console.error(`Error processing PDF: ${error.message}`);
  }
}

const pdfPath = "./2.pdf"; // Relative to src/pdf/
if (!fs.existsSync(pdfPath)) {
  console.error(`PDF file not found at: ${pdfPath}`);
} else {
  extractText(pdfPath);
}
