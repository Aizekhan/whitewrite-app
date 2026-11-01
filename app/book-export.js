// Book export (Storyteller+, paid-features «export» → allowExport): the whole story as DOCX or PDF.
// Runs in the browser — no tokens, no server. DOCX is a minimal WordprocessingML package in a
// STORE (uncompressed) zip; PDF is the browser's print of a book-styled page («Зберегти як PDF»).
// window.__bookExport.docx(title, scenes) / .pdf(title, scenes); scenes = [{ n, title, text }]
(function () {
  function paras(text) { return String(text || "").replace(/\r/g, "").split(/\n\s*\n|\n/).map(function (p) { return p.trim(); }).filter(Boolean); }
  function xml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fileName(title, ext) { return (String(title || "book").replace(/[\\/:*?"<>|]+/g, " ").trim() || "book") + "." + ext; }
  function sceneHead(s) { var L = window.__i18n && window.__i18n.getLanguage() === "en" ? "Scene" : "Сцена"; return L + " " + (s.n || "") + (s.title ? " · " + s.title : ""); }

  // ── zip (STORE) ──
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) { // [{ name, data: string }]
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    var u16 = function (v) { return [v & 255, (v >>> 8) & 255]; }, u32 = function (v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; };
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var common = [].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      var local = new Uint8Array([].concat(u32(0x04034b50), common));
      parts.push(local, name, data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), common, u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += local.length + name.length + data.length;
    });
    var csize = central.reduce(function (m, a) { return m + a.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(off), u16(0)));
    return new Blob(parts.concat(central, [end]), { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  function download(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ── DOCX ──
  function docxBody(title, scenes) {
    var p = function (style, text, brk) { return '<w:p><w:pPr><w:pStyle w:val="' + style + '"/>' + (brk ? '<w:pageBreakBefore/>' : '') + '</w:pPr><w:r><w:t xml:space="preserve">' + xml(text) + '</w:t></w:r></w:p>'; };
    var out = [p("Title", title || "")];
    scenes.forEach(function (s) {
      out.push(p("Heading1", sceneHead(s), true));
      paras(s.text).forEach(function (t, i) { out.push(p(i ? "BodyText" : "FirstPara", t)); });
    });
    return out.join("");
  }
  function docx(title, scenes) {
    var W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    var font = '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/>';
    var files = [
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: "docProps/core.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' + xml(title || "") + '</dc:title><dc:creator>WhiteWrite</dc:creator></cp:coreProperties>' },
      { name: "word/_rels/document.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: "word/styles.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + W + '>' +
        '<w:docDefaults><w:rPrDefault><w:rPr>' + font + '<w:sz w:val="24"/><w:lang w:val="uk-UA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="2400" w:after="480"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="56"/></w:rPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="FirstPara"/><w:pPr><w:keepNext/><w:spacing w:before="480" w:after="360"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="FirstPara"><w:name w:val="First Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="both"/></w:pPr></w:style>' +
        '<w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="425"/><w:jc w:val="both"/></w:pPr></w:style>' +
        '</w:styles>' },
      { name: "word/document.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + W + '><w:body>' + docxBody(title, scenes) +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>' },
    ];
    download(zip(files), fileName(title, "docx"));
  }

  // ── PDF: print a book-styled page from a hidden frame ──
  function pdf(title, scenes) {
    var body = '<h1 class="t">' + xml(title || "") + '</h1>' + scenes.map(function (s) {
      return '<section><h2>' + xml(sceneHead(s)) + '</h2>' + paras(s.text).map(function (t) { return '<p>' + xml(t) + '</p>'; }).join("") + '</section>';
    }).join("");
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + xml(title || "") + '</title><style>' +
      '@page{size:A4;margin:22mm 20mm}body{font:12pt/1.6 Georgia,"Times New Roman",serif;color:#111}' +
      'h1.t{text-align:center;font-weight:400;font-size:28pt;margin:35vh 0 0}section{break-before:page}' +
      'h2{text-align:center;font-size:16pt;margin:0 0 18pt}p{margin:0;text-align:justify;text-indent:1.5em}h2+p{text-indent:0}' +
      '</style></head><body>' + body + '</body></html>';
    var f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    var d = f.contentWindow.document; d.open(); d.write(html); d.close();
    setTimeout(function () { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(function () { f.remove(); }, 60000); }, 300);
  }

  window.__bookExport = { docx: docx, pdf: pdf, _zip: zip, _crc32: crc32 };
})();
