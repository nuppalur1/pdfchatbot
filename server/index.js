// Import required modules using ES6 import syntax
import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import cors from 'cors';
import multer from 'multer';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OpenAI } from "@langchain/openai";
import { loadQAStuffChain } from "langchain/chains";
import { Pinecone } from '@pinecone-database/pinecone';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import dotenv from 'dotenv';
import path from "path";


// Load environment variables
dotenv.config();
const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());


// Initialize Pinecone Configuration
const indexName = "pdfchatbot-1";
const pineconeClient = new Pinecone({apiKey: process.env.PINECONE_API_KEY});

// Pinecone Index Initialization
async function initializePineconeIndex() {
  try {
      console.log(`Checking if "${indexName}" exists...`);
      const result = await pineconeClient.listIndexes();
      const indexes = result.indexes || [];
      console.log("Indexes currently in Pinecone:", indexes.map(index => index.name)); // Assuming 'name' is the key where index names are stored

      if (indexes.some(index => index.name === indexName)) {
          console.log(`"${indexName}" already exists. No need to create.`);
      } else {
          console.log(`"${indexName}" does not exist. Creating now...`);
          try {
              await pineconeClient.createIndex({
                  name: indexName,
                  dimension: 1536,
                  metric: "cosine",
                  spec: {
                      serverless: {
                          cloud: 'aws',
                          region: 'us-east-1'
                      }
                  }
              });
              console.log('Index created successfully.');
          } catch (creationError) {
              if (creationError.response && creationError.response.status === 409) {
                  console.log(`"${indexName}" index already exists. Skipping creation.`);
              } else {
                  throw creationError; // Rethrow error if it's not a conflict
              }
          }
      } 
  } catch (error) {
      console.error(`Failed to check or initialize "${indexName}" index:`, error);
  }
}
initializePineconeIndex().then(() => {
    console.log('Pinecone index initialized successfully.');
}).catch(err => {
    console.error('Failed to initialize Pinecone index:', err);
});


// Setup Multer for file upload
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: join(__dirname, 'uploads'), // Use path.join to safely create the path
  filename: function(req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });


// End point for uploading the PDFs to pinecone vector DB
app.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
      return res.status(400).send('No file uploaded.');
  }

  console.log('Received file:', req.file.filename);

  const filePath = join(__dirname, 'uploads', req.file.filename);
  console.log(`Filepath is ${filePath}`);

  try {
      
      const pdfLoader = new PDFLoader(filePath);
      const documents = await pdfLoader.load();

      for (const document of documents) {

        const txtPath = document.metadata.source;
        const textContent = document.pageContent;

        console.log(`text content is ${textContent}`);
        const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
        const chunks = await textSplitter.createDocuments([textContent]);
        console.log(`Text split into ${chunks.length} chunks`);

        const embeddingsArrays = await new OpenAIEmbeddings().embedDocuments(
          chunks.map((chunk) => chunk.pageContent.replace(/\n/g, " "))
        );
        // Create and upsert vectors in batches of 100
        const index = pineconeClient.Index(indexName);
        const batchSize = 100;
        let batch = [];
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          const vector = {
            id: `${txtPath}_${idx}`,
            values: embeddingsArrays[idx],
            metadata: {
              ...chunk.metadata,
              loc: JSON.stringify(chunk.metadata.loc),
              pageContent: chunk.pageContent,
              txtPath: txtPath,
            },
          };
          batch.push(vector);
          // When batch is full or it's the last item, upsert the vectors
          if (batch.length === batchSize || idx === chunks.length - 1) {
            await index.upsert(batch);
            // Empty the batch
            batch = [];
          }
        }
        console.log(`Pinecone index updated with ${chunks.length} vectors`);
      }
      res.send({ success: true, message: 'File processed and embeddings uploaded successfully.' });
  } catch (error) {
      console.error('Failed to process file:', error);
      res.status(500).send(`Failed to process file: ${error.message}`);
  }
});

// End point for providing the response to the user queries
app.post('/answer', async (req, res) => {
  const { userQuery } = req.body;
  console.log(`Received question: ${userQuery}`);

  if (!userQuery) {
      return res.status(400).send("No question provided.");
  }

  try {
      // Retrieve the Pinecone index
      const index = pineconeClient.Index(indexName);
      let answer = null;

      // Create query embedding
      console.log("Creating query embedding...");
      // Query Pinecone index and return top 10 matches
      const queryEmbedding = await new OpenAIEmbeddings().embedQuery(userQuery);
      let queryResponse = await index.query({
        topK: 10,
        vector: queryEmbedding,
        includeMetadata: true,
        includeValues: true,
      });

      console.log(`Found ${queryResponse.matches.length} matches...`);
      console.log(`Asking question: ${userQuery}...`);
      if (queryResponse.matches.length) {
        // Create an OpenAI instance and load the QAStuffChain
            const llm = new OpenAI({});
            const chain = loadQAStuffChain(llm);
        // Extract and concatenate page content from matched documents
            const concatenatedPageContent = queryResponse.matches
              .map((match) => match.metadata.pageContent)
              .join(" ");
        // Execute the chain with input documents and question
            const result = await chain.invoke({
              input_documents: [new Document({ pageContent: concatenatedPageContent })],
              question: userQuery,
            });
            answer = result.text;
            console.log(`Answer: ${answer}`);
      } else {
        // Log that there are no matches, so GPT will not be queried
            console.log("Since there are no matches, GPT will not be queried.");
      }
      
      res.send({answer});
  } catch (error) {
      console.error("Error processing /answer request:", error);
      res.status(500).send("An error occurred while processing your question.");
  }
});

// End point for downloading the infographic image
app.post('/infographic', async (req, res) => {
  const { conversationText } = req.body;

  console.log(`${conversationText}`);

  const createImagePrompt = (text) => {
    //const basePrompt = `Design an infographic that visually represents the following key points in a clean and professional style: ${text}`;
    const basePrompt = `Design an infographic that visually represents the following key points in a clean and professional style. Show the content as bullet points in a PPT: ${text}`;
    const finalPrompt = basePrompt.length > 1000 ? basePrompt.substring(0, 997) + '...' : basePrompt;
    return finalPrompt;
  };

  const imagePrompt = createImagePrompt(conversationText);

  //use Dall-E model to generate the infographics
  try {
    const imageResponse = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1792x1024"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    res.json({ imageUrl: imageResponse.data.data[0].url });
  } catch (error) {
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    } else if ( error.request) {
      console.error("Error request:", error.request);
    } else {
      console.error("Error message:", error.message);
    }
    res.status(500).json({ message: "Error generating image", details: error.message });
  }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
