import React, { useState } from 'react';
import axios from 'axios';

const UploadPDF = () => {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setUploadMessage('');
    } else {
      setUploadMessage('Please select a PDF file.');
      setFile(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setUploadMessage('No PDF file selected. Please select a file to upload.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await axios.post('http://localhost:3001/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: progressEvent => {
          let percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      setUploadMessage('Upload successful!');
      console.log('Response:', res.data);
    } catch (error) {
      console.error('Error:', error);
      setUploadMessage('Upload failed: ' + (error.response?.data?.message || 'Please try again.'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} accept="application/pdf" />
      <button onClick={handleSubmit} disabled={uploading || !file}>
        {uploading ? `Uploading (${uploadProgress}%)` : 'Upload PDF'}
      </button>
      {uploading && (
        <div style={{ width: '100%', backgroundColor: '#ddd' }}>
          <div style={{ height: '10px', backgroundColor: 'blue', width: `${uploadProgress}%` }}></div>
        </div>
      )}
      {uploadMessage && <p>{uploadMessage}</p>}
    </div>
  );
};

export default UploadPDF;
