import { Meteor } from 'meteor/meteor';
import { AccountsCollection } from '../db/AccountsCollection';

Meteor.publish('accounts', function publishAccounts() {
    return AccountsCollection.find({});
});