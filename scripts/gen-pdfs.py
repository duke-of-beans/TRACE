"""
TRACE — Branded PDF Generator
Converts markdown docs to TRACE-styled PDFs.
"""
import os, re, sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, HRFlowable,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# TRACE brand
BG = HexColor("#0f172a")
SURFACE = HexColor("#1e293b")
ACCENT = HexColor("#4fc3f7")
TEXT = HexColor("#e2e8f0")
TEXT_SEC = HexColor("#94a3b8")
TEXT_MUTED = HexColor("#64748b")
DANGER = HexColor("#DC2626")
WHITE = HexColor("#ffffff")
DARK = HexColor("#0f0f1a")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_MONO = "Courier"

def make_styles():
    return {
        "title": ParagraphStyle("title", fontName=FONT_BOLD, fontSize=28, leading=34,
            textColor=WHITE, spaceAfter=6),
        "subtitle": ParagraphStyle("subtitle", fontName=FONT, fontSize=10, leading=14,
            textColor=TEXT_MUTED, spaceAfter=24, tracking=3),
        "h1": ParagraphStyle("h1", fontName=FONT_BOLD, fontSize=18, leading=24,
            textColor=ACCENT, spaceBefore=28, spaceAfter=10),
        "h2": ParagraphStyle("h2", fontName=FONT_BOLD, fontSize=14, leading=18,
            textColor=WHITE, spaceBefore=20, spaceAfter=8),
        "h3": ParagraphStyle("h3", fontName=FONT_BOLD, fontSize=11, leading=15,
            textColor=TEXT, spaceBefore=14, spaceAfter=6),
        "body": ParagraphStyle("body", fontName=FONT, fontSize=9.5, leading=14,
            textColor=TEXT, spaceAfter=6),
        "code": ParagraphStyle("code", fontName=FONT_MONO, fontSize=8, leading=11,
            textColor=ACCENT, backColor=HexColor("#1a1a2e"),
            spaceBefore=4, spaceAfter=8, leftIndent=12, rightIndent=12,
            borderPadding=(6, 8, 6, 8)),
        "bullet": ParagraphStyle("bullet", fontName=FONT, fontSize=9.5, leading=14,
            textColor=TEXT, spaceAfter=3, leftIndent=20, bulletIndent=10),
        "table_cell": ParagraphStyle("tc", fontName=FONT, fontSize=8, leading=11, textColor=TEXT),
        "table_header": ParagraphStyle("th", fontName=FONT_BOLD, fontSize=8, leading=11, textColor=ACCENT),
        "footer": ParagraphStyle("footer", fontName=FONT, fontSize=7, textColor=TEXT_MUTED, alignment=TA_CENTER),
    }

def header_footer(canvas, doc):
    canvas.saveState()
    # Header line
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(0.5)
    canvas.line(54, letter[1] - 40, letter[0] - 54, letter[1] - 40)
    # TRACE mark top-left
    canvas.setFont(FONT, 7)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(54, letter[1] - 36, "TRACE")
    # Page number bottom-right
    canvas.setFont(FONT, 7)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawRightString(letter[0] - 54, 30, f"Page {doc.page}")
    # Bottom accent line
    canvas.setStrokeColor(SURFACE)
    canvas.line(54, 42, letter[0] - 54, 42)
    canvas.restoreState()

def first_page(canvas, doc):
    canvas.saveState()
    # Dark background rectangle at top
    canvas.setFillColor(BG)
    canvas.rect(0, letter[1] - 160, letter[0], 160, fill=1, stroke=0)
    # Accent bar
    canvas.setFillColor(ACCENT)
    canvas.rect(54, letter[1] - 162, 80, 2, fill=1, stroke=0)
    canvas.restoreState()

def md_to_flowables(md_text, styles):
    """Convert markdown to reportlab flowables."""
    flowables = []
    in_code = False
    code_buf = []
    in_table = False
    table_rows = []

    for line in md_text.split("\n"):
        # Code blocks
        if line.strip().startswith("```"):
            if in_code:
                code_text = "<br/>".join(
                    l.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace(" ", "&nbsp;")
                    for l in code_buf
                )
                flowables.append(Paragraph(code_text, styles["code"]))
                code_buf = []
                in_code = False
            else:
                in_code = True
            continue
        if in_code:
            code_buf.append(line)
            continue

        # Tables
        if "|" in line and line.strip().startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(set(c) <= set("- :") for c in cells):
                continue  # separator row
            table_rows.append(cells)
            in_table = True
            continue
        elif in_table:
            # Flush table
            if table_rows:
                flowables.extend(make_table(table_rows, styles))
            table_rows = []
            in_table = False

        stripped = line.strip()
        if not stripped:
            flowables.append(Spacer(1, 6))
            continue

        # Headers
        if stripped.startswith("# "):
            flowables.append(Paragraph(esc(stripped[2:]), styles["h1"]))
        elif stripped.startswith("## "):
            flowables.append(Paragraph(esc(stripped[3:]), styles["h2"]))
        elif stripped.startswith("### "):
            flowables.append(Paragraph(esc(stripped[4:]), styles["h3"]))
        elif stripped.startswith("- [ ] ") or stripped.startswith("- [x] "):
            check = "✓" if "[x]" in stripped[:6] else "☐"
            flowables.append(Paragraph(f"{check} {esc(stripped[6:])}", styles["bullet"]))
        elif stripped.startswith("- ") or stripped.startswith("* "):
            flowables.append(Paragraph(f"• {esc(stripped[2:])}", styles["bullet"]))
        elif re.match(r"^\d+\.", stripped):
            flowables.append(Paragraph(esc(stripped), styles["bullet"]))
        else:
            text = esc(stripped)
            text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
            text = re.sub(r'`(.+?)`', r'<font face="Courier" color="#4fc3f7">\1</font>', text)
            flowables.append(Paragraph(text, styles["body"]))

    # Flush any remaining table
    if table_rows:
        flowables.extend(make_table(table_rows, styles))

    return flowables

def make_table(rows, styles):
    if not rows:
        return []
    # Build table data
    data = []
    for i, row in enumerate(rows):
        style = styles["table_header"] if i == 0 else styles["table_cell"]
        data.append([Paragraph(esc(c), style) for c in row])

    ncols = max(len(r) for r in data)
    col_width = (letter[0] - 108) / ncols

    t = Table(data, colWidths=[col_width] * ncols)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
        ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT),
        ("GRID", (0, 0), (-1, -1), 0.5, TEXT_MUTED),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#111827"), HexColor("#0f172a")]),
    ]))
    return [Spacer(1, 6), t, Spacer(1, 8)]

def esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def generate_pdf(md_path, pdf_path, title, subtitle):
    styles = make_styles()
    with open(md_path, "r", encoding="utf-8") as f:
        md = f.read()

    doc = SimpleDocTemplate(
        pdf_path, pagesize=letter,
        topMargin=60, bottomMargin=54, leftMargin=54, rightMargin=54,
    )

    story = []
    # Title block
    story.append(Spacer(1, 30))
    story.append(Paragraph(title, styles["title"]))
    story.append(Paragraph(subtitle.upper(), styles["subtitle"]))
    story.append(HRFlowable(width="30%", thickness=1, color=ACCENT, spaceAfter=20))

    # Content
    story.extend(md_to_flowables(md, styles))

    doc.build(story, onFirstPage=first_page, onLaterPages=header_footer)
    print(f"  + {pdf_path}")

if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(base, "docs", "pdf")
    os.makedirs(out, exist_ok=True)

    print("Generating TRACE branded PDFs...")
    generate_pdf(
        os.path.join(base, "README.md"),
        os.path.join(out, "TRACE_Overview.pdf"),
        "TRACE", "Tracking, Reporting, Analysis & Community Evidence"
    )
    generate_pdf(
        os.path.join(base, "docs", "CHAPTER_SETUP.md"),
        os.path.join(out, "TRACE_Chapter_Setup_Guide.pdf"),
        "Chapter Setup Guide", "Step-by-step deployment for new chapters"
    )
    generate_pdf(
        os.path.join(base, "DISPATCH_DESIGN.md"),
        os.path.join(out, "TRACE_Dispatch_Design.pdf"),
        "Dispatch System Design", "Workflows, architecture, and implementation"
    )
    print("Done.")
