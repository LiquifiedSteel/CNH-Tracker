import React from 'react';
import { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios({
      method: 'GET',
      url: '/api/test'
    }).then(response => setMessage(response.data))
      .catch(err => console.error("Failed to recieve message: ", err));
  }, [])

  return (
    <div>
      <h1>Hello from React</h1>
      <p>{message && message}</p>
    </div>
  );
}

export default App;
