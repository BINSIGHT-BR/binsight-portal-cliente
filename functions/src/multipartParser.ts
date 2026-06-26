import Busboy from 'busboy';
import { Request } from 'firebase-functions/v2/https';

export interface ParsedUpload {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export function parseMultipartUpload(req: Request): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type deve ser multipart/form-data.'));
      return;
    }

    const busboy = Busboy({ headers: req.headers });
    let fileBuffer: Buffer | null = null;
    let fileName = 'nf.pdf';
    let mimeType = 'application/octet-stream';

    busboy.on('file', (_field, file, info) => {
      fileName = info.filename || fileName;
      mimeType = info.mimeType || mimeType;
      const chunks: Buffer[] = [];
      file.on('data', (chunk: Buffer) => chunks.push(chunk));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('finish', () => {
      if (!fileBuffer || fileBuffer.length === 0) {
        reject(new Error('Nenhum arquivo enviado.'));
        return;
      }
      resolve({ buffer: fileBuffer, fileName, mimeType });
    });

    busboy.on('error', reject);

    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });
}
