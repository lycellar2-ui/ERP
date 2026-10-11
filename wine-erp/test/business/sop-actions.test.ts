import { describe, it, expect } from 'vitest'
import { getSopsAction, getOfficialFormsAction } from '@/app/dashboard/sop/actions'

describe('SOP Actions & Forms Verification', () => {
    it('should retrieve official sops from store', async () => {
        const sops = await getSopsAction()
        expect(sops.length).toBeGreaterThanOrEqual(6)
        
        const codes = sops.map(s => s.code)
        expect(codes).toContain('SOP 6.1')
        expect(codes).toContain('SOP 6.3')
        expect(codes).toContain('SOP 6.4')
        expect(codes).toContain('SOP 8.2')
        expect(codes).toContain('SOP 8.4')
        expect(codes).toContain('SOP 5.1')
    })

    it('should retrieve official forms and procedures from public/forms directory', async () => {
        const forms = await getOfficialFormsAction()
        expect(forms.length).toBeGreaterThanOrEqual(45)

        const fileNames = forms.map(f => f.fileName)
        expect(fileNames).toContain('Form_8.8-A_Yeu_cau_Tao_ma_KH.xlsx')
        expect(fileNames).toContain('Form_6.1-B_Phu_luc_Gia_Dac_biet.xlsx')
        expect(fileNames).toContain('Form_6.4-B_Ly_Cellars_Quotation_Template.xlsx')
        expect(fileNames).toContain('Form_4.5-A_Landed_Cost.xlsx')
        expect(fileNames).toContain('Form_5.1-A_Bien_ban_Kiem_nhan.xlsx')
        expect(fileNames).toContain('quy_trinh_nhap_khau_mau.md')
        expect(fileNames).toContain('SOP_Sales_Field_Visit_Checkin.md')

        // Each form must have valid download url
        forms.forEach(f => {
            expect(f.downloadUrl).toMatch(/^\/forms\//)
            expect(f.fileSize).toBeTruthy()
        })
    })
})
