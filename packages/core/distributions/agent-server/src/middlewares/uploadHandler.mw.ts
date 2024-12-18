import multer from 'multer';
import { MAX_FILE_SIZE, MAX_FILE_COUNT } from '../constants';

const upload = multer({
    limits: { fileSize: MAX_FILE_SIZE },
    storage: multer.memoryStorage(),
});

export default function uploadHandler(req, res, next) {
    upload.any()(req, res, (err) => {
        if (err) {
            return next(new Error(`File upload error: ${err.message}`));
        }

        if (req.files && req.files.length > MAX_FILE_COUNT) {
            return res.status(400).send('Too many files');
        }

        next();
    });
}
