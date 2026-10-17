import sys
import os

# Add root project directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

# Expose WSGI app for Vercel Serverless
app.debug = False
