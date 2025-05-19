// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArticleStorage {
    // Mapping from articleId to IPFS CID (stored as string)
    mapping(uint256 => string) public articleCIDs;

    uint256 public totalArticles;

    event ArticleCIDStored(uint256 indexed articleId, string cid);

    function storeArticleCID(uint256 articleId, string calldata cid) external {
        require(bytes(articleCIDs[articleId]).length == 0, "Article already stored for articleId");
        require(bytes(cid).length > 0, "CID cannot be empty");

        articleCIDs[articleId] = cid;

        totalArticles += 1;

        emit ArticleCIDStored(articleId, cid);
    }

    function getArticleCID(uint256 articleId) external view returns (string memory) {
        require(bytes(articleCIDs[articleId]).length > 0, "Article does not exist");
        return articleCIDs[articleId];
    }
}
