const hre = require("hardhat");

async function main() {
  const TicTacToe = await hre.ethers.getContractFactory("TicTacToe");
  const ticTacToe = await TicTacToe.deploy(); 

  await ticTacToe.waitForDeployment(); // Wait for the deployment to complete

  console.log("TicTacToe deployed to:", ticTacToe.target); // Access the address correctly
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });