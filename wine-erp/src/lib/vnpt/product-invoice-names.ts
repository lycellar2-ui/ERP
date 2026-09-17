/**
 * BẢNG ÁNH XẠ TÊN HÓA ĐƠN ĐIỆN TỬ VNPT THEO HỒ SƠ TỰ CÔNG BỐ (BẢNG GIÁ 25.07)
 * 
 * Nguồn dữ liệu: 'Bảng giá tổng hợp 25.07.xlsx' (Chuẩn hóa theo Tự Công Bố)
 * Áp dụng khi:
 * 1. Đẩy hóa đơn nháp lên VNPT e-Invoice qua WebService (<THHDVu> trong XML DSHDon)
 * 2. Xuất file Excel định dạng import VNPT (VNPT_Einvoice_1Tax_*.xlsx)
 * 
 * Giữ nguyên tên thương mại ngắn gọn trên màn hình Đơn hàng, Báo giá và Kho.
 */

export const VNPT_PRODUCT_INVOICE_NAMES: Record<string, string> = {
    // Pháp - Bordeaux & Rhone & Bourgogne
    "L20001": "Rượu vang đỏ Maison Blanche Bordeaux Rouge",
    "L20002": "Rượu vang trắng Maison Blanche Bordeaux Blanc",
    "L20003": "Rượu vang hồng Colors 719",
    "L20004": "Rượu vang đỏ Chateau Clos Seric Bordeaux Superieur",
    "L20029": "Rượu vang đỏ Chateau Clos Cormey Saint-Emilion Grand Cru",
    "L20032": "Rượu vang đỏ L'Orangerie de Pez Saint-Estephe",
    "L20030": "Rượu vang đỏ Chateau Moulin de la Bridane Saint-Julien",
    "L20031": "Rượu vang đỏ Le Secret de Franc Maillet Pomerol",
    "L20068": "Rượu vang đỏ Esprit de Maison Blanche Rouge",
    "L20069": "Rượu vang trắng Esprit de Maison Blanche Blanc",
    "L20006": "Rượu vang đỏ Oh La Vache Rouge",
    "L20007": "Rượu vang trắng Oh La Vache Blanc",
    "L20016": "Rượu vang đỏ Domaine de la Solitude Cotes du Rhone Rouge",
    "L20017": "Rượu vang trắng Domaine de la Solitude Cotes du Rhone Blanc",
    "L20018": "Rượu vang đỏ Domaine de la Solitude Gigondas Bellecoste",
    "L20019": "Rượu vang đỏ Domaine de la Solitude Chateauneuf du Pape 2023",
    "L20070": "Rượu vang trắng Domaine de la Solitude Chateauneuf du Pape Blanc",
    "L20039": "Rượu vang trắng Baudouin Millet Petit Chablis",
    "L20040": "Rượu vang trắng Baudouin Millet Chablis",
    "L20041": "Rượu vang trắng Baudouin Millet Chablis 1er Cru Vaucoupin",
    "L20042": "Rượu vang trắng Baudouin Millet Bourgogne Chardonnay",
    "L20043": "Rượu vang trắng Domaine de Rochebin Bourgogne Aligote",
    "L20044": "Rượu vang trắng Domaine de Rochebin Bourgogne Chardonnay",
    "L20045": "Rượu vang trắng Domaine de Rochebin Macon Villages",
    "L20046": "Rượu vang đỏ Domaine de Rochebin Bourgogne Pinot Noir",

    // Pháp - Beaujolais & Alsace & Loire & Languedoc
    "L20020": "Rượu vang đỏ Pardon & Fils Beaujolais-Villages",
    "L20021": "Rượu vang đỏ Pardon & Fils Chiroubles Les Chanteranes",
    "L20022": "Rượu vang đỏ Pardon & Fils Chenas Domaine du Dime",
    "L20023": "Rượu vang đỏ Pardon & Fils Brouilly",
    "L20024": "Rượu vang đỏ Pardon & Fils Morgon La Croix Gaillard",
    "L20025": "Rượu vang trắng Pardon & Fils Beaujolais Blanc",
    "L20026": "Rượu vang đỏ Pardon & Fils Saint-Amour Les Diamantines",
    "L20028": "Rượu vang trắng Pardon & Fils Bourgogne Chardonnay",
    "L20009": "Rượu vang trắng Domaine de la Tour Blanche Pinot Blanc Cuvée",
    "L20010": "Rượu vang trắng Domaine de la Tour Blanche Riesling",
    "L20011": "Rượu vang trắng Domaine de la Tour Blanche Gewurztraminer",
    "L20012": "Rượu vang đỏ Domaine de la Tour Blanche Pinot Noir Cuvée",
    "L20013": "Rượu vang trắng Domaine de la Tour Blanche Riesling Grand Cru Schoenenbourg",
    "L20014": "Rượu vang trắng Domaine de la Tour Blanche Pinot Gris Réserve",
    "L20015": "Rượu vang trắng Domaine de la Tour Blanche Gewurztraminer Grand Cru Sporen",
    "L20033": "Rượu vang trắng La Petite Perriere Sauvignon Blanc",
    "L20034": "Rượu vang đỏ La Petite Perriere Pinot Noir",
    "L20035": "Rượu vang trắng La Perriere Touraine Sauvignon Blanc",
    "L20036": "Rượu vang trắng La Perriere Blanc-Fumé de Pouilly",
    "L20037": "Rượu vang trắng La Perriere Sancerre White",
    "L20038": "Rượu vang đỏ La Perriere Sancerre Red",
    "L20064": "Rượu vang đỏ El Pinot",
    "L20065": "Rượu vang trắng El Chardo",
    "L20066": "Rượu vang trắng Locus Melon B",
    "L20067": "Rượu vang trắng Locus Folle B",
    "L20047": "Rượu vang trắng Domaine du Meteore Le Meteore Blanc",
    "L20048": "Rượu vang đỏ Domaine du Meteore Le Meteore Rouge",
    "L20049": "Rượu vang đỏ Domaine du Meteore Leonides AOP Faugeres Rouge",
    "L20050": "Rượu vang đỏ Domaine du Meteore Carignides AOP Faugeres Rouge",
    "L20051": "Rượu vang đỏ Domaine du Meteore Perseides AOP Faugeres Rouge",
    "L20052": "Rượu vang đỏ Domaine du Meteore Parangon AOP Saint-Chinian Rouge",
    "L20053": "Rượu vang đỏ L'Orangeraie Cabernet Sauvignon",
    "L20054": "Rượu vang trắng L'Orangeraie Viognier",
    "L20055": "Rượu vang trắng L'Orangeraie Sauvignon Blanc",
    "L20056": "Rượu vang hồng Lorgeril Ô de Rose",
    "L20057": "Rượu vang đỏ Chateau de Pennautier Terroirs d'Altitude",
    "L20058": "Rượu vang đỏ L'Esprit de Pennautier Grand Vin",
    "L20059": "Rượu vang đỏ Chateau de Ciffre Grand Vin AOP Faugeres",
    "L20060": "Rượu vang đỏ Chateau de Ciffre Grand Vin AOP Saint Chinian",
    "L20061": "Rượu vang đỏ L'Orangeraie Pays d'Oc Pinot Noir",
    "L20062": "Rượu vang trắng L'Orangeraie Pays d'Oc Chardonnay",
    "L20063": "Rượu vang hồng La Petite Rosee d'Ete Pays d'Oc",
    "L20071": "Rượu vang đỏ Chateau de Ciffre Faugères",
    "L20072": "Rượu vang đỏ Chateau de Ciffre Saint Chinian",
    "L20073": "Rượu vang đỏ Cassaigne le Labyrinthe Côtes de Gascogne Rouge",
    "L20074": "Rượu vang trắng Cassaigne le Labyrinthe Côtes de Gascogne Blanc",
    "L20075": "Rượu vang đỏ Folie Rouge",
    "L20076": "Rượu vang đỏ Château La Ribaud Médoc",
    "L20077": "Rượu vang đỏ Jumo Special Label",

    // Ý (Italy) - Sartori, La Jara, Collavini, Lamura, Mirafiore, Buccianera...
    "L10001": "Rượu vang đỏ I Saltari Amarone della Valpolicella DOCG",
    "L10004": "Rượu vang đỏ Arco dei Giovi Amarone Della Valpolicella Classico DOCG",
    "L10005": "Rượu vang đỏ Arco dei Giovi Valpolicella Ripasso Superiore DOC",
    "L10007": "Rượu vang trắng Arco dei Giovi Pinot Grigio delle Venezie DOC",
    "L10008": "Rượu vang đỏ CENTOVENTI “Special Edition” Rosso Veneto IGT",
    "L10009": "Rượu vang nổ Sartori Prosecco Brut “Love Story” DOC",
    "L10010": "Rượu vang nổ Sartori Prosecco Rosé Brut “Love Story” DOC",
    "L10011": "Rượu vang trắng Sartori \"SELLA\" Soave Classico DOC",
    "L10014": "Rượu vang đỏ Sartori \"REGOLO\" Valpolicella Ripasso Classico Superiore DOC",
    "L10023": "Rượu vang nổ La Jara Prosecco Millesimato Dry",
    "L10024": "Rượu vang nổ La Jara Prosecco Millesimato Zero Dosage",
    "L10025": "Rượu vang nổ La Jara Prosecco Rose Millesimato Brut",
    "L10026": "Rượu vang nổ La Jara Pinot Noir Blanc de Noir Brut Nature",
    "L10027": "Rượu vang nổ La Jara Chardonnay Blanc de Blanc Brut Nature",
    "L10035": "Rượu vang không cồn La Jara Offbeat ZERO Sparkling White",
    "L10036": "Rượu vang không cồn La Jara Offbeat ZERO Sparkling Rosé",
    "L10022": "Rượu vang trắng Collavini Ribolla Gialla Benedete IGT",
    "L10015": "Rượu vang trắng Collavini Chardonnay dei Sassi Cavi DOC",
    "L10017": "Rượu vang đỏ Collavini Cabernet Roncaccio IGT",
    "L10016": "Rượu vang trắng Collavini Pinot Grigio Villa Canlungo DOC",
    "L10018": "Rượu vang trắng Collavini \".......\" Bianco IGT",
    "L10019": "Rượu vang đỏ Collavini \"More\" Rosso IGT",
    "L10020": "Rượu vang nổ Collavini Ribolla Gialla Spumante Brut DOC",
    "L10021": "Rượu vang trắng Collavini Broy DOC Collio",
    "L10028": "Rượu vang trắng Lamura Grillo Sicilia DOC",
    "L10029": "Rượu vang đỏ Lamura Nero d'Avola Sicilia DOC",
    "L10030": "Rượu vang trắng Alta Mora Etna Bianco DOC",
    "L10031": "Rượu vang đỏ Alta Mora Etna Rosso DOC",
    "L10032": "Rượu vang đỏ Mirafiore Dolcetto d'Alba DOC",
    "L10033": "Rượu vang trắng Mirafiore Langhe Nascetta DOC",
    "L10034": "Rượu vang đỏ Mirafiore Barolo DOCG",
    "L10037": "Rượu vang đỏ Sartori Reius Amarone della Valpolicella Classico",
    "L10038": "Rượu vang đỏ Sartori Brolo di Sotto Valpolicella Classico",
    "L10039": "Rượu vang trắng Anselmi San Vincenzo Bianco Veneto",
    "L10040": "Rượu vang đỏ Buccianera Chianti Tenuta di Campriano",
    "L10041": "Rượu vang đỏ Buccianera Rosso Relativo Toscana",
    "L10042": "Rượu vang đỏ Petra Zingari Rosso Toscana",
    "L10043": "Rượu vang đỏ Buccianera Pa'ro Rosso Toscana",
    "L10044": "Rượu vang trắng Buccianera Pa'ro Orange Wine",
    "L10045": "Rượu vang đỏ Terre di Monteforte Vulcanico Rosso Veneto",
    "L10046": "Rượu vang trắng Terre di Monteforte Vulcanico Soave",

    // Chile - Vina San Esteban
    "L30001": "Rượu vang đỏ Vina San Esteban Classic Cabernet Sauvignon",
    "L30002": "Rượu vang đỏ Vina San Esteban Classic Merlot",
    "L30003": "Rượu vang trắng Vina San Esteban Classic Chardonnay",
    "L30005": "Rượu vang đỏ Vina San Esteban Gran Reserva Cabernet Sauvignon",

    // Úc (Australia) - Berton Vineyards, Calabria
    "L40001": "Rượu vang đỏ Berton Vineyards Head Over Heels Shiraz",
    "L40002": "Rượu vang đỏ Berton Vineyards Head Over Heels Cabernet Merlot",
    "L40003": "Rượu vang trắng Berton Vineyards Head Over Heels Chardonnay",
    "L40004": "Rượu vang trắng Berton Vineyards Head Over Heels Sauvignon Blanc",
    "L40005": "Rượu vang đỏ Berton Vineyards Metal Label The Black Shiraz",
    "L40006": "Rượu vang trắng Berton Vineyards Metal Label Sauvignon Blanc",
    "L40007": "Rượu vang đỏ Berton Vineyards Reserve Coonawarra Cabernet Sauvignon",
    "L40008": "Rượu vang đỏ Berton Vineyards Reserve Barossa Shiraz",
    "L40009": "Rượu vang trắng Berton Vineyards Reserve Riverina Botrytis Semillon (375 ml)",
    "L40010": "Rượu vang đỏ The Wall Shiraz",
    "L40011": "Rượu vang trắng The Wall Chardonnay",
    "L40012": "Rượu vang đỏ Calabria Guiding Star Shiraz",
    "L40013": "Rượu vang trắng Calabria Guiding Star Chardonnay",
    "L40014": "Rượu vang trắng Calabria Guiding Star Moscato",

    // Tây Ban Nha (Spain)
    "L50001": "Rượu vang đỏ Bailando Garnacha",
    "L50002": "Rượu vang nổ Cava Bella Mistala Brut",

    // New Zealand - Sandy Cove, By Josh Scott
    "L60001": "Rượu vang trắng Sandy Cove Sauvignon Blanc Marlborough",
    "L60002": "Rượu vang đỏ Sandy Cove Pinot Noir Marlborough",
    "L60003": "Rượu vang trắng By Josh Scott “Yeah Cool” Natural Sauvignon Blanc",
    "L60004": "Rượu vang đỏ By Josh Scott \"Deal With It\" Natural Pinot Noir",
    "L60005": "Rượu vang nổ By Josh Scott Marlborough Pétillant Naturel",

    // Nam Phi (South Africa) - Anthonij Rupert
    "L80001": "Rượu vang đỏ Anthonij Rupert Protea Shiraz",
    "L80002": "Rượu vang đỏ Anthonij Rupert Protea Cabernet Sauvignon",
    "L80003": "Rượu vang đỏ Anthonij Rupert Optima",
    "L80004": "Rượu vang đỏ Anthonij Rupert Blend",
    "L80005": "Rượu vang trắng Anthonij Rupert Protea Chenin Blanc",
    "L80006": "Rượu vang trắng Anthonij Rupert Protea Sauvignon Blanc",

    // Mỹ (USA) - Duckhorn, Decoy
    "L70001": "Rượu vang đỏ Decoy California Pinot Noir",
    "L70002": "Rượu vang đỏ Decoy California Cabernet Sauvignon",
    "L70003": "Rượu vang đỏ Duckhorn Vineyards Napa Valley Merlot",
    "L70004": "Rượu vang đỏ Duckhorn Vineyards Napa Valley Cabernet Sauvignon",
    "L70005": "Rượu vang trắng Decoy California Chardonnay",
}

/**
 * Lấy tên sản phẩm chuẩn Tự Công Bố phục vụ xuất hóa đơn điện tử VNPT.
 * Nếu SKU có trong danh mục chuẩn hóa 25.07 -> Trả về tên Tự Công Bố.
 * Nếu không có -> Fallback về tên sản phẩm hiện tại trong cơ sở dữ liệu.
 */
export function getVnptInvoiceProductName(skuCode?: string, fallbackName?: string): string {
    if (!skuCode) return fallbackName || ''
    const cleanSku = skuCode.trim().toUpperCase()
    return VNPT_PRODUCT_INVOICE_NAMES[cleanSku] || fallbackName || ''
}
