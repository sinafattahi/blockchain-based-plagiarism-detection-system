// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


contract MerkleStorage {
    struct MerkleTree {
        bytes32 root;
        bytes32[] leaves;
        bytes32[] intermediates; // Intermediate nodes
        bool exists;
    }

    mapping(uint256 => MerkleTree) public trees;
    mapping(bytes32 => bool) public sentenceHashes; // Track hashes to prevent duplicates
    event MerkleTreeStored(uint256 indexed textId, bytes32 root, bytes32[] leaves, bytes32[] intermediates);

    function storeMerkleTree(
        uint256 textId,
        bytes32 root,
        bytes32[] calldata leaves,
        bytes32[] calldata intermediates
    ) external {
        require(!trees[textId].exists, "Tree already stored for textId");
        for (uint256 i = 0; i < leaves.length; i++) {
            require(!sentenceHashes[leaves[i]], "Duplicate leaf found");
            sentenceHashes[leaves[i]] = true;
        }
        trees[textId] = MerkleTree(root, leaves, intermediates, true);
        emit MerkleTreeStored(textId, root, leaves, intermediates);
    }

    function getMerkleTree(uint256 textId) external view returns (bytes32, bytes32[] memory, bytes32[] memory) {
        require(trees[textId].exists, "Tree does not exist");
        MerkleTree memory tree = trees[textId];
        return (tree.root, tree.leaves, tree.intermediates);
    }
}