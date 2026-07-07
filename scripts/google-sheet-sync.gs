/**
 * Quiet Tracker → Google Sheet sync webhook.
 *
 * Setup (one time, ~2 minutes):
 * 1. Open the shared Google Sheet.
 * 2. Extensions → Apps Script. Delete any code there and paste this file.
 * 3. Replace SECRET below with the value from Quiet Tracker → Settings → Google Sheet sync secret.
 * 4. Deploy → New deployment → type "Web app":
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    → Deploy, authorize, and copy the Web app URL (ends in /exec).
 * 5. Paste that URL into Quiet Tracker → Settings → Google Sheet sync URL → Save.
 *
 * The tracker's "Sync Google Sheet" button then rewrites the "Quiet Tracker"
 * tab of this spreadsheet with the latest data on every click.
 */
const SECRET = 'PASTE_SECRET_HERE';

function doPost(e) {
  const out = (obj) =>
    ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  try {
    const data = JSON.parse(e.postData.contents);
    if (!SECRET || data.secret !== SECRET) return out({ ok: false, error: 'Bad secret' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('Quiet Tracker');
    if (!sh) sh = ss.insertSheet('Quiet Tracker');
    sh.clearContents();
    const rows = data.rows;
    const width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    const norm = rows.map(function (r) { while (r.length < width) r.push(''); return r; });
    sh.getRange(1, 1, norm.length, width).setValues(norm);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, width).setFontWeight('bold');
    sh.getRange(norm.length + 2, 1).setValue(data.footer || ('Last synced: ' + data.updatedAt));
    return out({ ok: true, rows: norm.length - 1 });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
