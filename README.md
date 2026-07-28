# tesis-finaldefensa

Repositorio con frontend (Angular) y backend (Flask) para el proyecto `tesis-finaldefensa`.

## Estructura

- `app-tesis/` — código del frontend y backend (Angular + Flask).

## Ejecutar el backend (Flask)

1. Crear y activar un entorno virtual:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Instalar dependencias:

```bash
pip install -r app-tesis/requirements.txt
```

3. Iniciar la aplicación (desde la raíz del repo o dentro de `app-tesis`):

```bash
cd app-tesis
export FLASK_APP=app.py
export FLASK_ENV=development
flask run --host=0.0.0.0 --port=5000
```

El backend quedará disponible en `http://localhost:5000`.

> Nota: revisa y actualiza en `app-tesis/app.py` cualquier configuración sensible (correo, SECRET_KEY) antes de usar en producción.

## Ejecutar el frontend (Angular)

1. Instalar dependencias (desde `app-tesis`):

```bash
cd app-tesis
npm install
```

2. Ejecutar servidor de desarrollo:

```bash
npm start
```

El frontend correrá por defecto en `http://localhost:4200`.

## Otras notas

- Ya subí el contenido del proyecto al remoto `origin` (https://github.com/andreaPmlv/Tesis-final-defensa.git).
- Si quieres que configure un `.env` para separar credenciales, puedo crearlo y añadir instrucciones.
