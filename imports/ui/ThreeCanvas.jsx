import React, { useRef, useState, useEffect, Fragment } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTracker } from 'meteor/react-meteor-data';
import { StatesCollection } from '/imports/db/StatesCollection';
import { AccountsCollection } from '/imports/db/AccountsCollection';
import { TransactionsCollection } from '/imports/db/TransactionsCollection';
import { Html } from '@react-three/drei';
import 'animate.css';

//const vertexMap = {};

const Vertex = ({ address, transactions, startingPosition, targetPosition, startingRotation, spinSign, isContract }) => {
  const ref = useRef();

  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
      document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);

  const spinFactor = Math.log(transactions.length)*0.01;

  useFrame((state, delta) => {
      ref.current.rotation.x += spinSign[0]*spinFactor;
      ref.current.rotation.y += spinSign[1]*spinFactor;
      ref.current.rotation.z += spinSign[2]*spinFactor;

      ref.current.position.x += ref.current.position.x > targetPosition[0] ? -0.0002 : 0.0002;
      ref.current.position.y += ref.current.position.y > targetPosition[1] ? -0.0002 : 0.0002;
      ref.current.position.z += ref.current.position.z > targetPosition[2] ? -0.001 : 0.001;
  });

  const color = isContract ? 'orange' : 'blue';
  let timeElapsed = null;

  if (clicked) {
    timeElapsed = transactions.length !== 0 ? new Date() - transactions[transactions.length-1].timestamp : null;
  }

  return (
    <mesh 
      position={ startingPosition }
      rotation={ startingRotation }
      ref={ ref }
      scale={ 1 }
      onPointerOver={ () => setHovered(true) }
      onPointerOut={ () => setHovered(false) }
      onClick={ () => setClicked(!clicked) }>
      { isContract ? <dodecahedronGeometry args={ [0.075, 0] } /> : <boxGeometry args={ [0.075, 0.075, 0.075] } />}
      <meshStandardMaterial color={ color } roughness={ 0.5 }/>
      { clicked ? 
        <Html>
          <div className="tag animate__animated animate__fadeIn animate__faster">
            <div className="content">
              <h2 className="tag__title">{ isContract ? `Contract at ${address}` : `EOA at ${address}` }</h2>
                <span>{ timeElapsed ? `Active ${Math.floor(timeElapsed/1000)} seconds ago` : '' }</span>
                <h2 className="tag__title">Transaction Hashes</h2>
                <ul className="tag__tx-list">
                  { transactions.map(tx => 
                    <li className="tag__tx-item">
                      { tx.hash }
                    </li>
                  ) }
                </ul>
            </div>
          </div>
        </Html> : ''
      }
    </mesh>
  );
};

export const ThreeCanvas = () => {
  const { state, accounts, transactions, isLoading } = useTracker(() => {
    const statesHandler = Meteor.subscribe('states');
    const accountsHandler = Meteor.subscribe('accounts');
    const transactionsHandler = Meteor.subscribe('transactions');

    if (!statesHandler.ready() || !accountsHandler.ready() || !transactionsHandler.ready()) {
      return { state: {}, accounts: [], transactions: [], isLoading: true };
    }

    return {
      state: StatesCollection.findOne({}),
      accounts: AccountsCollection.find({}).fetch(),
      transactions: TransactionsCollection.find({}).fetch(),
      isLoading: false
    };
  });

  return (
    <Fragment>
      <header className='page-header animate__animated animate__fadeIn'>
        <h1 className='page-header__title'>Moonriver Network Activity</h1>
        <h2 className='page-header__subtitle'>
          Block <span className='animate__animated animate__flash animate__fast' key={state.nextBlock}>
            { (state.nextBlock-1).toLocaleString() }</span>
        </h2>
      </header>
        <img className='moon' src='images/moon.png' alt='full moon'/>
        <div className='stars'></div>
        <div className='twinkling'></div>
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        { !isLoading && 
          accounts.map(account => 
            <Vertex 
              key={ account._id } 
              address={ account.address }
              transactions={ TransactionsCollection.find({ hash: { $in: account.transactionHashes } }).fetch() }
              startingPosition={ account.startingPosition }
              targetPosition={ account.targetPosition }
              startingRotation={ account.startingRotation }
              spinSign={ account.spinSign }
              isContract={ account.isContract }/>)
        }
      </Canvas>
    </Fragment>
  );
};
