import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import type { Request, Response, NextFunction } from 'express';

// Ensure upload directory exists
const UPLOAD_DIR = path.resolve('public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Memory storage to process image before saving
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Nur Bilder sind erlaubt!'));
        }
    }
});

export const processImage = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
        return next();
    }

    const filename = `product-${Date.now()}-${Math.round(Math.random() * 1000)}.webp`;
    const outputPath = path.join(UPLOAD_DIR, filename);

    try {
        await sharp(req.file.buffer)
            .resize(800, 600, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .webp({ quality: 80 })
            .toFile(outputPath);

        // Attach filename to request body for the controller to use
        req.body.image_url = `/uploads/${filename}`;
        next();
    } catch (error) {
        console.error('Image processing error:', error);
        return res.status(500).json({ error: 'Fehler bei der Bildverarbeitung' });
    }
};

export const uploadMiddleware = upload.single('image');
