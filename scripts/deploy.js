import hardhat from "hardhat";
import process from "process";

const { ethers } = hardhat;

async function main() {
  // const Greeter = await ethers.getContractFactory("Greeter");
  // const greeter = await Greeter.deploy("Hello World");
  // await greeter.deployed();

  // console.log(`Contract successfully deployed to ${greeter.address}`);

  // const ArticleTree = await ethers.getContractFactory("ArticleTree");
  // const articleTree = await ArticleTree.deploy();
  // await articleTree.deployed();

  // console.log(`Contract deployed to: ${articleTree.address}`);

  // const ArticleTrees = await ethers.getContractFactory("ArticleTrees");
  // const articleTrees = await ArticleTrees.deploy();
  // await articleTrees.deployed();

  // console.log(`Contract deployed to: ${articleTrees.address}`);

  // const MerkleStorage = await ethers.getContractFactory("MerkleStorage");
  // const contract = await MerkleStorage.deploy();
  // await contract.deployed();
  // console.log("MerkleStorage Contract deployed to:", contract.address);

  const SentenceStorage = await ethers.getContractFactory("SentenceStorage");
  const contract = await SentenceStorage.deploy();
  await contract.deployed();
  console.log("SentenceStorage deployed to:", contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
