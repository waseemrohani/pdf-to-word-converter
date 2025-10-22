// api/convert.js
import fetch from 'node-fetch';
import formidable from 'formidable';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  const CONVERTER_URL = process.env.CONVERTER_URL;
  if (!CONVERTER_URL) return res.status(500).send('No converter URL configured');

  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  // parse incoming multipart (file)
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('parse err', err);
      return res.status(400).send('Invalid form');
    }
    const file = files.pdfFile;
    if (!file) return res.status(400).send('No file');

    // forward to converter service
    const formData = new (await import('form-data')).default();
    const fs = await import('fs');
    formData.append('pdfFile', fs.createReadStream(file.filepath), file.originalFilename);

    try {
      const r = await fetch(CONVERTER_URL + '/convert', {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      });

      if (!r.ok) {
        const text = await r.text();
        return res.status(502).send('Converter error: ' + text);
      }

      // stream the response back
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      // copy headers like content-disposition for filename
      const cd = r.headers.get('content-disposition');
      if (cd) res.setHeader('Content-Disposition', cd);

      r.body.pipe(res);
    } catch (e) {
      console.error(e);
      res.status(500).send('Proxy failed');
    }
  });
}
