import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
//import { render } from 'react-dom';
import { ThreeCanvas } from '/imports/ui/ThreeCanvas';

Meteor.startup(() => {
  //render(<App/>, document.getElementById('react-target'));
  createRoot(document.getElementById('react-target')).render(
    <ThreeCanvas/>
  );
});
