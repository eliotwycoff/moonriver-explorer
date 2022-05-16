import { Meteor } from 'meteor/meteor';
import { TransactionsCollection } from '../db/TransactionsCollection';

Meteor.publish('transactions', function publishTransactions() {
    return TransactionsCollection.find({});
});