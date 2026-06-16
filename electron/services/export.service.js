const fs = require("fs");
const path = require("path");
const React = require("react");
const { Document, Page, Text, View, pdf } = require("@react-pdf/renderer");
const { getExportsDir } = require("../utils/appPaths");
const { getDb } = require("../db/database");
const PDFHeader = require("../../src/components/pdf/components/PDFHeader.jsx").default;
const { pdfStyles } = require("../../src/components/pdf/pdfStyles.js");

function safeFileName(value) {
  return String(value || "report")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function getPdfBuffer(document) {
  const instance = pdf(document);
  const stream = await instance.toBuffer();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function exportTablePdf({ title = "Report", columns = [], rows = [] }, shell) {
  const company = getDb().prepare("SELECT * FROM company WHERE id = 1").get();
  const document = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: pdfStyles.page },
      React.createElement(PDFHeader, { title: String(title).toUpperCase(), company }),
      React.createElement(
        View,
        { style: { marginTop: 14, borderTop: "1 solid #e2e8f0", borderLeft: "1 solid #e2e8f0" } },
        React.createElement(
          View,
          { style: { flexDirection: "row", backgroundColor: "#f8fafc" } },
          columns.map((column) =>
            React.createElement(
              Text,
              {
                key: column.key,
                style: {
                  flex: 1,
                  borderRight: "1 solid #e2e8f0",
                  borderBottom: "1 solid #e2e8f0",
                  fontSize: 8,
                  fontWeight: 700,
                  padding: 5,
                },
              },
              column.label,
            ),
          ),
        ),
        rows.map((row, index) =>
          React.createElement(
            View,
            { key: index, style: { flexDirection: "row" } },
            columns.map((column) =>
              React.createElement(
                Text,
                {
                  key: column.key,
                  style: {
                    flex: 1,
                    borderRight: "1 solid #e2e8f0",
                    borderBottom: "1 solid #e2e8f0",
                    fontSize: 8,
                    padding: 5,
                  },
                },
                String(row[column.key] ?? ""),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  const file = path.join(getExportsDir(), `${safeFileName(title)}.pdf`);
  await fs.promises.writeFile(file, await getPdfBuffer(document));
  if (shell) await shell.openPath(file);
  return file;
}

async function exportTableExcel({ title = "Report", columns = [], rows = [] }, shell) {
  const tableHead = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const tableRows = rows
    .map(
      (row) =>
        `<tr>${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join("")}</tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
      th { background: #f1f5f9; }
    </style>
  </head>
  <body>
    <h2>${escapeHtml(title)}</h2>
    <table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table>
  </body>
</html>`;

  const file = path.join(getExportsDir(), `${safeFileName(title)}.xls`);
  await fs.promises.writeFile(file, html, "utf8");
  if (shell) await shell.openPath(file);
  return file;
}

module.exports = { exportTableExcel, exportTablePdf };
