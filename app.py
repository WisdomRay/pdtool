from difflib import SequenceMatcher
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from functools import wraps
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import docx
from PyPDF2 import PdfReader
# import mysql.connector
import traceback
import logging
from logging.handlers import RotatingFileHandler
import io
import fitz  # PyMuPDF
import mammoth
import re
import os
from dotenv import load_dotenv
import psycopg2
from psycopg2 import pool

load_dotenv()

app = Flask(__name__)

# 🔑 Use env var for secret key
app.secret_key = os.environ.get("SECRET_KEY", "fallback_secret")

# Setup CORS with frontend origin from env
frontend_origin = os.environ.get("FRONTEND_URL", "http://localhost:5173")
CORS(app, 
    resources={
        r"/documents": {
            "origins": frontend_origin,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        },
        r"/documents/*": {
            "origins": frontend_origin,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    }
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = RotatingFileHandler('app.log', maxBytes=1000000, backupCount=1)
logger.addHandler(handler)

# 🔑 Database config from env
# config = {
#     'user': os.environ.get("DB_USER", "root"),
#     'password': os.environ.get("DB_PASSWORD", ""),
#     'host': os.environ.get("DB_HOST", "127.0.0.1"),
#     'database': os.environ.get("DB_NAME", "pdtool"),
#     'port': int(os.environ.get("DB_PORT", 3306)),
#     'raise_on_warnings': True
# }

# Database connection pool
# db_pool = mysql.connector.pooling.MySQLConnectionPool(
#     pool_name="pdtool_pool",
#     pool_size=5,
#     **config
# )

config = {
    'host': os.environ.get('DB_HOST'),
    'database': os.environ.get('DB_NAME'),
    'user': os.environ.get('DB_USER'),
    'password': os.environ.get('DB_PASSWORD'),
    'port': os.environ.get('DB_PORT', 5432)  # PostgreSQL default port
}

db_pool = psycopg2.pool.SimpleConnectionPool(
    minconn=1,
    maxconn=5,
    **config
)

def get_db_connection():
    return db_pool.get_connection()

def normalize_text(text):
    """Normalize text for comparison by lowercasing and removing special characters"""
    if not text:
        return ""
    text = re.sub(r'[^\w\s]', '', text.lower())
    return ' '.join(text.split())

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {e}")
    return jsonify({"error": "Internal server error"}), 500

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

def read_docx_file(file):
    try:
        doc = docx.Document(file)
        return '\n'.join([p.text for p in doc.paragraphs])
    except Exception as e:
        logger.error(f"Error reading DOCX file: {str(e)}")
        raise

def read_pdf_file(file):
    try:
        reader = PdfReader(file)
        text = ''
        for page in reader.pages:
            text += page.extract_text() or ''
        return text
    except Exception as e:
        logger.error(f"Error reading PDF file: {str(e)}")
        raise

def insert_document(file_name, file_type, file_content):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "INSERT INTO documents (file_name, file_type, file_content) VALUES (%s, %s, %s)"
        cursor.execute(query, (file_name, file_type, file_content))
        conn.commit()
        return cursor.lastrowid
    except mysql.connector.Error as err:
        logger.error(f"Error inserting document into database: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def find_matching_text(query_text, source_text, min_match_length=10):
    """
    Find matching text segments between two documents using SequenceMatcher
    Args:
        query_text: The text to check for plagiarism
        source_text: The reference text to compare against
        min_match_length: Minimum length of matching sequence (in characters)
    Returns:
        List of dicts containing matching segments and their positions
    """
    matcher = SequenceMatcher(None, query_text, source_text)
    matches = []
    
    for match in matcher.get_matching_blocks():
        if match.size >= min_match_length:
            matches.append({
                "text": query_text[match.a:match.a+match.size],
                "source_text": source_text[match.b:match.b+match.size],
                "start_idx": match.a,
                "end_idx": match.a + match.size,
                "similarity": match.size / len(query_text) if query_text else 0
            })
    
    return matches


@app.route('/admin_login', methods=['POST'])
def admin_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT password FROM admins WHERE username = %s", (username,))
        result = cursor.fetchone()
        
        if result and result[0] == password:
            session.permanent = True
            session['admin_logged_in'] = True
            return jsonify({"message": "Login successful"})
        return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Server error"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/documents', methods=['GET'])
@login_required
def get_documents():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, file_name, file_type, file_content FROM documents ORDER BY id DESC")
        documents = cursor.fetchall()
        return jsonify(documents)
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        return jsonify({"error": "Failed to fetch documents"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/documents/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"error": "Document not found"}), 404
        return jsonify({"message": "Document deleted successfully"}), 200
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        return jsonify({"error": "Failed to delete document"}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/check_plagiarism', methods=['POST'])
def check_plagiarism_route():
    try:
        if 'file' not in request.files:
            logger.warning("No file uploaded.")
            return jsonify({"error": "No file part in the request"}), 400

        file = request.files['file']
        if file.filename == '':
            logger.warning("Filename is empty.")
            return jsonify({"error": "No file selected"}), 400

        file_type = file.filename.split('.')[-1].lower()
        logger.info(f"Processing file of type: {file_type}")

        try:
            # File reading logic (keep your existing code)
            if file_type == 'docx':
                docx_bytes = file.read()
                with io.BytesIO(docx_bytes) as docx_io:
                    result = mammoth.extract_raw_text(docx_io)
                    text = result.value
            elif file_type == 'pdf':
                pdf_bytes = file.read()
                with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
                    text = ""
                    for page in doc:
                        text += page.get_text()
            elif file_type == 'txt':
                text = file.read().decode('utf-8')
            else:
                logger.warning("Unsupported file type.")
                return jsonify({"error": "Unsupported file type"}), 400

            logger.info("File read successfully.")
            
            # Normalize the text
            normalized_text = normalize_text(text)

            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Check if document exists
            cursor.execute("SELECT id FROM documents WHERE file_name = %s", (file.filename,))
            if cursor.fetchone():
                logger.warning("Document already exists in database.")
                return jsonify({"error": "Document already exists"}), 409

            # Insert new document (make sure your database schema matches)
            cursor.execute(
                "INSERT INTO documents (file_name, file_type, file_content) VALUES (%s, %s, %s)",
                (file.filename, file_type, normalized_text)
            )
            doc_id = cursor.lastrowid
            conn.commit()

            # Get all documents for comparison
            cursor.execute("SELECT id, file_name, file_content FROM documents WHERE id != %s", (doc_id,))
            existing_docs = cursor.fetchall()

            if not existing_docs:
                logger.info("Only one document available. Skipping comparison.")
                return jsonify({
                    "similarity_score": 0.0,
                    "plagiarized": False,
                    "status": "only one document"
                })

            # Prepare documents for comparison
            corpus = [doc[2] for doc in existing_docs] + [normalized_text]
            vectorizer = TfidfVectorizer().fit_transform(corpus)
            vectors = vectorizer.toarray()
            similarities = cosine_similarity([vectors[-1]], vectors[:-1])[0]

            highest_similarity = float(np.max(similarities)) if similarities.size else 0.0
            is_plagiarized = highest_similarity > 0.5  # Your threshold

            # Find matching segments for all documents with similarity > threshold
            matching_segments = []
            for i, similarity in enumerate(similarities):
                if similarity > 0.3:  # Only consider matches above 30% similarity
                    matches = find_matching_text(
                        normalized_text, 
                        existing_docs[i][2],  # existing document content
                        min_match_length=20    # adjust as needed
                    )
                    for match in matches:
                        matching_segments.append({
                            "similarity": float(similarity),
                            "text": match["text"],
                            "source_text": match["source_text"],
                            "source_doc_name": existing_docs[i][1],  # source filename
                            "start_idx": match["start_idx"],
                            "end_idx": match["end_idx"]
                        })

            return jsonify({
                "similarity_score": highest_similarity,
                "plagiarized": is_plagiarized,
                "matching_segments": matching_segments,
                "status": "success"
            })

        except Exception as file_error:
            logger.error(f"File processing error: {str(file_error)}")
            return jsonify({"error": "Failed to process file", "details": str(file_error)}), 500
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "Server error", "details": str(e)}), 500

# ... [Keep your other routes unchanged] ...

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)