import { Router } from 'express';
import { chatService } from '../services/chat.service';
import { Readable } from 'stream';
import ApiError from '../../../utils/apiError';
import { validate } from '../../../middlewares/validate.middleware';
import { chatValidations } from '../validations/openai.validation';
const router = Router();

router.post('/:agentId/api/chat/completions', validate(chatValidations.chatCompletion), async (req, res) => {
    try {
        const agentId = req.params.agentId;
        const result = await chatService.chatCompletion(agentId, req.body, req.query);

        if (result instanceof Readable) {
            // Set proper headers for SSE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Transfer-Encoding', 'chunked');

            // Handle client disconnect
            res.on('close', () => {
                if (result instanceof Readable) {
                    result.destroy();
                }
            });

            result.pipe(res);
        } else {
            res.json(result);
        }
    } catch (error) {
        console.error('Chat completion error:', error);
        throw new ApiError(500, error.message);
    }
});

export { router as openaiRouter };
