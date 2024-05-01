import React, { useState } from 'react';
import axios from 'axios';
import './Chatbot.css';

const Chatbot = () => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false); // State to track loading status

  const handleQueryChange = (event) => {
    setQuery(event.target.value);
  };

  const handleSubmit = async () => {
    setLoading(true); // Start loading when the request is sent
    try {
      const pdfAnswerRes = await axios.post('http://localhost:3001/answer', { userQuery: query });
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: 'user', content: query, source: 'User' },
        { role: 'bot', content: pdfAnswerRes.data.answer, source: pdfAnswerRes.data.source },
      ]);
      setQuery('');
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false); // Stop loading once the response is received or in case of an error
  };

  const handleDownloadInfographic = async () => {
    const conversationText = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    try {
      const { data } = await axios.post('http://localhost:3001/infographic', { conversationText });
      window.open(data.imageUrl, '_blank');
    } catch (error) {
      console.error('Error downloading infographic:', error);
    }
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-messages">
        {messages.map((message, index) => (
          <div key={index} className={message.role}>
            {message.role === 'user' ? 'User: ' : 'Bot: '}
            {message.content}
          </div>
        ))}
      </div>
      <div className="chatbot-input">
        <input
          type="text"
          placeholder="Type your message..."
          value={query}
          onChange={handleQueryChange}
        />
        <button onClick={handleSubmit}>Send</button>
        <button onClick={handleDownloadInfographic}>Download Infographic</button>
      </div>
      <div className={loading ? "sand-timer" : "hidden"}>
        {/* Conditionally render the sand timer */}
      </div>
    </div>
  );
};

export default Chatbot;
