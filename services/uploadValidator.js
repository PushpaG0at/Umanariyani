/**
 * UMANARAYNI AYURVEDA — UPLOAD SECURITY & MAGIC BYTES VALIDATOR
 * Verifies raw binary content signatures (magic bytes) to defeat MIME-spoofing and polyglot attacks.
 * Inspects SVG payloads for embedded scripts or event handlers.
 * Deletes rejected files from disk immediately.
 */

const fs = require('node:fs');
const path = require('node:path');

// Safe destination directory outside web root
const SECURE_UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(SECURE_UPLOAD_DIR)) {
  fs.mkdirSync(SECURE_UPLOAD_DIR, { recursive: true });
}

/**
 * Checks whether a buffer matches a JPEG signature (FF D8 FF)
 */
function isJpeg(buf) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

/**
 * Checks whether a buffer matches a PNG signature (89 50 4E 47 0D 0A 1A 0A)
 */
function isPng(buf) {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

/**
 * Checks whether a buffer matches a WebP signature (RIFF....WEBP)
 */
function isWebP(buf) {
  if (buf.length < 12) return false;
  const isRiff = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46; // RIFF
  const isWebpTag = buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50; // WEBP
  return isRiff && isWebpTag;
}

/**
 * Checks whether a buffer matches a GIF signature (GIF87a or GIF89a)
 */
function isGif(buf) {
  if (buf.length < 6) return false;
  return (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  );
}

/**
 * Checks whether a buffer matches an MP4 / M4V / MOV signature (....ftyp)
 */
function isMp4(buf) {
  if (buf.length < 12) return false;
  const brand = buf.slice(4, 8).toString('ascii');
  return brand === 'ftyp' || brand === 'moov';
}

/**
 * Checks whether a buffer matches a WebM / MKV container signature (1A 45 DF A3)
 */
function isWebM(buf) {
  return buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

/**
 * Inspects SVG content for malicious embedded scripts, external entities, or event handlers
 */
function isSafeSvg(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
    if (!content.includes('<svg')) return false;

    // Reject dangerous vectors
    const dangerousPatterns = [
      /<script[\s>]/i,
      /javascript:/i,
      /onload\s*=/i,
      /onerror\s*=/i,
      /onclick\s*=/i,
      /onmouseover\s*=/i,
      /<iframe[\s>]/i,
      /<object[\s>]/i,
      /<embed[\s>]/i,
      /<!entity/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return false;
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Validates a single uploaded file using magic bytes inspection
 * @param {object} file Multer file object
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
async function validateUploadedFile(file) {
  if (!file || !file.path) {
    return { valid: false, reason: 'Invalid upload descriptor' };
  }

  const filePath = file.path;
  const ext = path.extname(file.originalname).toLowerCase();

  try {
    const fd = fs.openSync(filePath, 'r');
    const headerBuf = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, headerBuf, 0, 16, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) {
      fs.unlinkSync(filePath);
      return { valid: false, reason: 'File is empty or truncated' };
    }

    let isValid = false;

    if (['.jpg', '.jpeg'].includes(ext)) {
      isValid = isJpeg(headerBuf);
    } else if (ext === '.png') {
      isValid = isPng(headerBuf);
    } else if (ext === '.webp') {
      isValid = isWebP(headerBuf);
    } else if (ext === '.gif') {
      isValid = isGif(headerBuf);
    } else if (['.mp4', '.m4v', '.mov'].includes(ext)) {
      isValid = isMp4(headerBuf);
    } else if (ext === '.webm') {
      isValid = isWebM(headerBuf);
    } else if (ext === '.svg') {
      isValid = isSafeSvg(filePath);
    } else {
      isValid = false;
    }

    if (!isValid) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return {
        valid: false,
        reason: `File content for "${file.originalname}" failed security magic-byte verification for declared extension (${ext}).`
      };
    }

    return { valid: true };
  } catch (err) {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    return { valid: false, reason: `Upload read error: ${err.message}` };
  }
}

/**
 * Validates an array of uploaded files. Deletes all if any one fails.
 * @param {Array<object>} files Array of Multer file objects
 * @returns {Promise<{ valid: boolean, errorFile?: string, reason?: string }>}
 */
async function validateAllUploadedFiles(files) {
  if (!files || files.length === 0) return { valid: true };

  for (const file of files) {
    const res = await validateUploadedFile(file);
    if (!res.valid) {
      // Clean up remaining files in the batch
      for (const f of files) {
        if (f.path && fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path); } catch (_) {}
        }
      }
      return { valid: false, errorFile: file.originalname, reason: res.reason };
    }
  }

  return { valid: true };
}

module.exports = {
  SECURE_UPLOAD_DIR,
  validateUploadedFile,
  validateAllUploadedFiles,
  isJpeg,
  isPng,
  isWebP,
  isGif,
  isMp4,
  isWebM,
  isSafeSvg
};
