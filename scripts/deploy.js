import hardhat from "hardhat";
import process from "process";

const { ethers } = hardhat;

async function main() {
  const Greeter = await ethers.getContractFactory("Greeter");
  const greeter = await Greeter.deploy("Hello World");
  await greeter.deployed();

  console.log(`Contract successfully deployed to ${greeter.address}`);

  const ArticleTree = await ethers.getContractFactory("ArticleTree");
  const articleTree = await ArticleTree.deploy();
  await articleTree.deployed();

  console.log(`Contract deployed to: ${articleTree.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
