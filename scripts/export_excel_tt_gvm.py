import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb_src = openpyxl.load_workbook('Bao_cao_Ton_kho_2_Cong_ty_08.11.2026.xlsx', data_only=False)

def to_num(val):
    if val is None or val == '':
        return 0
    if isinstance(val, (int, float)):
        return val
    try:
        return float(str(val).strip().replace(',', ''))
    except:
        return 0

# 1. Parse Sheet 5 - TT
s5 = wb_src['5. Tồn Thường Tín (Chờ kiểm)']
tt_by_code = {}
for r in range(5, s5.max_row+1):
    c = s5.cell(r, 3).value
    n = s5.cell(r, 4).value
    box = to_num(s5.cell(r, 6).value) or 6
    ton = int(to_num(s5.cell(r, 7).value) + to_num(s5.cell(r, 8).value) - to_num(s5.cell(r, 9).value))
    if c and str(c).strip():
        code = str(c).strip()
        if code not in tt_by_code:
            tt_by_code[code] = {'name': n, 'box': int(box), 'ton_tt': 0}
        tt_by_code[code]['ton_tt'] += ton

# 2. Parse Sheet 4 - T2 GVM
s4 = wb_src['4. Tồn Tầng 2 GVM (08.11)']
t2_by_code = {}
for r in range(5, s4.max_row+1):
    c = s4.cell(r, 3).value
    n = s4.cell(r, 4).value
    box = to_num(s4.cell(r, 6).value) or 6
    tot_t2 = sum(to_num(s4.cell(r, col).value) for col in range(7, 14))
    if c and str(c).strip():
        code = str(c).strip()
        if code not in t2_by_code:
            t2_by_code[code] = {'name': n, 'box': int(box), 'ton_t2': 0}
        t2_by_code[code]['ton_t2'] += int(tot_t2)

# 3. Parse Sheet 2 - Cau thang T1
s2 = wb_src['2. Xác nhận bán Cầu thang T1']
ct_by_code = {}
for r in range(6, s2.max_row+1):
    c = s2.cell(r, 3).value
    if c and str(c).strip() and not str(c).startswith('SO-') and str(c) not in ['TỔNG CỘNG', 'Số Đơn (SO)']:
        code = str(c).strip()
        ton_ct = to_num(s2.cell(r, 8).value)
        so_ban = to_num(s2.cell(r, 11).value)
        rem = int(ton_ct - so_ban)
        ct_by_code[code] = rem

# 4. Parse Petnat L60005 in Sheet 3
s3 = wb_src['3. Tồn Tầng 1 (Kèm số bán)']
petnat_ton = 0
for r in range(5, s3.max_row+1):
    c = s3.cell(r, 4).value
    if c and str(c).strip() == 'L60005':
        tot_pos = sum(to_num(s3.cell(r, col).value) for col in range(8, 15))
        so_ban = to_num(s3.cell(r, 16).value)
        petnat_ton += int(tot_pos - so_ban)

# Merge all codes
all_codes = sorted(list(set(list(tt_by_code.keys()) + list(t2_by_code.keys()) + list(ct_by_code.keys()))))

# Plan suggestion: 300 bottles (48 boxes)
# Jumo Malbec L20077: 120 bottles (20 boxes)
# Additional 180 bottles:
# L10015: 36 (6 boxes of 6)
# L20013: 24 (4 boxes of 6)
# L20015: 24 (4 boxes of 6)
# L20052: 24 (4 boxes of 6)
# L20030: 24 (4 boxes of 6)
# L20057: 24 (4 boxes of 6)
# L10039: 24 (2 boxes of 12)
suggested_plan = {
    'L20077': (120, 20, 'Đã chọn: 20 thùng Jumo Malbec'),
    'L10015': (36, 6, 'Gợi ý: GVM còn 8 chai, bù 6 thùng'),
    'L20013': (24, 4, 'Gợi ý: GVM còn 7 chai, bù 4 thùng'),
    'L20015': (24, 4, 'Gợi ý: GVM còn 6 chai, bù 4 thùng'),
    'L20052': (24, 4, 'Gợi ý: GVM còn 7 chai, bù 4 thùng'),
    'L20030': (24, 4, 'Gợi ý: GVM còn 11 chai, bù 4 thùng'),
    'L20057': (24, 4, 'Gợi ý: GVM còn 14 chai, bù 4 thùng'),
    'L10039': (24, 2, 'Gợi ý: GVM còn 15 chai, bù 2 thùng 12')
}

rows_data = []
for code in all_codes:
    tt_info = tt_by_code.get(code, {})
    t2_info = t2_by_code.get(code, {})
    name = tt_info.get('name') or t2_info.get('name') or ''
    box = tt_info.get('box') or t2_info.get('box') or 6
    
    ton_tt = tt_info.get('ton_tt', 0)
    ton_t2 = t2_info.get('ton_t2', 0)
    ton_ct = ct_by_code.get(code, 0)
    if code == 'L60005':
        ton_ct += petnat_ton
    
    ton_gvm = ton_t2 + ton_ct
    
    # Suggestion values
    sug_bottles, sug_boxes, sug_note = suggested_plan.get(code, (0, 0, ''))
    if not sug_note:
        if ton_tt > 0 and ton_gvm == 0:
            sug_note = 'GVM hết hàng (0 chai)'
        elif ton_tt > 0 and ton_gvm <= 15:
            sug_note = 'GVM sắp hết (<= 15 chai)'
        elif ton_tt == 0 and ton_gvm > 0:
            sug_note = 'Chỉ có tại GVM'
        elif ton_tt > 0 and ton_gvm > 15:
            sug_note = 'Tồn kho ổn định'
        else:
            sug_note = 'Hết hàng cả 2 kho'
            
    rows_data.append({
        'code': code,
        'name': name,
        'box': box,
        'ton_tt': ton_tt,
        'ton_gvm': ton_gvm,
        'ton_t2': ton_t2,
        'ton_ct': ton_ct,
        'thung_tt': f"{ton_tt // box} th + {ton_tt % box} lẻ" if box else '',
        'thung_gvm': f"{ton_gvm // box} th + {ton_gvm % box} lẻ" if box else '',
        'sug_bottles': sug_bottles,
        'sug_boxes': sug_boxes,
        'sug_note': sug_note
    })

# Create Workbook
wb_out = openpyxl.Workbook()
ws = wb_out.active
ws.title = "Doi_Chieu_TT_vs_GVM"
ws.views.sheetView[0].showGridLines = True

# Title block
ws.merge_cells('A1:L1')
ws['A1'] = "BẢNG ĐỐI CHIẾU TỒN KHO THƯỜNG TÍN & GVM — KÈM GỢI Ý ĐIỀU CHUYỂN (CÔNG TY THẮNG ÂN)"
ws['A1'].font = Font(name='Calibri', size=14, bold=True, color='1E293B')
ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
ws.row_dimensions[1].height = 30

ws.merge_cells('A2:L2')
ws['A2'] = "Số liệu chốt ngày 08/11/2026 | Tồn GVM = Kho Tầng 2 + Cầu thang T1 | Cột I & J: Gợi ý điều chuyển chuyến 300 chai (hoặc tự điều chỉnh)"
ws['A2'].font = Font(name='Calibri', size=10, italic=True, color='64748B')
ws['A2'].alignment = Alignment(horizontal='center', vertical='center')
ws.row_dimensions[2].height = 20

# Header
headers = [
    ("STT", 6),
    ("Mã hàng", 14),
    ("Tên hàng hóa", 42),
    ("Quy cách", 12),
    ("Tồn Thường Tín\n(Chai)", 18),
    ("TỔNG TỒN GVM\n(Chai)", 18),
    ("Chi tiết\nTầng 2", 14),
    ("Chi tiết\nCầu thang T1", 16),
    ("GỢI Ý CHUYỂN\n(Chai)", 18),
    ("GỢI Ý CHUYỂN\n(Thùng)", 18),
    ("Tồn sau chuyển\ntại GVM (Chai)", 18),
    ("Ghi chú / Đề xuất điều chuyển", 32)
]

header_fill_blue = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid') # Navy
header_fill_green = PatternFill(start_color='065F46', end_color='065F46', fill_type='solid') # Emerald Green for Suggestion
header_font = Font(name='Calibri', size=10, bold=True, color='FFFFFF')

thin_border = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

ws.row_dimensions[4].height = 32
for col_idx, (h_name, width) in enumerate(headers, 1):
    cell = ws.cell(row=4, column=col_idx, value=h_name)
    # columns 9, 10, 11 have special green header to highlight suggestion
    if col_idx in [9, 10, 11]:
        cell.fill = header_fill_green
    else:
        cell.fill = header_fill_blue
    cell.font = header_font
    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    cell.border = thin_border
    ws.column_dimensions[get_column_letter(col_idx)].width = width

# Fill Data
fill_zebra = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
fill_sug = PatternFill(start_color='ECFDF5', end_color='ECFDF5', fill_type='solid') # Light green for active transfer rows
fill_caution = PatternFill(start_color='FFFBEB', end_color='FFFBEB', fill_type='solid') # Light amber
font_regular = Font(name='Calibri', size=10, color='1E293B')
font_bold = Font(name='Calibri', size=10, bold=True, color='1E293B')
font_green_bold = Font(name='Calibri', size=10, bold=True, color='047857')

row_start = 5
for idx, item in enumerate(rows_data, 1):
    curr_row = row_start + idx - 1
    ws.row_dimensions[curr_row].height = 20
    
    is_suggested = item['sug_bottles'] > 0
    curr_fill = fill_sug if is_suggested else (fill_zebra if idx % 2 == 0 else PatternFill(fill_type=None))

    ws.cell(curr_row, 1, idx).alignment = Alignment(horizontal='center', vertical='center')
    ws.cell(curr_row, 2, item['code']).alignment = Alignment(horizontal='center', vertical='center')
    ws.cell(curr_row, 3, item['name']).alignment = Alignment(horizontal='left', vertical='center')
    ws.cell(curr_row, 4, f"{item['box']} chai/th").alignment = Alignment(horizontal='center', vertical='center')
    
    # TT stock
    c_tt = ws.cell(curr_row, 5, item['ton_tt'])
    c_tt.alignment = Alignment(horizontal='right', vertical='center')
    c_tt.number_format = '#,##0'
    c_tt.font = font_bold
    
    # GVM stock
    c_gvm = ws.cell(curr_row, 6, item['ton_gvm'])
    c_gvm.alignment = Alignment(horizontal='right', vertical='center')
    c_gvm.number_format = '#,##0'
    c_gvm.font = font_bold
    
    # T2 & CT
    c_t2 = ws.cell(curr_row, 7, item['ton_t2'])
    c_t2.alignment = Alignment(horizontal='right', vertical='center')
    c_t2.number_format = '#,##0'
    
    c_ct = ws.cell(curr_row, 8, item['ton_ct'])
    c_ct.alignment = Alignment(horizontal='right', vertical='center')
    c_ct.number_format = '#,##0'
    
    # Suggestion bottles (Col I)
    c_sug_b = ws.cell(curr_row, 9, item['sug_bottles'])
    c_sug_b.alignment = Alignment(horizontal='right', vertical='center')
    c_sug_b.number_format = '#,##0'
    if is_suggested:
        c_sug_b.font = font_green_bold
    
    # Suggestion boxes (Col J) - formula = Col I / Col D or value
    c_sug_box = ws.cell(curr_row, 10, item['sug_boxes'])
    c_sug_box.alignment = Alignment(horizontal='right', vertical='center')
    c_sug_box.number_format = '#,##0'
    if is_suggested:
        c_sug_box.font = font_green_bold
        
    # Projected GVM stock after transfer (Col K) = Col F + Col I
    c_proj = ws.cell(curr_row, 11, f"=F{curr_row}+I{curr_row}")
    c_proj.alignment = Alignment(horizontal='right', vertical='center')
    c_proj.number_format = '#,##0'
    c_proj.font = font_bold if is_suggested else font_regular
    
    # Note
    c_note = ws.cell(curr_row, 12, item['sug_note'])
    c_note.alignment = Alignment(horizontal='left', vertical='center')
    if is_suggested:
        c_note.font = font_green_bold
    else:
        c_note.font = font_regular
        
    for c in range(1, 13):
        cell = ws.cell(curr_row, c)
        cell.border = thin_border
        if curr_fill.fill_type:
            cell.fill = curr_fill

# Total row
tot_row = row_start + len(rows_data)
ws.row_dimensions[tot_row].height = 24
ws.cell(tot_row, 2, "TỔNG CỘNG").font = Font(name='Calibri', size=11, bold=True, color='1E3A8A')
ws.cell(tot_row, 2).alignment = Alignment(horizontal='center', vertical='center')

total_fill = PatternFill(start_color='E2E8F0', end_color='E2E8F0', fill_type='solid')

sum_cols = [
    (5, f"=SUM(E{row_start}:E{tot_row-1})"),
    (6, f"=SUM(F{row_start}:F{tot_row-1})"),
    (7, f"=SUM(G{row_start}:G{tot_row-1})"),
    (8, f"=SUM(H{row_start}:H{tot_row-1})"),
    (9, f"=SUM(I{row_start}:I{tot_row-1})"),
    (10, f"=SUM(J{row_start}:J{tot_row-1})"),
    (11, f"=SUM(K{row_start}:K{tot_row-1})")
]

for col_idx, formula in sum_cols:
    cell = ws.cell(tot_row, col_idx, formula)
    if col_idx in [9, 10]:
        cell.font = Font(name='Calibri', size=11, bold=True, color='047857')
    else:
        cell.font = Font(name='Calibri', size=11, bold=True, color='1E3A8A')
    cell.alignment = Alignment(horizontal='right', vertical='center')
    cell.number_format = '#,##0'

for c in range(1, 13):
    cell = ws.cell(tot_row, c)
    cell.border = thin_border
    cell.fill = total_fill

out_path = 'Bang_Doi_Chieu_Ton_Kho_TT_vs_GVM.xlsx'
wb_out.save(out_path)
print(f"Updated {out_path} with 3 dedicated suggestion columns!")
