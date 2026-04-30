import io
import os
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
from fpdf import FPDF
from typing import List, Dict, Any
import requests

class CertificateService:
    def __init__(self):
        # On Windows, try to find a nice font
        self.font_path = "C:\\Windows\\Fonts\\arial.ttf"
        if not os.path.exists(self.font_path):
            self.font_path = None # Fallback to default

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
        
        # Load fonts
        try:
            title_font = ImageFont.truetype(self.font_path, 120) if self.font_path else ImageFont.load_default()
            subtitle_font = ImageFont.truetype(self.font_path, 60) if self.font_path else ImageFont.load_default()
            name_font = ImageFont.truetype(self.font_path, 180) if self.font_path else ImageFont.load_default()
        except:
            title_font = subtitle_font = name_font = ImageFont.load_default()

        # Center text helper
        def draw_text_centered(text, y, font, fill=(255, 255, 255)):
            bbox = draw.textbbox((0, 0), text, font=font)
            w = bbox[2] - bbox[0]
            draw.text(((2000 - w) / 2, y), text, font=font, fill=fill)

        draw_text_centered("CONGRATULATIONS", 200, subtitle_font, fill=(212, 175, 55))
        draw_text_centered("LEAGUE CHAMPION", 300, title_font, fill=(255, 215, 0))
        
        draw_text_centered("This badge is proudly presented to", 550, subtitle_font)
        draw_text_centered(username.upper(), 650, name_font, fill=(255, 255, 255))
        
        draw_text_centered(f"For winning the {league_name}", 950, subtitle_font)
        draw_text_centered(datetime.now().strftime("%B %Y"), 1100, subtitle_font, fill=(150, 150, 150))

        # Add a "seal" or "signature"
        draw.ellipse([1600, 1000, 1850, 1250], fill=(212, 175, 55))
        draw.text((1650, 1100), "ARENA", fill=(10, 10, 30), font=subtitle_font)

        # Convert to PDF
        pdf_buffer = io.BytesIO()
        img.save(pdf_buffer, format="PDF")
        return pdf_buffer.getvalue()

    def generate_lord_pdf(self, username: str) -> bytes:
        """Generate a Lord of the Arena certificate PDF."""
        img, draw = self._create_base_canvas(color=(255, 250, 240)) # Cream background
        
        try:
            title_font = ImageFont.truetype(self.font_path, 140) if self.font_path else ImageFont.load_default()
            subtitle_font = ImageFont.truetype(self.font_path, 70) if self.font_path else ImageFont.load_default()
            name_font = ImageFont.truetype(self.font_path, 200) if self.font_path else ImageFont.load_default()
        except:
            title_font = subtitle_font = name_font = ImageFont.load_default()

        def draw_text_centered(text, y, font, fill=(0, 0, 0)):
            bbox = draw.textbbox((0, 0), text, font=font)
            w = bbox[2] - bbox[0]
            draw.text(((2000 - w) / 2, y), text, font=font, fill=fill)

        draw_text_centered("CERTIFICATE OF SUPREMACY", 150, subtitle_font, fill=(184, 134, 11))
        draw_text_centered("LORD OF THE ARENA", 250, title_font, fill=(101, 67, 33))
        
        draw_text_centered("Be it known that", 500, subtitle_font)
        draw_text_centered(username.upper(), 620, name_font, fill=(139, 69, 19))
        
        desc = "Has achieved the legendary status of Lord by winning 3 League Titles."
        draw_text_centered(desc, 900, subtitle_font)
        
        draw_text_centered(f"Issued on {datetime.now().strftime('%d %B %Y')}", 1100, subtitle_font, fill=(100, 100, 100))

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
