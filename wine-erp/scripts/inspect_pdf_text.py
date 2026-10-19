import pypdf
import os

def read_pdf():
    file_path = r"D:\Lyscellar\Quotation\FABRIK- - Quotation 2026.pdf"
    if not os.path.exists(file_path):
        print("File not found")
        return

    print(f"Reading {file_path}...")
    reader = pypdf.PdfReader(file_path)
    print(f"Pages: {len(reader.pages)}")
    for idx, page in enumerate(reader.pages):
        print(f"\n--- Page {idx + 1} ---")
        print(page.extract_text())

if __name__ == "__main__":
    try:
        read_pdf()
    except Exception as e:
        print("Error:", e)
        # Try PyPDF2 if pypdf is not available
        try:
            import PyPDF2
            print("Trying PyPDF2...")
            reader = PyPDF2.PdfReader(r"D:\Lyscellar\Quotation\FABRIK- - Quotation 2026.pdf")
            for idx, page in enumerate(reader.pages):
                print(f"--- Page {idx + 1} ---")
                print(page.extract_text())
        except Exception as e2:
            print("PyPDF2 Error:", e2)
