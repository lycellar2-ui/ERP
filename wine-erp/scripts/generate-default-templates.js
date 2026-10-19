const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const OUT_DIR = path.join(__dirname, '..', 'public', 'templates', 'contracts');

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="26"/>
        <w:szCs w:val="26"/>
        <w:lang w:val="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto" w:after="120"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;

function p(text, options = {}) {
    const { bold, center, right, italic, size, spacingBefore, spacingAfter } = options;
    let pPr = '<w:pPr>';
    if (center) pPr += '<w:jc w:val="center"/>';
    else if (right) pPr += '<w:jc w:val="right"/>';
    if (spacingBefore || spacingAfter) {
        pPr += `<w:spacing ${spacingBefore ? `w:before="${spacingBefore}"` : ''} ${spacingAfter ? `w:after="${spacingAfter}"` : ''}/>`;
    }
    pPr += '</w:pPr>';

    let rPr = '<w:rPr>';
    if (bold) rPr += '<w:b/><w:bCs/>';
    if (italic) rPr += '<w:i/><w:iCs/>';
    if (size) rPr += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
    rPr += '</w:rPr>';

    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function headerNational() {
    return `
      ${p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, center: true, size: 26 })}
      ${p('Độc lập - Tự do - Hạnh phúc', { bold: true, center: true, size: 26 })}
      ${p('---------------***---------------', { center: true, spacingAfter: 200 })}
    `;
}

function partyInfo() {
    return `
      ${p('BÊN A (BÊN BÁN / CUNG CẤP): {ten_ben_a}', { bold: true, spacingBefore: 120 })}
      ${p('- Địa chỉ: {dia_chi_ben_a}')}
      ${p('- Mã số thuế: {mst_ben_a}        | Điện thoại: {sdt_ben_a}')}
      ${p('- Người đại diện: {dai_dien_ben_a}        - Chức vụ: {chuc_vu_ben_a}')}
      ${p('- Tài khoản ngân hàng: {so_tk_ben_a} tại {ngan_hang_ben_a}')}
      
      ${p('BÊN B (BÊN MUA / ĐỐI TÁC): {ten_ben_b}', { bold: true, spacingBefore: 120 })}
      ${p('- Địa chỉ: {dia_chi_ben_b}')}
      ${p('- Mã số thuế: {mst_ben_b}        | Điện thoại: {sdt_ben_b}')}
      ${p('- Người đại diện: {dai_dien_ben_b}        - Chức vụ: {chuc_vu_ben_b}')}
      ${p('- Tài khoản ngân hàng: {so_tk_ben_b} tại {ngan_hang_ben_b}')}
    `;
}

function signatureBlock() {
    return `
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
            <w:insideH w:val="none"/><w:insideV w:val="none"/>
          </w:tblBorders>
        </w:tblPr>
        <w:tr>
          <w:tc>
            <w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr>
            ${p('ĐẠI DIỆN BÊN A', { bold: true, center: true })}
            ${p('(Ký tên, ghi rõ họ tên và đóng dấu)', { italic: true, center: true })}
            ${p('', { spacingBefore: 1200 })}
            ${p('{dai_dien_ben_a}', { bold: true, center: true })}
          </w:tc>
          <w:tc>
            <w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr>
            ${p('ĐẠI DIỆN BÊN B', { bold: true, center: true })}
            ${p('(Ký tên, ghi rõ họ tên và đóng dấu)', { italic: true, center: true })}
            ${p('', { spacingBefore: 1200 })}
            ${p('{dai_dien_ben_b}', { bold: true, center: true })}
          </w:tc>
        </w:tr>
      </w:tbl>
    `;
}

function productTableXml() {
    return `
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          </w:tblBorders>
        </w:tblPr>
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="400" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr>${p('STT', { bold: true, center: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="2000" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr>${p('Tên sản phẩm rượu', { bold: true, center: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="600" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr>${p('Niên vụ', { bold: true, center: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="600" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr>${p('ĐVT', { bold: true, center: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="500" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr>${p('SL', { bold: true, center: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="900" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr>${p('Đơn giá ({tien_te})', { bold: true, center: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="1000" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr>${p('Thành tiền ({tien_te})', { bold: true, center: true, size: 24 })}</w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="400" w:type="pct"/></w:tcPr>${p('{#san_pham}{stt}', { center: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="2000" w:type="pct"/></w:tcPr>${p('{ten_ruou}', { size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="600" w:type="pct"/></w:tcPr>${p('{nien_vu}', { center: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="600" w:type="pct"/></w:tcPr>${p('{dvt}', { center: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="500" w:type="pct"/></w:tcPr>${p('{so_luong}', { right: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="900" w:type="pct"/></w:tcPr>${p('{don_gia}', { right: true, size: 24 })}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="1000" w:type="pct"/></w:tcPr>${p('{thanh_tien}{/san_pham}', { right: true, size: 24 })}</w:tc>
        </w:tr>
      </w:tbl>
    `;
}

function makeDocxPackage(bodyXml) {
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    const zip = new PizZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
    zip.file('_rels/.rels', ROOT_RELS_XML);
    zip.folder('word').file('document.xml', documentXml);
    zip.folder('word').file('styles.xml', STYLES_XML);
    zip.folder('word').folder('_rels').file('document.xml.rels', DOC_RELS_XML);

    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Template: HỢP ĐỒNG NGUYÊN TẮC (HD_NGUYEN_TAC.docx)
// ─────────────────────────────────────────────────────────────────────────────
const bodyNguyenTac = `
  ${headerNational()}
  ${p('HỢP ĐỒNG NGUYÊN TẮC MUA BÁN VÀ PHÂN PHỐI RƯỢU', { bold: true, center: true, size: 30, spacingBefore: 100, spacingAfter: 60 })}
  ${p('Số: {so_hop_dong}', { italic: true, center: true, spacingAfter: 180 })}
  ${p('- Căn cứ Bộ luật Dân sự số 91/2015/QH13 và Luật Thương mại số 36/2005/QH11;', { italic: true })}
  ${p('- Căn cứ Nghị định 105/2017/NĐ-CP và Nghị định 17/2020/NĐ-CP về kinh doanh rượu;', { italic: true })}
  ${p('- Căn cứ vào nhu cầu và khả năng thực tế của hai bên,', { italic: true, spacingAfter: 140 })}
  ${p('Hôm nay, {ngay_ky_text}, tại văn phòng Công ty, chúng tôi gồm có:', { spacingAfter: 100 })}
  ${partyInfo()}
  ${p('Hai bên cùng nhau thỏa thuận ký kết Hợp đồng nguyên tắc với các điều khoản sau:', { bold: true, spacingBefore: 140 })}
  ${p('Điều 1: Mục đích & Nguyên tắc hợp tác', { bold: true })}
  ${p('1.1. Bên A đồng ý cung cấp các sản phẩm rượu vang, rượu mạnh nhập khẩu chính ngạch cho Bên B theo từng Đơn đặt hàng (Purchase Order) hoặc Hợp đồng mua bán cụ thể.')}
  ${p('1.2. Bên A cam kết 100% sản phẩm có đầy đủ hóa đơn GTGT, giấy phép phân phối rượu, tem rượu nhập khẩu hợp pháp và chứng nhận công bố vệ sinh an toàn thực phẩm.')}
  ${p('Điều 2: Hạn mức công nợ và Thời hạn thanh toán', { bold: true })}
  ${p('2.1. Hạn mức công nợ tối đa dành cho Bên B: {han_muc_cong_no} {tien_te} (Bằng chữ: {han_muc_cong_no_bang_chu}).')}
  ${p('2.2. Thời hạn thanh toán: Trong vòng {thoi_han_thanh_toan} ngày kể từ ngày Bên A hoàn thành giao hàng và xuất hóa đơn điện tử hợp lệ.')}
  ${p('2.3. Phương thức thanh toán: Chuyển khoản vào tài khoản ngân hàng của Bên A được nêu tại phần thông tin bên trên.')}
  ${p('Điều 3: Đặt hàng, Giao nhận và Vận chuyển', { bold: true })}
  ${p('3.1. Địa điểm giao hàng: {dia_diem_giao_hang}.')}
  ${p('3.2. Điều kiện bảo quản rượu: Hàng hóa phải được lưu giữ ở nhiệt độ tiêu chuẩn từ 16 - 20°C, tránh ánh nắng trực tiếp.')}
  ${p('Điều 4: Hiệu lực hợp đồng', { bold: true })}
  ${p('Hợp đồng này có hiệu lực từ ngày {ngay_hieu_luc} đến hết ngày {ngay_het_han}. Hợp đồng được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để thực hiện.', { spacingAfter: 300 })}
  ${signatureBlock()}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Template: PHỤ LỤC HỢP ĐỒNG KÝ GỬI (HD_KY_GUI.docx)
// ─────────────────────────────────────────────────────────────────────────────
const bodyKyGui = `
  ${headerNational()}
  ${p('PHỤ LỤC HỢP ĐỒNG KÝ GỬI VÀ TRƯNG BÀY RƯỢU', { bold: true, center: true, size: 30, spacingBefore: 100, spacingAfter: 60 })}
  ${p('Số phụ lục: {so_hop_dong}', { italic: true, center: true, spacingAfter: 80 })}
  ${p('(Kèm theo Hợp đồng nguyên tắc số: {so_hd_goc})', { italic: true, center: true, spacingAfter: 180 })}
  ${p('Hôm nay, {ngay_ky_text}, chúng tôi gồm có:', { spacingAfter: 100 })}
  ${partyInfo()}
  ${p('Hai bên thống nhất ký kết Phụ lục ký gửi hàng hóa với các nội dung chi tiết sau:', { bold: true, spacingBefore: 140 })}
  ${p('Điều 1: Danh mục và Giá trị rượu ký gửi', { bold: true })}
  ${p('Bên A bàn giao cho Bên B lưu kho và trưng bày tại địa điểm: {dia_diem_giao_hang} danh mục sản phẩm sau:')}
  ${productTableXml()}
  ${p('Tổng giá trị hàng ký gửi: {tong_tien} {tien_te}', { bold: true, spacingBefore: 100 })}
  ${p('(Bằng chữ: {tong_tien_bang_chu})', { italic: true, spacingAfter: 120 })}
  ${p('Điều 2: Hoa hồng bán hàng và Chu kỳ đối soát', { bold: true })}
  ${p('2.1. Tỷ lệ hoa hồng / Chiết khấu dành cho Bên B: {ty_le_hoa_hong}% trên giá bán quy định.')}
  ${p('2.2. Chu kỳ đối soát tồn kho và thanh toán tiền hàng bán được: Vào ngày {ngay_doi_soat} hàng tháng.')}
  ${p('Điều 3: Trách nhiệm bảo quản hàng hóa', { bold: true })}
  ${p('Bên B chịu toàn bộ trách nhiệm bảo quản chất lượng rượu, tem nhãn không bị rách, xước hoặc hư hại do nhiệt độ/ẩm độ trong suốt thời gian nhận ký gửi.')}
  ${p('Điều 4: Thời hạn ký gửi', { bold: true })}
  ${p('Phụ lục có hiệu lực từ ngày {ngay_hieu_luc} đến hết ngày {ngay_het_han}.', { spacingAfter: 300 })}
  ${signatureBlock()}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Template: HỢP ĐỒNG MUA BÁN MỘT LẦN (HD_MOT_LAN.docx)
// ─────────────────────────────────────────────────────────────────────────────
const bodyMotLan = `
  ${headerNational()}
  ${p('HỢP ĐỒNG MUA BÁN RƯỢU NHẬP KHẨU', { bold: true, center: true, size: 30, spacingBefore: 100, spacingAfter: 60 })}
  ${p('Số: {so_hop_dong}', { italic: true, center: true, spacingAfter: 180 })}
  ${p('- Căn cứ Bộ luật Dân sự 2015 và Luật Thương mại 2005;', { italic: true })}
  ${p('- Căn cứ nhu cầu mua bán của hai bên;', { italic: true, spacingAfter: 140 })}
  ${p('Hôm nay, {ngay_ky_text}, chúng tôi gồm có:', { spacingAfter: 100 })}
  ${partyInfo()}
  ${p('Hai bên thống nhất ký hợp đồng mua bán với các điều khoản sau:', { bold: true, spacingBefore: 140 })}
  ${p('Điều 1: Danh mục hàng hóa và Giá trị hợp đồng', { bold: true })}
  ${productTableXml()}
  ${p('Cộng tiền hàng (Chưa thuế): {tien_truoc_thue} {tien_te}', { right: true, bold: true, spacingBefore: 80 })}
  ${p('Thuế Giá trị gia tăng (VAT 10%): {tien_vat} {tien_te}', { right: true })}
  ${p('TỔNG GIÁ TRỊ THANH TOÁN: {tong_tien} {tien_te}', { right: true, bold: true, size: 28 })}
  ${p('Bằng chữ: {tong_tien_bang_chu}', { italic: true, spacingAfter: 120 })}
  ${p('Điều 2: Phương thức và Điều kiện thanh toán', { bold: true })}
  ${p('2.1. Bên B đặt cọc {ty_le_dat_coc}% tương đương số tiền {tien_dat_coc} {tien_te} ngay sau khi ký hợp đồng.')}
  ${p('2.2. Số tiền còn lại {tien_con_lai} {tien_te} sẽ được thanh toán trong vòng {thoi_han_thanh_toan} ngày kể từ ngày bàn giao hàng hóa.')}
  ${p('Điều 3: Thời gian, Địa điểm giao nhận', { bold: true })}
  ${p('3.1. Thời gian giao hàng: {ngay_giao_hang}.')}
  ${p('3.2. Địa điểm giao hàng: {dia_diem_giao_hang}.')}
  ${p('Điều 4: Hiệu lực hợp đồng', { bold: true })}
  ${p('Hợp đồng có hiệu lực từ ngày ký đến ngày {ngay_het_han} hoặc khi hai bên hoàn tất nghĩa vụ giao hàng và thanh toán.', { spacingAfter: 300 })}
  ${signatureBlock()}
`;

fs.writeFileSync(path.join(OUT_DIR, 'HD_NGUYEN_TAC.docx'), makeDocxPackage(bodyNguyenTac));
fs.writeFileSync(path.join(OUT_DIR, 'HD_KY_GUI.docx'), makeDocxPackage(bodyKyGui));
fs.writeFileSync(path.join(OUT_DIR, 'HD_MOT_LAN.docx'), makeDocxPackage(bodyMotLan));

console.log('Successfully generated 3 default docx templates in:', OUT_DIR);
