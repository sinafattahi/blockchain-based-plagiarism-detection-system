// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract ArticleTree {
    struct Node {
        uint256 id;
        uint256 parentId;
        bytes32 value;
    }

    mapping(uint256 => Node) public nodes;
    uint256[] public nodeIds; // Stores all node IDs for iteration

    event NodeAdded(uint256 id, uint256 parentId, bytes32 value);

    // Function to add multiple nodes at once
    function addNodes(uint256[] memory ids, uint256[] memory parentIds, bytes32[] memory values) public {
        require(ids.length == parentIds.length && ids.length == values.length, "Array lengths must match");

        for (uint256 i = 0; i < ids.length; i++) {
            require(nodes[ids[i]].id == 0, "Node ID already exists");

            nodes[ids[i]] = Node(ids[i], parentIds[i], values[i]);
            nodeIds.push(ids[i]);

            emit NodeAdded(ids[i], parentIds[i], values[i]);
        }
    }

    // Function to get a node by ID
    function getNode(uint256 nodeId) public view returns (uint256, uint256, bytes32) {
        require(nodes[nodeId].id != 0, "Node does not exist");
        Node storage node = nodes[nodeId];
        return (node.id, node.parentId, node.value);
    }

    // Function to get all stored node IDs
    function getAllNodeIds() public view returns (uint256[] memory) {
        return nodeIds;
    }
}
