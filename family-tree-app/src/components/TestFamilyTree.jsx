import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TestFamilyTree = () => {
  const [family, setFamily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch family data
  const fetchFamilyData = () => {
    console.log("Fetching family data...");
    setLoading(true);
    setError(null);
    
    // Add timestamp to prevent browser caching
    axios.get(`/api/family?t=${Date.now()}`)
      .then(res => {
        console.log("Received family data:", res.data.length, "records");
        console.log("First few records:", res.data.slice(0, 3));
        setFamily(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError("Failed to load family data: " + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFamilyData();
  }, []);

  if (loading) {
    return <div style={{textAlign: 'center', padding: '20px'}}>Loading family data...</div>;
  }

  if (error) {
    return <div style={{textAlign: 'center', padding: '20px', color: 'red'}}>Error: {error}</div>;
  }

  if (family.length === 0) {
    return <div style={{textAlign: 'center', padding: '20px'}}>No family data found.</div>;
  }

  return (
    <div style={{padding: '20px'}}>
      <h1>Family Tree Debug View</h1>
      <p>Total members: {family.length}</p>
      
      <div style={{marginTop: '20px'}}>
        <h2>First 10 Members:</h2>
        {family.slice(0, 10).map(member => (
          <div key={member.id} style={{border: '1px solid #ccc', margin: '10px', padding: '10px'}}>
            <p><strong>ID:</strong> {member.id}</p>
            <p><strong>Name:</strong> {member.name}</p>
            <p><strong>Parents:</strong> {JSON.stringify(member.parents)}</p>
            <p><strong>Children:</strong> {JSON.stringify(member.children)}</p>
            <p><strong>Spouses:</strong> {JSON.stringify(member.spouses)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestFamilyTree;