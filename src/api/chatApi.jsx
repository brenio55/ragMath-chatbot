import axios from 'axios';

const API_URL = 'http://localhost:5000/api/kb';

export const sendMessage = async (message, userId, conversationId) => {
  try {
    const response = await axios.post(`${API_URL}/chat`, {
      message,
      user_id: userId,
      conversation_id: conversationId,
    });
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};
