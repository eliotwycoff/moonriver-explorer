import { Meteor } from 'meteor/meteor';
import { Jobs } from 'meteor/msavin:sjobs';
import { StatesCollection } from '/imports/db/StatesCollection';
import { TransactionsCollection } from '/imports/db/TransactionsCollection';
import { AccountsCollection } from '/imports/db/AccountsCollection';
import '/imports/api/statesMethods.js';
import '/imports/api/statesPublications.js';
import '/imports/api/accountsMethods.js';
import '/imports/api/accountsPublications.js';
import '/imports/api/transactionsMethods.js';
import '/imports/api/transactionsPublications.js';

const config = {
	storedBlockHeight: 20
}

try {
	// This works in development.
	require('dotenv').config({ path: Assets.absoluteFilePath('.env') });
	config.rpc = process.env.RPC_URL
	config.ws = process.env.WS_URL
} catch(error) {
	// But it fails on Meteor's free hosting solution, "Galaxy,"
	// so we have to get the environment variables in a different way.
	config.rpc = Meteor.settings.RPC_URL
	config.ws = Meteor.settings.WS_URL
}

const ethers = require('ethers');

const provider = new ethers.providers.StaticJsonRpcProvider(config.rpc);

const insertTransaction = (tx, timestamp) => {
	// Only insert the transaction if it's not already in the databse.
	if (!TransactionsCollection.findOne({ hash: tx.hash })) {
		// Insert the transaction.
		TransactionsCollection.insert({
			hash: tx.hash,
			blockNumber: tx.blockNumber,
			from: tx.from,
			to: tx.to,
			value: ethers.utils.formatUnits(tx.value, 18),
			timestamp: new Date(timestamp*1000)
		});

		// Update the account information.
		const addresses = [tx.from, tx.to];

		for (let address of addresses) {
			const account = AccountsCollection.findOne({ address: address });
			if (!account) {
				// Determine whether this is an EOA or a contract address.
				provider.getCode(address)
					.then((code) => {
						const startingPosition = [
							Math.random()*8 - 4, // x in [-4, 4]
							Math.random()*6 - 3, // y in [-3, 3]
							5 // start at z = 5, outside the FOV
						];

						const targetPosition = [
							startingPosition[0],
							startingPosition[1],
							0 // but vector into the FOV
						];

						const startingRotation = [
							Math.PI*Math.random(),
							Math.PI*Math.random(),
							Math.PI*Math.random()
						];

						const spinSign = [0, 0, 0];
						const spinAxis = Math.floor(3*Math.random());
						spinSign[spinAxis] = Math.random() > 0.5 ? 1 : -1;
						
						AccountsCollection.insert({
							address: address,
							transactionHashes: [tx.hash],
							isContract: code !== '0x',
							latestBlock: tx.blockNumber,
							startingPosition: startingPosition,
							targetPosition: targetPosition,
							startingRotation: startingRotation,
							spinSign: spinSign
						});
					})
					.catch((error) => {
						console.log(`Could not fetch account information for ${address}!`);
					});
			} else {
				const transactionHashes = account.transactionHashes;
				transactionHashes.push(tx.hash);

				AccountsCollection.update(account._id, {
					$set: { 
						transactionHashes: transactionHashes,
						latestBlock: tx.blockNumber 
					}
				});
			}
		}
	}
};

const removeDocumentsBefore = (blockHeight) => {
	const oldTransactions = TransactionsCollection.find({ 
		blockNumber: { $lt: blockHeight } 
	}).fetch();

	// Remove all the hashes of these transactions from the associated accounts.
	try {
		oldTransactions.map((tx) => {
			const addresses = [tx.from, tx.to];
			addresses.map((address) => {
				const account = AccountsCollection.findOne({ address: address });

				if (!account) return;

				const transactionHashes = account.transactionHashes;
				const index = transactionHashes.indexOf(tx.hash);
				if (index > -1) transactionHashes.splice(index, 1);
	
				if (transactionHashes.length === 0) {
					// Remove the account if it has no associated transactions left.
					AccountsCollection.remove({ address: address });
				} else {
					// Otherwise, update it with its new transaction hashes array.
					AccountsCollection.update(account._id, {
						$set: { transactionHashes: transactionHashes }
					});
				}
			});
		});
	} catch (error) {
		console.error(error);
	}
	
	// Remove the transactions.
	TransactionsCollection.remove({
		blockNumber: { $lt: blockHeight }
	});
};

const updateTargetPositions = (state, accounts) => {
	const MAX_DISPERSION = 0.65; // 65% at max depth

	accounts.map((account) => {
		const blockRecency = state.nextBlock - account.latestBlock - 1; // [0, 20]
		const depthRatio = blockRecency/state.storedBlockHeight; // [0, 1]
		const dispersion = MAX_DISPERSION*depthRatio + 1; // [1, 1.5]

		// Update the target coordinates.
		AccountsCollection.update(account._id, {
			$set: {
				targetPosition: [
					account.startingPosition[0]*dispersion, // spread x with depth
					account.startingPosition[1]*dispersion, // spread y with depth
					-5*depthRatio // z in [0, -5]
				]
			}
		});
	});
};

Meteor.startup(() => {
	// Get the state document.
	let state = StatesCollection.findOne({});

	// Check for the latest block number and set the state information accordingly.
	provider.getBlockNumber()
		.then((blockNumber) => {
			// For debugging purposes in production:
			console.log('Successfully connected to the provider!');

			if (!state) {
				state = { 
					nextBlock: blockNumber,
					storedBlockHeight: config.storedBlockHeight };
				StatesCollection.insert(state);
			} else {
				state.nextBlock = blockNumber;
				StatesCollection.update(state._id, {
					$set: { 
						nextBlock: blockNumber,
						storedBlockHeight: config.storedBlockHeight }
				});
			}
		}).catch((error) => {
			console.error('Could not establish a connection with the provider!');
	});

	// Create indexes on the transactions and accounts collections, if they don't already exist.
	TransactionsCollection.createIndex({ hash: 1 });
	TransactionsCollection.createIndex({ blockNumber: 1 });
	TransactionsCollection.createIndex({ from: 1 });
	TransactionsCollection.createIndex({ to: 1 });
	AccountsCollection.createIndex({ address: 1 });

	// Clear out old transactions and accounts information, starting clean.
	TransactionsCollection.remove({});
	AccountsCollection.remove({});

	// Clear out any old jobs, and re-register the main sync loop.
	Jobs.clear();
	Jobs.register({
		'transactionSyncLoop': async function() {
			// Get the current state (and next block number).
			state = StatesCollection.findOne({});

			if (state) { // on startup, the state might not yet exist
				// Try to get the transactions for this block.
				provider.getBlockWithTransactions(state.nextBlock)
					.then((data) => {
						// If the block exists and no errors occurred, save the transactions and related accounts.
						console.log(`Parsing data from block ${state.nextBlock}!`);
						data.transactions.map(tx => insertTransaction(tx, data.timestamp));
				
						// Update the state document.
						StatesCollection.update(state._id, {
							$set: { nextBlock: state.nextBlock + 1 }
						});

						// Remove old transactions and accounts.
						removeDocumentsBefore(state.nextBlock-state.storedBlockHeight);

						// Update the target positions of each account.
						const accounts = AccountsCollection.find({}).fetch();
						updateTargetPositions(state, accounts);

						// Output some stats to the console.
						const contracts = AccountsCollection.find({ isContract: true }).fetch();
						const eoas = AccountsCollection.find({ isContract: false }).fetch();

						console.log(`Accounts  : ${accounts.length}`);
						console.log(` Contracts: ${contracts.length}`);
						console.log(` EOAs     : ${eoas.length}`);
						console.log(`Transactions : ${TransactionsCollection.find({}).count()}`);
						console.log(` Per Contract: ${contracts.reduce((a,c) => a + c.transactionHashes.length, 0)/contracts.length}`);
						console.log(` Per EOA     : ${eoas.reduce((a,c) => a + c.transactionHashes.length, 0)/eoas.length}`);
						console.log('.');
					})
					.catch((error) => {
						// Otherwise, let the user know that we are waiting on the next block.
						//console.log(`Waiting on block ${state.nextBlock}...`);
						console.log('.');
				}); 
			}

			// Repeat this job in 6 seconds.
			this.replicate({
				in: { seconds: 6 }
			});

			// Remove this (expired) instance of this job.
			this.remove();
		}
  	});

	// Start the sync loop.
	Jobs.run('transactionSyncLoop', { singular: true });
  	//Jobs.stop('transactionSyncLoop');
});
