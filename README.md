# Moonriver Explorer
A three-js, real-time window into transactions from the last 20 blocks on Moonriver, hacked together in two days

## Setup
To get this working, you will need a free api url/key from a Moonriver provider. I went with On Finality: https://app.onfinality.io. Create a "private" folder in the project's root directory, and put the api url/key in a .env file in this folder. E.g.: RPC_URL=[your api url/key]

This is a Meteor/React project, so once you're all set, run "meteor run" in your root directory.

## Live Demo

A recent build of this project is hosted at https://moonriver-explorer.meteorapp.com. Depending on when you view it, the app may have to do a cold start (which takes 1-2 minutes), as the app is on a free hosting plan that shuts down when there are no client connections. Just leave the page open, and it will load, eventually.

## Credits
This was my first time using three.js, and the following examples were immensely useful: https://docs.pmnd.rs/react-three-fiber/getting-started/examples.

Thanks is also due to Anastasia Goodwin for her "twinkling stars" codepen: https://codepen.io/agoodwin/pen/NMJoER.
