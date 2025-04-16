// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SentenceStorage {
    // Mapping of textId to array of sentences
    mapping(uint256 => string[]) public articles;
    mapping(bytes32 => bool) public sentenceHashes;

    event SentencesStored(uint256 indexed textId, string[] sentences);

    function storeSentences(uint256 textId, string[] calldata sentences) external {
        require(articles[textId].length == 0, "Article already stored for textId");
        
        // Explicitly copy sentences to storage
        string[] storage article = articles[textId];
        for (uint256 i = 0; i < sentences.length; i++) {
            bytes32 hash = keccak256(abi.encodePacked(sentences[i]));
            require(!sentenceHashes[hash], "Duplicate sentence found");
            sentenceHashes[hash] = true;
            article.push(sentences[i]);
        }

        emit SentencesStored(textId, article);
    }

    function getSentences(uint256 textId) external view returns (string[] memory) {
        require(articles[textId].length > 0, "Article does not exist");
        return articles[textId];
    }
}