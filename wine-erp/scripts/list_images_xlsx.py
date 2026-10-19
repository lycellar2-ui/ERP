import openpyxl
from openpyxl.drawing.image import Image
import os

def list_images():
    file_path = r"D:\Lyscellar\Quotation\Quotation - Hummingbird 16.06.xlsx"
    if not os.path.exists(file_path):
        print("File not found")
        return

    wb = openpyxl.load_workbook(file_path)
    for name in wb.sheetnames:
        sheet = wb[name]
        print(f"\nSheet: {name}")
        # Look for images in the sheet
        if hasattr(sheet, '_images') and sheet._images:
            print(f"  Found {len(sheet._images)} images:")
            for idx, img in enumerate(sheet._images):
                # Print image details
                anchor = img.anchor
                # Check anchor type (can be SingleCellAnchor or TwoCellAnchor)
                print(f"    Image {idx + 1}:")
                if anchor is not None:
                    # Let's inspect anchor fields directly
                    try:
                        col = anchor._from.col
                        row = anchor._from.row
                        print(f"      Position: Row {row + 1}, Col {col + 1}")
                    except Exception as e:
                        print(f"      Position error: {e}")
        else:
            print("  No images found.")

if __name__ == "__main__":
    list_images()
