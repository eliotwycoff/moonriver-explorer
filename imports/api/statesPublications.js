import { Meteor } from 'meteor/meteor';
import { StatesCollection } from '../db/StatesCollection';

Meteor.publish('states', function publishStates() {
    return StatesCollection.find({});
});