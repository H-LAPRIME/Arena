import io
import os
import math
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
from fpdf import FPDF
from typing import List, Dict, Any
import requests
import hashlib
from app.config import get_settings

class CertificateService:
    def __init__(self):
        self.font_path = self._first_existing_font([
            "C:\\Windows\\Fonts\\arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        ])
        self.bold_font_path = self._first_existing_font([
            "C:\\Windows\\Fonts\\arialbd.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        ]) or self.font_path
        self.signature_font_path = self._first_existing_font([
            "C:\\Windows\\Fonts\\segoesc.ttf",
            "C:\\Windows\\Fonts\\segoescb.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSerif-Italic.ttf",
        ]) or self.font_path
        self._platform_logo_cache = None

    def _first_existing_font(self, paths):
        for path in paths:
            if path and os.path.exists(path):
                return path
        return None

    def _font(self, size: int, bold: bool = False, signature: bool = False):
        try:
            path = self.signature_font_path if signature else self.bold_font_path if bold else self.font_path
            return ImageFont.truetype(path, size) if path else ImageFont.load_default()
        except Exception:
            return ImageFont.load_default()

    def _center_text(self, draw, text, y, font, fill, width=2000):
        bbox = draw.textbbox((0, 0), text, font=font)
        draw.text(((width - (bbox[2] - bbox[0])) / 2, y), text, font=font, fill=fill)

    def _fit_font(self, text: str, max_width: int, size: int, bold: bool = False, signature: bool = False, min_size: int = 42):
        while size > min_size:
            font = self._font(size, bold=bold, signature=signature)
            bbox = ImageDraw.Draw(Image.new("RGB", (10, 10))).textbbox((0, 0), text, font=font)
            if bbox[2] - bbox[0] <= max_width:
                return font
            size -= 6
        return self._font(min_size, bold=bold, signature=signature)

    def _center_text_fit(self, draw, text, y, max_width, size, fill, bold=False, signature=False, min_size=42, width=2000):
        font = self._fit_font(text, max_width, size, bold=bold, signature=signature, min_size=min_size)
        self._center_text(draw, text, y, font, fill, width=width)
        return font

    def _verification_id(self, *parts: str) -> str:
        raw = "|".join(parts + (datetime.utcnow().strftime("%Y%m%d"),))
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12].upper()

    def _candidate_logo_urls(self):
        settings = get_settings()
        if settings.PLATFORM_LOGO_URL:
            yield settings.PLATFORM_LOGO_URL
        if settings.SUPABASE_URL:
            base = settings.SUPABASE_URL.rstrip("/")
            bucket = settings.SUPABASE_LOGO_BUCKET.strip("/") or "logos"
            paths = [
                settings.SUPABASE_LOGO_PATH.strip("/"),
                "logo.png",
                "logo.jpg",
                "logo.jpeg",
                "icon.png",
            ]
            seen = set()
            for path in paths:
                if path and path not in seen:
                    seen.add(path)
                    yield f"{base}/storage/v1/object/public/{bucket}/{path}"

    def _load_platform_logo(self):
        if self._platform_logo_cache is not None:
            return self._platform_logo_cache

        self._platform_logo_cache = False
        for url in self._candidate_logo_urls():
            try:
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200 and resp.content:
                    logo = Image.open(io.BytesIO(resp.content)).convert("RGBA")
                    self._platform_logo_cache = logo
                    break
            except Exception:
                continue
        return self._platform_logo_cache if self._platform_logo_cache is not False else None

    def _draw_platform_logo(self, img, draw, x, y, size=150, accent=(212, 175, 55), text=(255, 255, 255)):
        draw.rounded_rectangle([x, y, x + size, y + size], radius=28, fill=(14, 18, 34), outline=accent, width=5)
        logo = self._load_platform_logo()
        if logo:
            logo.thumbnail((size - 28, size - 28), Image.LANCZOS)
            logo_x = x + (size - logo.width) // 2
            logo_y = y + (size - logo.height) // 2
            img.paste(logo, (logo_x, logo_y), logo)
        else:
            cx = x + size // 2
            cy = y + size // 2
            draw.ellipse([cx - 38, cy - 38, cx + 38, cy + 38], outline=accent, width=5)
            draw.line([cx - 38, cy, cx + 38, cy], fill=accent, width=3)
            draw.line([cx, cy - 38, cx, cy + 38], fill=accent, width=3)
        draw.text((x + size + 24, y + 24), "EFOOTBALL", font=self._font(32, bold=True), fill=text)
        draw.text((x + size + 24, y + 62), "ARENA", font=self._font(54, bold=True), fill=accent)
        draw.text((x + size + 24, y + 120), "Official platform certificate", font=self._font(24), fill=(150, 160, 185))

    def _draw_qr_stamp(self, draw, x, y, verification_id: str, dark=(20, 24, 38), light=(245, 245, 245), cell=9):
        size = cell * 13
        draw.rounded_rectangle([x - 12, y - 12, x + size + 12, y + size + 12], radius=14, fill=light, outline=(210, 210, 210), width=2)
        digest = hashlib.sha256(verification_id.encode("utf-8")).digest()
        bits = "".join(f"{b:08b}" for b in digest)
        for row in range(13):
            for col in range(13):
                finder = (row < 4 and col < 4) or (row < 4 and col > 8) or (row > 8 and col < 4)
                if finder or bits[(row * 13 + col) % len(bits)] == "1":
                    draw.rectangle([x + col * cell, y + row * cell, x + (col + 1) * cell - 2, y + (row + 1) * cell - 2], fill=dark)

    def _draw_signature_block(self, draw, x, y, width, verification_id: str, ink=(32, 42, 70), accent=(212, 175, 55)):
        draw.text((x, y), "Electronically signed by", font=self._font(24), fill=(120, 125, 140))
        draw.text((x, y + 38), "EFootball Arena Authority", font=self._font(52, signature=True), fill=ink)
        draw.line([x, y + 105, x + width, y + 105], fill=accent, width=4)
        draw.text((x, y + 118), f"Digital signature ID: {verification_id}", font=self._font(22), fill=(120, 125, 140))
        draw.text((x, y + 148), f"Issued: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", font=self._font(22), fill=(120, 125, 140))

    def _draw_lord_seal(self, draw, cx, cy, verification_id: str):
        gold = (184, 134, 11)
        deep_gold = (117, 75, 18)
        ivory = (255, 247, 224)
        green = (14, 64, 55)

        for i in range(36):
            angle = math.radians(i * 10)
            long_radius = 152 if i % 2 == 0 else 124
            x1 = cx + math.cos(angle) * 94
            y1 = cy + math.sin(angle) * 94
            x2 = cx + math.cos(angle) * long_radius
            y2 = cy + math.sin(angle) * long_radius
            draw.line([x1, y1, x2, y2], fill=(218, 174, 59), width=5)

        draw.ellipse([cx - 118, cy - 118, cx + 118, cy + 118], fill=green, outline=gold, width=8)
        draw.ellipse([cx - 86, cy - 86, cx + 86, cy + 86], fill=ivory, outline=deep_gold, width=5)
        draw.polygon([(cx, cy - 58), (cx + 28, cy - 8), (cx + 82, cy - 2), (cx + 42, cy + 34), (cx + 54, cy + 88), (cx, cy + 60), (cx - 54, cy + 88), (cx - 42, cy + 34), (cx - 82, cy - 2), (cx - 28, cy - 8)], fill=gold)
        draw.text((cx - 53, cy - 17), "LORD", font=self._font(32, bold=True), fill=(45, 32, 16))
        draw.text((cx - 58, cy + 124), verification_id[:6], font=self._font(22, bold=True), fill=deep_gold)

    def _create_base_canvas(self, width=2000, height=1414, color=(255, 255, 255)):
        """Create a white canvas with a gold border."""
        img = Image.new('RGB', (width, height), color)
        draw = ImageDraw.Draw(img)
        
        # Draw a gold border
        border_thickness = 40
        draw.rectangle([border_thickness, border_thickness, width-border_thickness, height-border_thickness], outline=(212, 175, 55), width=20)
        
        # Subtle inner border
        draw.rectangle([border_thickness+20, border_thickness+20, width-border_thickness-20, height-border_thickness-20], outline=(184, 134, 11), width=5)
        
        return img, draw

    def generate_title_pdf(self, username: str, league_name: str) -> bytes:
        """Generate a League Champion badge PDF."""
        img, draw = self._create_base_canvas(color=(10, 10, 30)) # Dark blue for champions
        verification_id = self._verification_id(username, league_name, "champion")
        
        # Load fonts
        title_font = self._font(120, bold=True)
        subtitle_font = self._font(60)
        name_font = self._font(170, bold=True)
        small_font = self._font(28)

        self._draw_platform_logo(img, draw, 160, 120)
        draw.rounded_rectangle([1430, 115, 1835, 220], radius=24, fill=(18, 25, 48), outline=(212, 175, 55), width=3)
        draw.text((1470, 145), f"VERIFIED #{verification_id}", font=small_font, fill=(212, 175, 55))

        self._center_text(draw, "CONGRATULATIONS", 260, subtitle_font, fill=(212, 175, 55))
        self._center_text(draw, "LEAGUE CHAMPION", 360, title_font, fill=(255, 215, 0))
        
        self._center_text(draw, "This official badge is proudly presented to", 575, subtitle_font, fill=(235, 238, 245))
        self._center_text(draw, username.upper(), 675, name_font, fill=(255, 255, 255))
        
        self._center_text(draw, f"For winning {league_name}", 930, subtitle_font, fill=(235, 238, 245))
        self._center_text(draw, datetime.now().strftime("%B %Y"), 1038, subtitle_font, fill=(150, 160, 185))

        self._draw_signature_block(draw, 185, 1125, 620, verification_id, ink=(245, 247, 255))
        self._draw_qr_stamp(draw, 1630, 1090, verification_id, dark=(10, 10, 30), light=(245, 245, 245))
        draw.text((1580, 1242), "Scan / verify certificate", font=self._font(22), fill=(150, 160, 185))

        # Convert to PDF
        pdf_buffer = io.BytesIO()
        img.save(pdf_buffer, format="PDF")
        return pdf_buffer.getvalue()

    def generate_lord_pdf(self, username: str) -> bytes:
        """Generate a Lord of the Arena certificate PDF."""
        img, draw = self._create_base_canvas(color=(252, 247, 235))
        verification_id = self._verification_id(username, "lord")

        gold = (184, 134, 11)
        deep_gold = (117, 75, 18)
        dark = (18, 42, 38)
        ink = (35, 28, 20)
        soft = (244, 231, 198)

        draw.rounded_rectangle([95, 95, 1905, 1319], radius=34, fill=(255, 252, 244), outline=gold, width=6)
        draw.rounded_rectangle([126, 126, 1874, 1288], radius=28, outline=soft, width=4)
        draw.rectangle([126, 126, 1874, 338], fill=dark)
        draw.line([126, 338, 1874, 338], fill=gold, width=8)

        for offset in range(0, 620, 28):
            draw.line([126 + offset, 126, 126, 338 - offset], fill=(30, 70, 63), width=2)
            draw.line([1874 - offset, 126, 1874, 338 - offset], fill=(30, 70, 63), width=2)

        self._draw_platform_logo(img, draw, 170, 156, size=130, accent=gold, text=(255, 248, 226))
        draw.rounded_rectangle([1390, 160, 1810, 244], radius=22, fill=(255, 248, 226), outline=gold, width=3)
        draw.text((1432, 188), f"VERIFIED #{verification_id}", font=self._font(26, bold=True), fill=deep_gold)

        self._center_text(draw, "OFFICIAL HALL OF FAME CERTIFICATE", 175, self._font(42, bold=True), fill=(255, 236, 179))
        self._center_text(draw, "LORD OF THE GAME", 238, self._font(92, bold=True), fill=(255, 255, 255))
        self._center_text(draw, "Awarded for conquering the league series with three championship titles", 360, self._font(34), fill=deep_gold)

        self._draw_lord_seal(draw, 1000, 528, verification_id)
        self._center_text(draw, "This exclusive title is granted to", 700, self._font(42), fill=ink)
        self._center_text_fit(draw, username.upper(), 772, 1480, 155, fill=dark, bold=True, min_size=70)

        draw.rounded_rectangle([330, 980, 1670, 1088], radius=26, fill=(248, 238, 211), outline=(219, 188, 105), width=3)
        self._center_text(draw, "Champion of champions. Three titles. One Lord.", 1007, self._font(48, bold=True), fill=deep_gold)
        self._center_text(draw, f"Certified by EFootball Arena on {datetime.now().strftime('%B %Y')}", 1116, self._font(34), fill=(86, 74, 56))

        self._draw_signature_block(draw, 185, 1165, 620, verification_id, ink=dark, accent=gold)
        self._draw_qr_stamp(draw, 1630, 1140, verification_id, dark=dark, light=(255, 255, 255))
        draw.text((1576, 1292), "Scan / verify certificate", font=self._font(22), fill=(100, 100, 100))

        # PDF output
        pdf_buffer = io.BytesIO()
        img.save(pdf_buffer, format="PDF")
        return pdf_buffer.getvalue()

    def generate_performance_report_pdf(self, username: str, league_name: str, stats: Dict[str, Any], ai_msg: str) -> bytes:
        """Generate a personalized season performance report."""
        pdf = FPDF()
        pdf.add_page()
        
        # Header
        pdf.set_fill_color(10, 10, 30)
        pdf.rect(0, 0, 210, 40, 'F')
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Arial", 'B', 24)
        pdf.cell(0, 20, f"SEASON PERFORMANCE REPORT", ln=True, align='C')
        pdf.set_font("Arial", '', 14)
        pdf.cell(0, 10, f"{league_name} - {username}", ln=True, align='C')
        
        pdf.ln(20)
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(0, 10, "Summary Statistics", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        
        pdf.set_font("Arial", '', 12)
        pdf.cell(50, 10, f"Total Matches: {stats.get('played', 0)}")
        pdf.cell(50, 10, f"Wins: {stats.get('wins', 0)}")
        pdf.cell(50, 10, f"Draws: {stats.get('draws', 0)}")
        pdf.cell(50, 10, f"Losses: {stats.get('losses', 0)}", ln=True)
        
        pdf.cell(50, 10, f"Goals For: {stats.get('gf', 0)}")
        pdf.cell(50, 10, f"Goals Against: {stats.get('ga', 0)}")
        pdf.cell(50, 10, f"Goal Diff: {stats.get('gd', 0)}")
        pdf.cell(50, 10, f"Points: {stats.get('pts', 0)}", ln=True)
        
        pdf.ln(10)
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(0, 10, "AI Analysis & Motivation", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        
        pdf.set_font("Arial", 'I', 12)
        # Sanitize text for latin-1 compatibility
        sanitized_msg = ai_msg.replace('—', '-').replace('’', "'").replace('“', '"').replace('”', '"')
        pdf.multi_cell(0, 8, sanitized_msg)
        
        pdf.ln(10)
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(0, 10, "Top Highlights", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        
        highlights = stats.get('highlights', [])
        pdf.set_font("Arial", '', 12)
        if not highlights:
            pdf.cell(0, 10, "No major highlights recorded yet.", ln=True)
        for h in highlights:
            pdf.cell(0, 8, f"- {h}", ln=True)

        return bytes(pdf.output())
    
    def generate_player_profile_pdf(self, username: str, stats: Dict[str, Any], avatar_url: str = None) -> bytes:
        """Generate a complete player profile report with stats and photo."""
        pdf = FPDF()
        pdf.add_page()
        
        # Header - Modern Dark Theme
        pdf.set_fill_color(10, 10, 30)
        pdf.rect(0, 0, 210, 50, 'F')
        
        # Add Avatar if provided
        if avatar_url:
            try:
                # Handle relative URLs
                if avatar_url.startswith("/uploads/"):
                    # This is tricky if running in container, but usually settings.UPLOAD_DIR is local
                    # For now, let's assume absolute URL or we skip it if it fails
                    pass 
                
                if avatar_url.startswith("http"):
                    resp = requests.get(avatar_url, timeout=5)
                    if resp.status_code == 200:
                        img_data = io.BytesIO(resp.content)
                        pdf.image(img_data, 10, 10, 30, 30)
            except Exception as e:
                print(f"PDF Avatar Error: {e}")

        pdf.set_xy(50, 15)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Arial", 'B', 28)
        pdf.cell(0, 15, f"{username.upper()}", ln=True)
        pdf.set_xy(50, 30)
        pdf.set_font("Arial", '', 14)
        pdf.cell(0, 10, "OFFICIAL ARENA PLAYER CARD", ln=True)
        
        pdf.ln(25)
        pdf.set_text_color(0, 0, 0)
        
        # Summary Row
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(0, 10, "Career Statistics", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        
        # Grid of stats
        pdf.set_font("Arial", 'B', 12)
        col_w = 45
        pdf.cell(col_w, 10, "Matches", border=1, align='C')
        pdf.cell(col_w, 10, "Wins", border=1, align='C')
        pdf.cell(col_w, 10, "Draws", border=1, align='C')
        pdf.cell(col_w, 10, "Losses", border=1, align='C', ln=True)
        
        pdf.set_font("Arial", '', 12)
        pdf.cell(col_w, 10, str(stats.get('total_played', 0)), border=1, align='C')
        pdf.cell(col_w, 10, str(stats.get('total_wins', 0)), border=1, align='C')
        pdf.cell(col_w, 10, str(stats.get('total_draws', 0)), border=1, align='C')
        pdf.cell(col_w, 10, str(stats.get('total_losses', 0)), border=1, align='C', ln=True)
        
        pdf.ln(5)
        
        pdf.set_font("Arial", 'B', 12)
        pdf.cell(col_w, 10, "Goals For", border=1, align='C')
        pdf.cell(col_w, 10, "Goals Ag.", border=1, align='C')
        pdf.cell(col_w, 10, "Goal Diff", border=1, align='C')
        pdf.cell(col_w, 10, "Win Rate", border=1, align='C', ln=True)
        
        pdf.set_font("Arial", '', 12)
        pdf.cell(col_w, 10, str(stats.get('goals_for', 0)), border=1, align='C')
        pdf.cell(col_w, 10, str(stats.get('goals_against', 0)), border=1, align='C')
        pdf.cell(col_w, 10, str(stats.get('goal_difference', 0)), border=1, align='C')
        pdf.cell(col_w, 10, f"{stats.get('win_rate', 0)}%", border=1, align='C', ln=True)
        
        pdf.ln(15)
        
        # Achievements Section
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(0, 10, "Achievements & Honors", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        
        pdf.set_font("Arial", '', 12)
        pdf.cell(0, 10, f"Total Titles Won: {stats.get('total_titles', 0)}", ln=True)
        if stats.get('is_lord'):
            pdf.set_font("Arial", 'B', 12)
            pdf.set_text_color(184, 134, 11)
            pdf.cell(0, 10, "RANK: LORD OF THE GAME", ln=True)
            pdf.set_text_color(0, 0, 0)
        
        pdf.ln(10)
        
        # Footer
        pdf.set_y(-30)
        pdf.set_font("Arial", 'I', 10)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 10, f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - E-Football Arena Official Document", align='C')

        return bytes(pdf.output())

certificate_service = CertificateService()
