import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000', // Update this if backend is on a different URL
});

export default api;
