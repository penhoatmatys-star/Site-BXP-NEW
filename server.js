const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
require('dotenv').config();

const ROOT = __dirname;
// Once bundled by Netlify, __dirname no longer points at the repo root;
// included_files lands under the Lambda task root (the cwd) instead.
const LOGO_PATH = [ROOT, process.env.LAMBDA_TASK_ROOT, process.cwd()]
  .filter(Boolean)
  .map((dir) => path.join(dir, 'assets', 'logo.png'))
  .find((file) => fs.existsSync(file));
const MAIL_TO = process.env.BXP_MAIL_TO || 'bp@bxpsport.com';
const PORT = Number(process.env.PORT || 3000);

const COLORS = {
  black: '#030303',
  panel: '#0B0B0B',
  gold: '#D4A820',
  goldLight: '#F2C43A',
  silver: '#D8DDE6',
  silverDim: '#9A9EA8',
  line: '#2A2A2A',
  text: '#F2F2F2'
};

function hasSmtpConfig() {
  return Boolean(
    process.env.BXP_SMTP_HOST &&
    process.env.BXP_SMTP_PORT &&
    process.env.BXP_SMTP_USER &&
    process.env.BXP_SMTP_PASS
  );
}

function clean(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join(', ');
  return String(value).replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return clean(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'submission';
}

function formatDate(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleString('en-GB');
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function drawPageBase(doc) {
  const { width, height } = doc.page;
  doc.rect(0, 0, width, height).fill(COLORS.black);

  doc.save();
  doc.opacity(0.08);
  doc.circle(width - 90, 90, 180).fill(COLORS.gold);
  doc.circle(40, height - 40, 160).fill(COLORS.silver);
  doc.restore();

  doc.save();
  doc.strokeColor(COLORS.gold).lineWidth(1);
  doc.moveTo(32, 28).lineTo(width - 32, 28).stroke();
  doc.restore();
}

function ensureSpace(doc, state, needed) {
  const bottom = doc.page.height - 54;
  if (state.y + needed <= bottom) return;
  doc.addPage();
  drawPageBase(doc);
  doc
    .fillColor(COLORS.gold)
    .font('Helvetica-Bold')
    .fontSize(7)
    .text('BXP FORM SUBMISSION', 32, 38, { characterSpacing: 1.1, lineBreak: false });
  state.y = 58;
}

function drawHeader(doc, payload, state) {
  const submittedAt = formatDate(payload.submittedAt);
  const raw = payload.raw || {};
  const birthYear = clean(raw.dob).slice(0, 4);
  const athleteTitle = payload.formId === 'athlete-form'
    && [clean(raw.name), clean(raw.position), birthYear].filter(Boolean).join(' – ');
  const type = athleteTitle || clean(payload.formType || payload.title || 'BXP Form');

  if (LOGO_PATH) {
    // Square file with wide black margins: a big box keeps the mark readable,
    // and it starts below the gold rule at the top of the page.
    doc.image(LOGO_PATH, 36, 32, { fit: [92, 92] });
  }

  // Long athlete titles shrink first, then wrap; the lines below move down with them.
  let titleSize = 21;
  doc.font('Helvetica-Bold');
  while (titleSize > 15 && doc.fontSize(titleSize).widthOfString(type) > 410) titleSize -= 1;
  const titleHeight = doc.fontSize(titleSize).heightOfString(type, { width: 410 });
  const shift = Math.max(0, titleHeight - 24);

  doc
    .fillColor(COLORS.gold)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('BXP FORM SUBMISSION', 144, 40, { characterSpacing: 1.3, lineBreak: false });

  doc
    .fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(titleSize)
    .text(type, 144, 56, { width: 410 });

  doc
    .fillColor(COLORS.silverDim)
    .font('Helvetica')
    .fontSize(8)
    .text(`Submitted: ${submittedAt}`, 144, 84 + shift, { lineBreak: false })
    .text(`Destination: ${MAIL_TO}`, 144, 98 + shift, { lineBreak: false });

  state.y = Math.max(128, 122 + shift);
}

function drawMetaBox(doc, payload, state) {
  const x = 32;
  const w = doc.page.width - 64;
  ensureSpace(doc, state, 52);

  doc
    .roundedRect(x, state.y, w, 46, 6)
    .fillAndStroke(COLORS.panel, COLORS.line);

  const summary = [
    ['Language', clean(payload.language || '-')],
    ['Page', clean(payload.page || '-')],
    ['Form ID', clean(payload.formId || '-')]
  ];

  const colW = w / summary.length;
  summary.forEach(([label, value], i) => {
    const left = x + i * colW + 14;
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(6.5).text(label.toUpperCase(), left, state.y + 10);
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8.5).text(value || '-', left, state.y + 24, {
      width: colW - 22,
      ellipsis: true
    });
  });

  state.y += 62;
}

function measureEntry(doc, entry, width) {
  const label = clean(entry.label || entry.name || 'Field').toUpperCase();
  const value = clean(entry.value) || '-';
  const labelHeight = doc.font('Helvetica-Bold').fontSize(6.5).heightOfString(label, {
    width,
    lineGap: 0
  });
  const valueHeight = doc.font('Helvetica').fontSize(9).heightOfString(value, {
    width,
    lineGap: 1
  });
  return {
    label,
    value,
    labelHeight,
    valueHeight,
    height: Math.max(31, labelHeight + valueHeight + 13)
  };
}

function drawEntry(doc, entry, x, y, width, measured) {
  const metrics = measured || measureEntry(doc, entry, width);
  doc.fillColor(COLORS.silverDim).font('Helvetica-Bold').fontSize(6.5).text(metrics.label, x, y, {
    width,
    lineGap: 0
  });
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(9).text(metrics.value, x, y + metrics.labelHeight + 4, {
    width,
    lineGap: 1
  });
  doc.strokeColor('#171717').lineWidth(1).moveTo(x, y + metrics.height - 4).lineTo(x + width, y + metrics.height - 4).stroke();
  return metrics.height;
}

function isCompactEntry(entry) {
  const label = clean(entry.label || entry.name);
  const value = clean(entry.value);
  return label.length <= 72 && value.length <= 105 && !value.includes('\n');
}

function drawSection(doc, section, index, state) {
  const title = clean(section.title || `Section ${index + 1}`);
  const entries = Array.isArray(section.entries) ? section.entries : [];
  if (!entries.length) return;

  const titleWidth = doc.page.width - 100;
  const titleHeight = doc.font('Helvetica-Bold').fontSize(13).heightOfString(title, {
    width: titleWidth,
    lineGap: 1
  });
  ensureSpace(doc, state, titleHeight + 34);

  doc
    .fillColor(COLORS.gold)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(String(index + 1).padStart(2, '0'), 32, state.y + 1, { lineBreak: false });

  doc
    .fillColor(COLORS.text)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(title, 62, state.y - 2, { width: titleWidth, lineGap: 1 });

  state.y += titleHeight + 9;
  doc.strokeColor(COLORS.line).lineWidth(1).moveTo(32, state.y).lineTo(doc.page.width - 32, state.y).stroke();
  state.y += 10;

  const left = 44;
  const contentWidth = doc.page.width - 88;
  const columnGap = 18;
  const columnWidth = (contentWidth - columnGap) / 2;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const next = entries[i + 1];
    if (next && isCompactEntry(entry) && isCompactEntry(next)) {
      const firstMetrics = measureEntry(doc, entry, columnWidth);
      const secondMetrics = measureEntry(doc, next, columnWidth);
      const rowHeight = Math.max(firstMetrics.height, secondMetrics.height);
      ensureSpace(doc, state, rowHeight + 5);
      drawEntry(doc, entry, left, state.y, columnWidth, firstMetrics);
      drawEntry(doc, next, left + columnWidth + columnGap, state.y, columnWidth, secondMetrics);
      state.y += rowHeight + 5;
      i += 1;
      continue;
    }

    const metrics = measureEntry(doc, entry, contentWidth);
    ensureSpace(doc, state, metrics.height + 5);
    drawEntry(doc, entry, left, state.y, contentWidth, metrics);
    state.y += metrics.height + 5;
  }

  state.y += 6;
}

function addFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 30;
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.strokeColor(COLORS.line).lineWidth(1).moveTo(32, footerY - 10).lineTo(doc.page.width - 32, footerY - 10).stroke();
    doc.fillColor(COLORS.silverDim).font('Helvetica').fontSize(8)
      .text('BXP - Best for Performance', 32, footerY, { width: 240, lineBreak: false });
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8)
      .text(`Page ${i + 1 - range.start} / ${range.count}`, doc.page.width - 132, footerY, {
        width: 100,
        align: 'right',
        lineBreak: false
      });
    doc.page.margins.bottom = originalBottomMargin;
  }
}

function generateSubmissionPdf(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 32,
      bufferPages: true,
      compress: true,
      info: {
        Title: `${clean(payload.formType || 'BXP')} Submission`,
        Author: 'BXP',
        Subject: 'BXP form submission'
      }
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const state = { y: 0 };
    drawPageBase(doc);
    drawHeader(doc, payload, state);
    drawMetaBox(doc, payload, state);

    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    sections.forEach((section, index) => drawSection(doc, section, index, state));

    if (!sections.length) {
      drawSection(doc, {
        title: 'Raw submission',
        entries: Object.entries(payload.raw || {}).map(([label, value]) => ({ label, value }))
      }, 0, state);
    }

    addFooter(doc);
    doc.end();
  });
}

async function savePdfCopy(filename, pdfBuffer) {
  if (process.env.BXP_SAVE_PDF_COPY !== 'true') return null;
  // On serverless (Netlify/AWS Lambda) the function bundle directory is
  // read-only; only the OS temp dir is writable. Fall back to it there.
  const dir = process.env.BXP_PDF_DIR
    || (process.env.LAMBDA_TASK_ROOT
      ? path.join(os.tmpdir(), 'bxp-submissions')
      : path.join(ROOT, 'submissions'));
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fs.promises.writeFile(filePath, pdfBuffer);
    return filePath;
  } catch (error) {
    // Saving a local copy is best-effort and must never block email delivery.
    console.error('[BXP savePdfCopy]', error.message);
    return null;
  }
}

function createMailTransporter() {
  const secure = String(process.env.BXP_SMTP_SECURE || '').toLowerCase() === 'true';
  return nodemailer.createTransport({
    host: process.env.BXP_SMTP_HOST,
    port: Number(process.env.BXP_SMTP_PORT || 587),
    secure,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    auth: {
      user: process.env.BXP_SMTP_USER,
      pass: process.env.BXP_SMTP_PASS
    }
  });
}

async function sendSubmissionEmail(payload, pdfBuffer, filename) {
  const transporter = createMailTransporter();
  const type = clean(payload.formType || 'BXP form');
  const replyTo = clean(payload.raw && payload.raw.email);
  const subject = `BXP ${type} - PDF submission`;
  const text = [
    `New ${type} submission received.`,
    '',
    `Submitted: ${formatDate(payload.submittedAt)}`,
    `Page: ${clean(payload.page || '-')}`,
    '',
    'The detailed PDF report is attached.'
  ].join('\n');

  return transporter.sendMail({
    from: process.env.BXP_MAIL_FROM || process.env.BXP_SMTP_USER,
    to: MAIL_TO,
    replyTo: replyTo || undefined,
    subject,
    text,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(ROOT));

app.get('/api/health', async (req, res) => {
  const smtpConfigured = hasSmtpConfig();
  let smtpReady = false;
  if (smtpConfigured) {
    try {
      await createMailTransporter().verify();
      smtpReady = true;
    } catch (error) {
      console.error('[BXP SMTP verify]', error.message);
    }
  }
  res.json({
    ok: true,
    recipient: MAIL_TO,
    smtpConfigured,
    smtpReady
  });
});

app.post('/api/form-submit', async (req, res) => {
  try {
    const payload = req.body || {};
    const formType = clean(payload.formType || payload.title);
    if (!formType || !Array.isArray(payload.sections)) {
      return res.status(400).json({ ok: false, error: 'INVALID_FORM_PAYLOAD' });
    }

    const submittedAt = payload.submittedAt || new Date().toISOString();
    payload.submittedAt = submittedAt;

    const nameHint = clean(payload.raw && (payload.raw.club_name || payload.raw.name || payload.raw.email));
    const filename = [
      'bxp',
      slugify(formType),
      slugify(nameHint)
    ].filter(Boolean).join('-') + '.pdf';

    const pdfBuffer = await generateSubmissionPdf(payload);
    const savedPath = await savePdfCopy(filename, pdfBuffer);

    if (!hasSmtpConfig()) {
      return res.status(503).json({
        ok: false,
        error: 'SMTP_NOT_CONFIGURED',
        message: 'PDF generated, but SMTP is not configured. Add BXP_SMTP_* variables to send email.',
        saved: savedPath
      });
    }

    await sendSubmissionEmail(payload, pdfBuffer, filename);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[BXP form submit]', error);
    return res.status(500).json({ ok: false, error: 'FORM_SUBMIT_FAILED' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`BXP site running at http://localhost:${PORT}`);
    if (!hasSmtpConfig()) {
      console.log('SMTP is not configured yet. Copy .env.example to .env and fill BXP_SMTP_* values to send PDF emails.');
    }
  });
}

module.exports = {
  app,
  generateSubmissionPdf,
  hasSmtpConfig
};
