"""
-------------------------------------------------------------------
Proyecto: IsoScore - Sistema de Transposición Musical
Autor: Andrea Paola Molina Valero
Institución: SANTIAGO MARIÑO EXTENSIÓN: MARACAIBO
Fecha: Enero 2026
-------------------------------------------------------------------
"""
import os
import re
from dotenv import load_dotenv

load_dotenv()
from flask import Flask, Response, render_template, request, flash, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer
from sqlalchemy import inspect, text

from music21 import converter, exceptions21, metadata, instrument


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'

INSTRUMENT_TRANSPOSITION_MAP = {
    "Partitura Original (Sin cambios)": 0,
    "Flauta / Oboe / Violín": 0,
    "Piano / Guitarra / Voz": 0,
    "Trombón / Tuba / Violonchelo": 0,
    "Trompeta en Sib": 2,
    "Clarinete en Sib": 2,
    "Saxofón Soprano": 2,
    "Saxofón Tenor": 14,
    "Clarinete Bajo": 14,
    "Saxofón Alto": 9,
    "Corno Alto (Eb Horn)": 9,
    "Saxofón Barítono": 21,
    "Clarinete en Mib (Requinto)": -3,
    "Corno Francés (Trompa) en Fa": 7,
    "Corno Inglés": 7,
    "Clarinete en La": -3,
    "Oboe d'Amore": -3,
    "Flauta Alto en Sol": 5
}

INSTRUMENT_FAMILY_MAP = {
    "Partitura Original (Sin cambios)": "General",
    "Flauta / Oboe / Violín": "Madera / Cuerda",
    "Piano / Guitarra / Voz": "Teclado / Cuerda / Voz",
    "Trombón / Tuba / Violonchelo": "Metal / Cuerda",
    "Trompeta en Sib": "Metal",
    "Clarinete en Sib": "Madera",
    "Saxofón Soprano": "Madera",
    "Saxofón Tenor": "Madera",
    "Clarinete Bajo": "Madera",
    "Saxofón Alto": "Madera",
    "Corno Alto (Eb Horn)": "Metal",
    "Saxofón Barítono": "Madera",
    "Clarinete en Mib (Requinto)": "Madera",
    "Corno Francés (Trompa) en Fa": "Metal",
    "Corno Inglés": "Madera",
    "Clarinete en La": "Madera",
    "Oboe d'Amore": "Madera",
    "Flauta Alto en Sol": "Madera"
}

ALLOWED_ORIGINS = {
    os.getenv('FRONTEND_BASE_URL', 'http://localhost:4200')
}
ALLOWED_ORIGIN_PREFIXES = (
    'http://localhost',
    'http://127.0.0.1'
)
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'http://localhost:4200')

app = Flask(__name__)

# --- EMAIL ---
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() in ('1', 'true', 'yes')
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', 'isoscore.am@gmail.com')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = (
    os.getenv('MAIL_DEFAULT_NAME', 'IsoScore Admin'),
    os.getenv('MAIL_DEFAULT_SENDER', os.getenv('MAIL_USERNAME', 'isoscore.am@gmail.com'))
)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'esto-es-super-secreto-cambialo-luego')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL', 'sqlite:///' + os.path.join(BASE_DIR, 'instance', 'isoscore.db')
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False 
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
mail = Mail(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Por favor, inicia sesión para acceder.'
login_manager.login_message_category = 'error'

s = URLSafeTimedSerializer(app.config['SECRET_KEY'])

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, 'instance'), exist_ok=True)


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_blocked = db.Column(db.Boolean, default=False, nullable=False)
    partituras = db.relationship('Partitura', backref='autor', lazy=True)

    @property
    def is_active(self):
        return not self.is_blocked

class Partitura(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre_original = db.Column(db.String(200), nullable=False)
    instrumento_transpuesto = db.Column(db.String(100))
    fecha_subida = db.Column(db.DateTime, default=db.func.current_timestamp())
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

def ensure_database_schema():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()

    if 'user' not in tables:
        return

    user_columns = {column['name'] for column in inspector.get_columns('user')}
    if 'is_blocked' not in user_columns:
        db.session.execute(
            text('ALTER TABLE "user" ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT 0')
        )
        db.session.commit()

@login_manager.unauthorized_handler
def handle_unauthorized():
    if request.path.startswith('/api/'):
        return jsonify({'message': 'Debes iniciar sesión para continuar.'}), 401

    flash(login_manager.login_message, login_manager.login_message_category)
    return redirect(url_for('login'))

@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    if current_user.is_authenticated and getattr(current_user, 'is_blocked', False):
        logout_user()

        if request.path.startswith('/api/'):
            return jsonify({
                'message': 'Tu acceso ha sido restringido por un administrador.'
            }), 403

        flash('Tu acceso ha sido restringido por un administrador.', 'error')
        return redirect(url_for('login'))

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS or any(origin.startswith(prefix) for prefix in ALLOWED_ORIGIN_PREFIXES if origin):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        response.headers['Vary'] = 'Origin'
    return response

def validate_password(password):
    if not password:
        return 'La contraseña es obligatoria.'

    if len(password) < 8:
        return 'La contraseña debe tener al menos 8 caracteres.'

    if not re.search(r"[A-Z]", password):
        return 'La contraseña debe incluir al menos una letra mayúscula.'

    if not re.search(r"[0-9]", password):
        return 'La contraseña debe incluir al menos un número.'

    return None

def build_user_payload(user):
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'is_admin': user.is_admin,
        'is_blocked': user.is_blocked
    }

def process_score_upload(file, instrumento_elegido, user):
    if not file or file.filename == '':
        raise ValueError('No seleccionaste ningún archivo.')

    if instrumento_elegido not in INSTRUMENT_TRANSPOSITION_MAP:
        raise ValueError('Selecciona un instrumento válido.')

    semitonos_a_subir = INSTRUMENT_TRANSPOSITION_MAP[instrumento_elegido]
    base_filename = os.path.splitext(file.filename)[0]
    nombre_seguro = instrumento_elegido.replace(' ', '_').replace('/', '-').replace('\\', '-')
    output_filename = f"{base_filename}_{nombre_seguro}.xml"
    output_filepath = os.path.join(app.config['PROCESSED_FOLDER'], output_filename)

    existe_en_bd = Partitura.query.filter_by(
        nombre_original=file.filename,
        instrumento_transpuesto=instrumento_elegido
    ).first()

    if existe_en_bd and os.path.exists(output_filepath):
        with open(output_filepath, 'r', encoding='utf-8') as processed_file:
            xml_data = processed_file.read()

        return {
            'xml_content': xml_data,
            'instrumento': instrumento_elegido,
            'nombre_archivo': base_filename,
            'download_filename': output_filename
        }

    original_filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(original_filepath)

    score = converter.parse(original_filepath)
    score_transpuesto = score.transpose(semitonos_a_subir)

    for part in score_transpuesto.parts:
        part.partName = instrumento_elegido
        part.partAbbreviation = instrumento_elegido[0:3] + "."

        elementos_instrumento = list(part.recurse().getElementsByClass('Instrument'))
        for antiguo_inst in elementos_instrumento:
            part.remove(antiguo_inst, recurse=True)

        nuevo_inst = instrument.Instrument()
        nuevo_inst.partName = instrumento_elegido
        nuevo_inst.partAbbreviation = instrumento_elegido[0:3] + "."
        nuevo_inst.instrumentName = instrumento_elegido
        part.insert(0.0, nuevo_inst)

    if score_transpuesto.metadata is None:
        score_transpuesto.insert(0, metadata.Metadata())

    score_transpuesto.metadata.arranger = f"Transpuesto por: {user.username}"
    score_transpuesto.metadata.copyright = "Procesado con IsoScore © 2025"

    if score_transpuesto.metadata.title:
        score_transpuesto.metadata.title = f"{score_transpuesto.metadata.title} ({instrumento_elegido})"
    else:
        score_transpuesto.metadata.title = f"Partitura ({instrumento_elegido})"

    score_transpuesto.write('musicxml', fp=output_filepath)

    nueva_partitura = Partitura(
        nombre_original=file.filename,
        instrumento_transpuesto=instrumento_elegido,
        user_id=user.id
    )
    db.session.add(nueva_partitura)
    db.session.commit()

    with open(output_filepath, 'r', encoding='utf-8') as processed_file:
        xml_data = processed_file.read()

    return {
        'xml_content': xml_data,
        'instrumento': instrumento_elegido,
        'nombre_archivo': base_filename,
        'download_filename': output_filename
    }

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not username or not email or not password:
        return jsonify({'message': 'Completa nombre, correo y contraseña.'}), 400

    password_error = validate_password(password)
    if password_error:
        return jsonify({'message': password_error}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Ese nombre de usuario ya existe.'}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'Ese correo ya está registrado.'}), 409

    hashed = bcrypt.generate_password_hash(password).decode('utf-8')
    user = User(username=username, email=email, password_hash=hashed)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message': 'Cuenta creada con éxito. Ya puedes iniciar sesión.',
        'user': build_user_payload(user)
    }), 201

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get('email') or data.get('username') or data.get('identifier') or '').strip().lower()
    password = data.get('password') or ''

    if not identifier or not password:
        return jsonify({'message': 'Correo y contraseña son obligatorios.'}), 400

    user = User.query.filter(
        (User.email == identifier) | (User.username == identifier)
    ).first()

    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({'message': 'Credenciales incorrectas.'}), 401

    if user.is_blocked:
        return jsonify({
            'message': 'Tu acceso ha sido restringido por un administrador.'
        }), 403

    login_user(user)
    return jsonify({
        'message': 'Inicio de sesión exitoso.',
        'user': build_user_payload(user)
    })

@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    logout_user()
    return jsonify({'message': 'Sesión cerrada.'})

@app.route('/api/me', methods=['GET'])
def api_me():
    if not current_user.is_authenticated:
        return jsonify({'message': 'No hay una sesión activa.'}), 401

    return jsonify({'user': build_user_payload(current_user)})

@app.route('/api/admin/dashboard', methods=['GET'])
@login_required
def api_admin_dashboard():
    if not current_user.is_admin:
        return jsonify({'message': 'Acceso denegado.'}), 403

    users = User.query.order_by(User.id.asc()).all()

    return jsonify({
        'total_users': len(users),
        'total_scores': Partitura.query.count(),
        'users': [
            {
                **build_user_payload(user),
                'total_scores': len(user.partituras)
            }
            for user in users
        ]
    })

@app.route('/api/admin/users/<int:user_id>/block', methods=['PATCH'])
@login_required
def api_admin_toggle_user_block(user_id):
    if not current_user.is_admin:
        return jsonify({'message': 'Acceso denegado.'}), 403

    user_to_update = db.session.get(User, user_id)
    if not user_to_update:
        return jsonify({'message': 'Usuario no encontrado.'}), 404

    if user_to_update.id == current_user.id:
        return jsonify({
            'message': 'No puedes restringir tu propia cuenta de administrador.'
        }), 400

    data = request.get_json(silent=True) or {}
    is_blocked = data.get('is_blocked')

    if not isinstance(is_blocked, bool):
        return jsonify({'message': 'El estado de restricción es inválido.'}), 400

    user_to_update.is_blocked = is_blocked
    db.session.commit()

    return jsonify({
        'message': (
            f'El usuario {user_to_update.username} fue restringido.'
            if is_blocked
            else f'El acceso de {user_to_update.username} fue habilitado nuevamente.'
        ),
        'user': {
            **build_user_payload(user_to_update),
            'total_scores': len(user_to_update.partituras)
        }
    })

@app.route('/api/check-username', methods=['POST'])
def api_check_username():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()

    if not username:
        return jsonify({'message': 'Falta username.'}), 400

    user = User.query.filter_by(username=username).first()
    return jsonify({'available': user is None})

@app.route('/api/forgot-password', methods=['POST'])
def api_forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()

    if not email:
        return jsonify({'message': 'Debes ingresar un correo válido.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({
            'message': 'Si el correo existe, recibirás las instrucciones para restablecer tu contraseña.'
        })

    token = s.dumps(email, salt='password-reset-salt')
    reset_url = f'{FRONTEND_BASE_URL}/reset-password/{token}'
    msg = Message(
        'Restablecer Clave',
        recipients=[email],
        body=f'Ingresa aquí para cambiar tu contraseña: {reset_url}'
    )

    try:
        mail.send(msg)
        return jsonify({
            'message': 'Si el correo existe, recibirás las instrucciones para restablecer tu contraseña.'
        })
    except Exception as exc:
        print(f'ERROR MAIL: {exc}')
        return jsonify({
            'message': 'No se pudo enviar el correo de recuperación. Verifica la configuración de correo.'
        }), 500

@app.route('/api/reset-password/<token>/validate', methods=['GET'])
def api_validate_reset_password_token(token):
    try:
        s.loads(token, salt='password-reset-salt', max_age=1800)
        return jsonify({'message': 'Token válido.'})
    except Exception:
        return jsonify({'message': 'El enlace de recuperación es inválido o ha expirado.'}), 400

@app.route('/api/reset-password/<token>', methods=['POST'])
def api_reset_password(token):
    try:
        email = s.loads(token, salt='password-reset-salt', max_age=1800)
    except Exception:
        return jsonify({'message': 'El enlace de recuperación es inválido o ha expirado.'}), 400

    data = request.get_json(silent=True) or {}
    password = data.get('password') or ''

    password_error = validate_password(password)
    if password_error:
        return jsonify({'message': password_error}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'message': 'No se encontró el usuario asociado al enlace.'}), 404

    user.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    db.session.commit()

    return jsonify({'message': 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.'})

@app.route('/api/instruments', methods=['GET'])
def api_instruments():
    instruments = [
        {
            'nombre': instrument_name,
            'familia': INSTRUMENT_FAMILY_MAP.get(instrument_name, 'General')
        }
        for instrument_name in INSTRUMENT_TRANSPOSITION_MAP.keys()
    ]
    return jsonify({'instruments': instruments})

@app.route('/api/upload', methods=['POST'])
@login_required
def api_upload():
    file = request.files.get('archivo_partitura')
    instrumento_elegido = request.form.get('instrumento')

    try:
        payload = process_score_upload(file, instrumento_elegido, current_user)
        return jsonify({
            'instrumento': payload['instrumento'],
            'nombre_archivo': payload['nombre_archivo'],
            'download_filename': payload['download_filename']
        })
    except ValueError as exc:
        return jsonify({'message': str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        print(f"ERROR FATAL API: {exc}")
        return jsonify({'message': f'Error al procesar: {exc}'}), 500

@app.route('/api/processed/<path:filename>', methods=['GET'])
@login_required
def api_processed_file(filename):
    file_path = os.path.join(app.config['PROCESSED_FOLDER'], filename)

    if not os.path.exists(file_path):
        return jsonify({'message': 'No se encontró la partitura procesada.'}), 404

    with open(file_path, 'r', encoding='utf-8') as processed_file:
        xml_data = processed_file.read()

    return Response(xml_data, mimetype='application/vnd.recordare.musicxml+xml')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')

        password_error = validate_password(password)
        if password_error:
            flash(password_error, 'error')
            return redirect(url_for('register'))

        if User.query.filter_by(username=username).first():
            flash('Usuario ya existe.', 'error')
            return redirect(url_for('register'))
            
        if User.query.filter_by(email=email).first():
            flash('Este correo ya está registrado.', 'error')
            return redirect(url_for('register'))

        hashed = bcrypt.generate_password_hash(password).decode('utf-8')
        user = User(username=username, email=email, password_hash=hashed)
        db.session.add(user)
        db.session.commit()
        
        flash('Cuenta creada con éxito. Inicia sesión.', 'success')
        return redirect(url_for('login'))
        
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard')) 

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()

        if user and bcrypt.check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('dashboard'))
        else:
            flash('Credenciales incorrectas.', 'error')
    return render_template('login.html')

@app.route('/logout')
def logout():
    logout_user()
    flash('Sesión cerrada.', 'success')
    return redirect(url_for('login'))

@app.route("/")
def landing_page():
    if current_user.is_authenticated:
        return redirect('http://localhost:4200/transposer')
    return redirect('http://localhost:4200/')

@app.route("/dashboard")
@login_required
def dashboard():
    total_usuarios = User.query.count()
    try:
        total_partituras = Partitura.query.count()
    except:
        total_partituras = 0
    return render_template('home.html', total_users=total_usuarios, total_scores=total_partituras)

@app.route("/transponer")
@login_required
def herramienta():
    instrumentos = list(INSTRUMENT_TRANSPOSITION_MAP.keys())
    return render_template('index.html', instrumentos=instrumentos)


@app.route('/upload', methods=['POST'])
@login_required
def procesar_partitura():
    file = request.files.get('archivo_partitura')
    instrumento_elegido = request.form.get('instrumento')

    try:
        payload = process_score_upload(file, instrumento_elegido, current_user)
        return render_template(
            'result.html',
            xml_content=payload['xml_content'],
            instrumento=payload['instrumento'],
            nombre_archivo=payload['nombre_archivo']
        )
    except ValueError as exc:
        flash(str(exc), 'error')
        return redirect(url_for('herramienta'))
    except Exception as exc:
        db.session.rollback()
        print(f"ERROR FATAL: {exc}")
        flash(f'Error al procesar: {exc}', 'error')
        return redirect(url_for('herramienta'))


@app.route('/check-username', methods=['POST'])
def check_username():
    data = request.get_json()
    username = data.get('username')
    if not username: return jsonify({'error': 'Falta username'}), 400
    user = User.query.filter_by(username=username).first()
    return jsonify({'available': user is None})

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'GET':
        return redirect(f'{FRONTEND_BASE_URL}/forgot-password')

    if request.method == 'POST':
        email = request.form.get('email')
        user = User.query.filter_by(email=email).first()
        if user:
            token = s.dumps(email, salt='password-reset-salt')
            reset_url = f'{FRONTEND_BASE_URL}/reset-password/{token}'
            msg = Message('Restablecer Clave', recipients=[email], body=f'Link: {reset_url}')
            try:
                mail.send(msg)
                flash('Correo enviado.', 'success')
            except Exception as e:
                flash(f'Error: {e}', 'error')
            return redirect(url_for('login'))
        flash('Correo no encontrado.', 'error')
    return redirect(f'{FRONTEND_BASE_URL}/forgot-password')

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    return redirect(f'{FRONTEND_BASE_URL}/reset-password/{token}')

@app.route('/admin')
@login_required
def admin_dashboard():
    if not current_user.is_admin:
        flash('Acceso denegado.', 'error')
        return redirect(url_for('dashboard'))

    users = User.query.all()
    total_usuarios = len(users)

    try:
        total_partituras = Partitura.query.count()
    except:
        total_partituras = 0

    return render_template('admin.html', 
                           users=users, 
                           total_users=total_usuarios, 
                           total_scores=total_partituras)

@app.route('/admin/user/delete/<int:user_id>')
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        flash('¡Acceso denegado! No tienes permiso para esto.', 'error')
        return redirect(url_for('dashboard'))

    if user_id == current_user.id:
        flash('No puedes eliminar tu propia cuenta de administrador.', 'error')
        return redirect(url_for('admin_dashboard'))

    user_to_delete = db.session.get(User, user_id)

    if user_to_delete:
        try:
            db.session.delete(user_to_delete)
            db.session.commit()
            flash(f'El usuario {user_to_delete.username} ha sido eliminado/desactivado.', 'success')
        except Exception as e:
            db.session.rollback()
            flash('Error al intentar eliminar.', 'error')
    else:
        flash('Usuario no encontrado.', 'error')

    return redirect(url_for('admin_dashboard'))

@app.route('/admin/user/edit/<int:user_id>', methods=['GET', 'POST'])
@login_required
def edit_user(user_id):
    if not current_user.is_admin:
        flash('Acceso denegado.', 'error')
        return redirect(url_for('dashboard'))
    
    user_to_edit = db.session.get(User, user_id)
    if not user_to_edit:
        flash('Usuario no encontrado.', 'error')
        return redirect(url_for('admin_dashboard'))

    if request.method == 'POST':
        try:
            user_to_edit.username = request.form.get('username')
            user_to_edit.email = request.form.get('email')

            es_admin = request.form.get('is_admin') == 'on'
            
            if user_to_edit.id == current_user.id and not es_admin:
                flash('¡Cuidado! No puedes quitarte el rol de Admin a ti mismo.', 'error')
                es_admin = True

            user_to_edit.is_admin = es_admin
            
            db.session.commit()
            flash(f'Usuario {user_to_edit.username} actualizado correctamente.', 'success')
            return redirect(url_for('admin_dashboard'))
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error al actualizar: {e}', 'error')

    return render_template('edit_user.html', user=user_to_edit)

with app.app_context():
    db.create_all()
    ensure_database_schema()

if __name__ == "__main__":
    app.run(debug=True)
