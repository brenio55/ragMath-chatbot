# CloudWalk RAG React - Technical Challenge

This project was developed as a technical challenge for CloudWalk, focusing on building a Retrieval Augmented Generation (RAG) system with a React frontend and a Node.js backend. The application provides a conversational interface where users can interact with an AI agent that retrieves information from a knowledge base and generates responses.

## Project Overview

![CloudWalk RAG React Chat Interface](https://github.com/user-attachments/assets/e44eac2b-045e-4ed7-bc83-223417d4d944)

The system consists of:

*   **Frontend (React):** A user-friendly chat interface that allows users to send queries to the AI agent and view the responses, including source documents and the agent's decision-making process.
*   **Backend (Node.js):** Handles API requests, interacts with the RAG system with Langchain, and provide a feedback with the source of the feedback. The backend is stil being developed to contain two automatic Router Agents related to Math or Knowledge.

## Features Implemented in Frontend Adjustments

*   **Simplified Chat Interface:** The initial role selection screen has been removed, defaulting to a "KnowledgeAgent" persona.
*   **Modularized Components:** The frontend code has been refactored into smaller, reusable components (`LoadingDots`, `ChatContainer`) for better organization and maintainability.
*   **Axios for API Calls:** API interactions are now managed through a dedicated `chatApi.jsx` file using Axios, improving request handling and separation of concerns.
*   **Enhanced System Messages:** System responses now dynamically display the responsible agent (e.g., "Agent: KB"), the router's decision based on the last prompt, and clickable links to source documents.
*   **Real-time JSON Response Display:** A dedicated section shows the raw JSON response received from the backend, aiding in debugging and understanding the API interaction.
*   **Improved UI/UX:** The chat interface has been styled to resemble a simplified ChatGPT, with increased chat screen size and better button alignment.
*   **Chat and User Information:** The current chat ID and a fixed user ID ("brenio") are displayed in the top-right corner for easy reference.

## Installation

To set up the project, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd cloudwalk-rag-react
    ```

2.  **Install Frontend Dependencies:**
    Navigate to the root directory of the project and install the dependencies:
    ```bash
    npm install
    ```

3.  **Install Backend Dependencies:**
    Navigate to the `backend` directory and install its dependencies:
    ```bash
    cd backend
    npm install
    cd ..
    ```

4.  **Environment Variables:**
    Ensure you have a `.env` file in the root directory (for frontend) and `backend` directory (for backend) with necessary environment variables. For the frontend, `VITE_API_URL` should point to your backend (e.g., `http://localhost:5000`).

## Running the Backend with Docker

1.  **Build and Run Docker Containers:**
    From the root directory of the project, use Docker Compose to build and start the backend services:
    ```bash
    docker-compose up --build
    ```
    This command will build the Docker image for the backend (if not already built) and start the backend service. The backend should be accessible at `http://localhost:5000`.

## Running the Frontend

1.  **Start the Frontend Development Server:**
    From the root directory of the project, start the frontend development server:
    ```bash
    npm run dev
    ```
    The frontend application will typically run on `http://localhost:5173` (or another available port). Open this URL in your browser to access the chat interface.
