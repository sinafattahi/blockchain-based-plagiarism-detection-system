// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArticleStorage {
    mapping(uint256 => bytes32[]) public articles;

    uint256 public totalArticles;

    event ArticleHashesStored(uint256 indexed articleId, bytes32[] hashes);

    function storeArticle(uint256 articleId, bytes32[] calldata hashes) external {
        require(articles[articleId].length == 0, "Article already stored for articleId");

        for (uint256 i = 0; i < hashes.length; i++) {
            articles[articleId].push(hashes[i]);
        }

        totalArticles += 1;

        emit ArticleHashesStored(articleId, hashes);
    }

    function getArticleHashes(uint256 articleId) external view returns (bytes32[] memory) {
        require(articles[articleId].length > 0, "Article does not exist");
        return articles[articleId];
    }
}
