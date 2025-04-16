// src/pdf/new.mjs
import fs from "node:fs";
import pkg from "pdfjs-dist/build/pdf.js"; // Default import for CommonJS
const { getDocument } = pkg;

async function extractText(pdfPath) {
  try {
    const pdf = await getDocument(pdfPath).promise;
    let sentences = [];
    let currentSentence = "";
    let lastY = null;
    const yThreshold = 5; // For detecting gaps, if needed
    let startCollecting = false;

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
          currentSentence = "";
          continue;
        }

        // Stop at "References"
        if (text.toLowerCase().includes("references")) {
          if (currentSentence.trim()) {
            // Split currentSentence into sentences
            const splitSentences = currentSentence
              .trim()
              .split(/(?<=[.!?])\s+/);
            sentences.push(...splitSentences.filter((s) => s.trim()));
          }
          console.log("Stopping at 'References'");
          // Filter and write sentences
          const filteredSentences = sentences.filter((s) => s.length >= 20);
          const outputPath = "hello.txt";
          fs.writeFileSync(
            outputPath,
            filteredSentences
              .map(
                (s, i) => `Sentence ${i + 1}:\n${s}\n\n${"=".repeat(50)}\n\n`
              )
              .join("")
          );
          console.log(
            `Wrote ${
              filteredSentences.length
            } sentences to ${outputPath} (filtered: ${
              sentences.length - filteredSentences.length
            } removed)`
          );
          return; // Exit entirely
        }

        if (!startCollecting) continue;

        // Add text to current sentence
        currentSentence += text + (text && !text.endsWith(" ") ? " " : "");

        // Check for sentence boundary (punctuation + gap or new chunk)
        if (
          (lastY !== null && Math.abs(yPos - lastY) > yThreshold) ||
          idx === textContent.items.length - 1
        ) {
          // Split accumulated text into sentences
          const splitSentences = currentSentence.trim().split(/(?<=[.!?])\s+/);
          sentences.push(...splitSentences.filter((s) => s.trim()));
          currentSentence = "";
        }

        lastY = yPos;
      }
    }

    // Handle any remaining text
    if (startCollecting && currentSentence.trim()) {
      const splitSentences = currentSentence.trim().split(/(?<=[.!?])\s+/);
      sentences.push(...splitSentences.filter((s) => s.trim()));
    }

    console.log(`\nDetected ${sentences.length} sentences (from Abstract):`);
    sentences.forEach((s, i) => {
      console.log(`Sentence ${i + 1}: ${s.slice(0, 50)}...`);
    });

    // Filter sentences with length >= 20 characters
    const filteredSentences = sentences.filter((s) => s.length >= 20);

    const outputPath = "hello.txt";
    fs.writeFileSync(
      outputPath,
      filteredSentences
        .map((s, i) => `Sentence ${i + 1}:\n${s}\n\n${"=".repeat(50)}\n\n`)
        .join("")
    );
    console.log(
      `Wrote ${
        filteredSentences.length
      } sentences to ${outputPath} (filtered: ${
        sentences.length - filteredSentences.length
      } removed)`
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
