import express from 'express';
import { getKBAnswer } from '../controllers/kbController.js';

const router = express.Router();

router.post('/chat', getKBAnswer);

export default router;