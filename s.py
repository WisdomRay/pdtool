# Optimized Flask backend without .env, using inline config
import io
import re
import logging
import traceback
import docx
import fitz
import mammoth
import nltk
import mysql.connector
from flask import Flask, request, jsonify, session, make_response
from flask_cors import CORS, cross_origin
from functools import wraps
from mysql.connector import pooling
from PyPDF2 import PdfReader
from logging.handlers import RotatingFileHandler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from nltk.tokenize import sent_tokenize

# Logging setup
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = RotatingFileHandler('app.log', maxBytes=1000000, backupCount=1)
logger.addHandler(handler)

# MySQL config (hardcoded)
config = {
    'user': 'root',
    'password': '',
    'host': '127.0.0.1',
    'port': 3306,
    'database': 'pdtool',
    'raise_on_warnings': True
}

# Connection pool
try:
    cnx_pool = pooling.MySQLConnectionPool(pool_name="plagiarism_pool", pool_size=5, **config)
    logger.info("Database connection pool created successfully")
except mysql.connector.Error as err:
    logger.error(f"Database connection pool failed: {err}")
    raise

# Ensure NLTK tokenizer is available
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

# Flask app setup
app = Flask(__name__)
app.secret_key = 'supersecret'
CORS(app, supports_credentials=True)

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

def get_connection():
    try:
        return cnx_pool.get_connection()
    except mysql.connector.Error as err:
        logger.error(f"Failed to get connection from pool: {err}")
        raise

def normalize_text(text):
    try:
        return ' '.join(text.lower().split()) if text else ""
    except Exception as e:
        logger.error(f"Normalization error: {e}")
        return ""

def read_file_content(file, file_type):
    try:
        if file_type == 'docx':
            return mammoth.extract_raw_text(io.BytesIO(file.read())).value
        elif file_type == 'pdf':
            pdf_text = ""
            with fitz.open(stream=file.read(), filetype="pdf") as doc:
                for page in doc:
                    pdf_text += page.get_text()
            return pdf_text
        elif file_type == 'txt':
            return file.read().decode('utf-8', errors='replace')
    except Exception as e:
        logger.error(f"Error reading {file_type} file: {e}")
    return ""

def insert_document(file_name, file_type, file_content):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO documents (file_name, file_type, file_content)
            VALUES (%s, %s, %s)
        """, (file_name, file_type, file_content))
        doc_id = cursor.lastrowid
        conn.commit()
        return doc_id
    except mysql.connector.Error as err:
        logger.error(f"Insert error: {err}")
        raise
    finally:
        cursor.close()
        conn.close()

def find_matching_segments(new_text, existing_docs):
    try:
        if not new_text or not existing_docs:
            return []

        # Tokenize new text into sentences and chunks
        sentences = sent_tokenize(new_text)
        chunks = [' '.join(sentences[i:i+3]) for i in range(0, len(sentences), 3)]
        if not chunks:
            chunks = [new_text]

        # Initialize matcher
        vectorizer = TfidfVectorizer(max_features=10000, min_df=1, max_df=0.85)
        matches = []
        
        # Get all existing document texts
        existing_texts = [doc['content'] for doc in existing_docs]

        # Combine new text chunks with existing texts
        all_texts = existing_texts + chunks
        
        # Create TF-IDF matrix
        tfidf = vectorizer.fit_transform(all_texts)
        
        # Calculate cosine similarities
        similarity_matrix = cosine_similarity(tfidf, tfidf)
        
        # Check each chunk against existing documents
        for i in range(len(existing_texts), len(all_texts)):
            for j in range(len(existing_texts)):
                similarity = similarity_matrix[i][j]
                if similarity > 0.3:
                    chunk = chunks[i - len(existing_texts)]
                    matches.append({
                        'text': chunk,
                        'similarity': round(similarity, 4),
                        'source_doc_id': existing_docs[j]['id'],
                        'source_doc_name': existing_docs[j]['file_name']
                    })

        # Sort by highest similarity
        matches = sorted(matches, key=lambda x: x['similarity'], reverse=True)
        
        return matches
    except Exception as e:
        logger.error(f"Matching error: {e}")
        return []

# Authentication middleware
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/admin_login', methods=['POST'])
def admin_login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Missing credentials"}), 400

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM admins WHERE username = %s AND password = %s", (username, password))
        admin = cursor.fetchone()
        cursor.close()
        conn.close()

        if admin:
            session["admin_logged_in"] = True
            return jsonify({"message": "Login successful"}), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401

    except Exception as e:
        logger.error(f"Admin login error: {e}")
        return jsonify({"error": "Server error"}), 500

@app.route('/check_plagiarism', methods=['POST'])
def check_plagiarism():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "Empty file name"}), 400

    file_type = file.filename.split('.')[-1].lower()
    text = read_file_content(file, file_type)
    if not text:
        return jsonify({"error": "Failed to read file"}), 400

    normalized_text = normalize_text(text)
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM documents WHERE file_name = %s", (file.filename,))
        if cursor.fetchone():
            return jsonify({"error": "Document already exists"}), 409

        doc_id = insert_document(file.filename, file_type, normalized_text)

        cursor.execute("SELECT id, file_name, file_content FROM documents WHERE id != %s", (doc_id,))
        existing_docs = [{'id': row[0], 'file_name': row[1], 'content': row[2]} for row in cursor.fetchall()]
        matches = find_matching_segments(normalized_text, existing_docs)

        similarity_score = max((m['similarity'] for m in matches), default=0.0)
        is_plagiarized = similarity_score > 0.5

        return jsonify({
            "similarity_score": similarity_score,
            "plagiarized": is_plagiarized,
            "matching_segments": matches,
            "status": "success" if matches else "only one document"
        })

    except Exception as e:
        logger.error(f"Check failed: {e}")
        return jsonify({"error": "Server error", "details": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# NEW ENDPOINT: Get all documents
@app.route('/documents', methods=['GET'])
@admin_required
def get_documents():
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, file_name, file_type, file_content FROM documents ORDER BY id DESC")
        documents = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(documents)
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        return jsonify({"error": "Failed to fetch documents"}), 500

# NEW ENDPOINT: Upload document
@app.route('/upload_document', methods=['POST'])
@admin_required
def upload_document():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "Empty file name"}), 400

    file_type = file.filename.split('.')[-1].lower()
    if file_type not in ['pdf', 'docx', 'txt']:
        return jsonify({"error": "Unsupported file type"}), 400

    text = read_file_content(file, file_type)
    if not text:
        return jsonify({"error": "Failed to read file"}), 400

    normalized_text = normalize_text(text)
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Check if document already exists
        cursor.execute("SELECT id FROM documents WHERE file_name = %s", (file.filename,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": "Document already exists"}), 409
        
        # Insert new document
        doc_id = insert_document(file.filename, file_type, normalized_text)
        cursor.close()
        conn.close()
        
        return jsonify({
            "message": "Document uploaded successfully",
            "document_id": doc_id
        }), 200
        
    except Exception as e:
        logger.error(f"Upload document error: {e}")
        return jsonify({"error": "Server error"}), 500

# NEW ENDPOINT: Delete document
@app.route('/documents/<int:doc_id>', methods=['DELETE'])
@admin_required
def delete_document(doc_id):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Document deleted successfully"}), 200
    except Exception as e:
        logger.error(f"Delete document error: {e}")
        return jsonify({"error": "Failed to delete document"}), 500

# NEW ENDPOINT: Update document
@app.route('/documents/<int:doc_id>', methods=['PUT'])
@admin_required
def update_document(doc_id):
    data = request.get_json()
    if not data or 'file_content' not in data:
        return jsonify({"error": "Missing file content"}), 400
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE documents SET file_content = %s WHERE id = %s", 
                      (normalize_text(data['file_content']), doc_id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Document updated successfully"}), 200
    except Exception as e:
        logger.error(f"Update document error: {e}")
        return jsonify({"error": "Failed to update document"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
