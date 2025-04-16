// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArticleTrees {
    struct Node {
        uint256 id;
        uint256 parentId;
        bytes32 value;
    }

    struct Tree {
        uint256 treeId;
        uint256 rootId;
        Node[] nodes;
    }

    Tree[] public trees;
    uint256 public nextTreeId;

    event TreeAdded(uint256 treeId, uint256 rootId);

    // Function to add a new tree with multiple nodes
    function addTree(uint256[] memory ids, uint256[] memory parentIds, bytes32[] memory values) public {
        require(ids.length == parentIds.length && ids.length == values.length, "Array lengths must match");
        require(ids.length > 0, "Tree must contain at least one node");

        uint256 rootId = ids[0];
        Tree storage newTree = trees.push();
        newTree.treeId = nextTreeId;
        newTree.rootId = rootId;

        for (uint256 i = 0; i < ids.length; i++) {
            newTree.nodes.push(Node(ids[i], parentIds[i], values[i]));
        }

        emit TreeAdded(nextTreeId, rootId);
        nextTreeId++;
    }

    // Function to retrieve a tree by ID
    function getTree(uint256 treeId) public view returns (uint256, uint256, Node[] memory) {
        require(treeId < trees.length, "Tree does not exist");
        Tree storage tree = trees[treeId];
        return (tree.treeId, tree.rootId, tree.nodes);
    }

    // Function to get the total number of stored trees
    function getTotalTrees() public view returns (uint256) {
        return trees.length;
    }
}
