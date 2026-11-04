// Vercel Serverless Function: CRUD template yang disimpan di data/templates.json pada repo GitHub.
const crypto = require('crypto');

const FILE_PATH = 'data/templates.json';
const MAX_RETRY = 3;

function config() {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, ADMIN_PASSWORD } = process.env;
  const missing = ['GITHUB_TOKEN', 'GITHUB_REPO', 'ADMIN_PASSWORD'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw httpError(500, `Environment variable belum diisi di Vercel: ${missing.join(', ')}.`);
  }
  return { token: GITHUB_TOKEN, repo: GITHUB_REPO, branch: GITHUB_BRANCH || 'main', password: ADMIN_PASSWORD };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function github(cfg, options = {}) {
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${FILE_PATH}`;
  return fetch(options.method ? url : `${url}?ref=${encodeURIComponent(cfg.branch)}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'copas-musrif',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

async function readFile(cfg) {
  const res = await github(cfg);
  if (res.status === 404) return { templates: [], sha: undefined };
  if (!res.ok) throw httpError(502, `GitHub menolak permintaan baca (${res.status}). Periksa GITHUB_TOKEN dan GITHUB_REPO.`);
  const file = await res.json();
  const text = Buffer.from(file.content || '', 'base64').toString('utf8');
  const parsed = JSON.parse(text || '{"templates":[]}');
  return { templates: Array.isArray(parsed.templates) ? parsed.templates : [], sha: file.sha };
}

async function writeFile(cfg, templates, sha, message) {
  const content = Buffer.from(`${JSON.stringify({ templates }, null, 2)}\n`, 'utf8').toString('base64');
  const res = await github(cfg, {
    method: 'PUT',
    body: JSON.stringify({ message, content, sha, branch: cfg.branch }),
  });
  if (res.status === 409 || res.status === 422) return false; // file berubah saat proses, ulangi
  if (!res.ok) throw httpError(502, `GitHub menolak penyimpanan (${res.status}). Pastikan token punya izin Contents: Read and write.`);
  return true;
}

// Baca, ubah, lalu tulis. Diulang bila ada orang lain menyimpan pada saat bersamaan.
async function mutate(cfg, change) {
  for (let i = 0; i < MAX_RETRY; i += 1) {
    const { templates, sha } = await readFile(cfg);
    const { next, result, message } = change(templates);
    if (await writeFile(cfg, next, sha, message)) return result;
  }
  throw httpError(409, 'Ada perubahan lain pada saat yang sama. Coba simpan lagi.');
}

function checkPassword(req, cfg) {
  const hash = (v) => crypto.createHash('sha256').update(String(v)).digest();
  let given = '';
  try {
    given = decodeURIComponent(req.headers['x-admin-password'] || '');
  } catch {
    given = '';
  }
  if (!crypto.timingSafeEqual(hash(given), hash(cfg.password))) {
    throw httpError(401, 'Kata sandi salah.');
  }
}

function clean(body) {
  const title = String(body?.title || '').replace(/\s+/g, ' ').trim();
  const category = String(body?.category || '').replace(/\s+/g, ' ').trim() || 'Lainnya';
  const text = String(body?.body || '').replace(/\r\n/g, '\n').trim();
  if (!title) throw httpError(400, 'Judul wajib diisi.');
  if (!text) throw httpError(400, 'Isi template wajib diisi.');
  if (title.length > 120 || category.length > 60) throw httpError(400, 'Judul atau kategori terlalu panjang.');
  if (text.length > 20000) throw httpError(400, 'Isi template terlalu panjang.');
  return { title, category, body: text };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const cfg = config();

    if (req.method === 'GET') {
      const { templates } = await readFile(cfg);
      return res.status(200).json({ templates });
    }

    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PUT, DELETE');
      throw httpError(405, 'Metode tidak didukung.');
    }

    checkPassword(req, cfg);
    const id = req.query?.id;

    if (req.method === 'POST') {
      const data = clean(req.body);
      const template = { id: crypto.randomUUID(), ...data, updatedAt: new Date().toISOString() };
      await mutate(cfg, (list) => ({
        next: [...list, template],
        result: template,
        message: `Tambah template: ${template.title}`,
      }));
      return res.status(201).json({ template });
    }

    if (!id) throw httpError(400, 'ID template wajib diisi.');

    if (req.method === 'PUT') {
      const data = clean(req.body);
      const template = await mutate(cfg, (list) => {
        const old = list.find((t) => t.id === id);
        if (!old) throw httpError(404, 'Template tidak ditemukan. Mungkin sudah dihapus.');
        const updated = { ...old, ...data, updatedAt: new Date().toISOString() };
        return {
          next: list.map((t) => (t.id === id ? updated : t)),
          result: updated,
          message: `Ubah template: ${updated.title}`,
        };
      });
      return res.status(200).json({ template });
    }

    await mutate(cfg, (list) => {
      const old = list.find((t) => t.id === id);
      if (!old) throw httpError(404, 'Template tidak ditemukan. Mungkin sudah dihapus.');
      return { next: list.filter((t) => t.id !== id), result: true, message: `Hapus template: ${old.title}` };
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return res.status(status).json({ error: err.status ? err.message : 'Terjadi kesalahan di server.' });
  }
};
