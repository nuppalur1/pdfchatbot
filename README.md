# pdfchatbot
Dissertation Project


#1	System Requirements  
	Node.js  
 	npm (Node Package Manager)  
  	A modern web browser (e.g., Chrome, Firefox)  
#2	Required Libraries  
	React: A JavaScript library for building user interfaces.  
 	axios: A promise-based HTTP client for making requests to the backend.  
  	CSS: For styling the chatbot and upload components.
	Express: Web application framework for Node.js.
	Body-parser: Middleware to parse incoming request bodies.
	Axios: HTTP client for making requests.
	Cors: Middleware to enable CORS (Cross-Origin Resource Sharing).
	Multer: Middleware for handling multipart/form-data for uploading files.
	Dotenv: Loads environment variables from a .env file into process.env.
	LangChain: For document processing and NLP tasks.
	Pinecone: A scalable vector database client for storing and querying vector embeddings.
#3	Installation Steps
	Setup Node.js Environment: Ensure Node.js and npm are installed on your system.
	Project Initialization: Create a new React project using the create-react-app command.
        npx create-react-app pdfchatbot
        cd pdfchatbot
#4	Install Axios and Additional Dependencies: 
    Run the following commands to add axios and other necessary libraries to your project.
            npm install express body-parser axios cors multer dotenv @langchain/openai @pinecone-database/pinecone


#5    Start the Client and nodejs Server
        npm run start


