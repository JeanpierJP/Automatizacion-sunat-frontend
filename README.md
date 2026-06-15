# Proyecto Facturas 📄

Sistema integral de gestión y extracción de datos de pdf de asistencias con inteligencia artificial. Una aplicación web moderna que permite procesar, almacenar y gestionar facturas de forma eficiente.

## Descripción del Proyecto

Este proyecto es una solución completa para automatizar el procesamiento de facturas mediante:

- **Extracción automática de datos** utilizando modelos de IA (Google Gemini)
- **Interfaz intuitiva** construida con React y Vite
- **Backend robusto** con FastAPI
- **Base de datos en la nube** con Supabase
- **Exportación a Excel** para análisis de datos

## Tecnologías Utilizadas

### 🔧 Frontend

- **React 19** - Framework de UI
- **Vite 7.2** - Bundler y servidor de desarrollo
- **Tailwind CSS 3.4** - Framework de estilos
- **Axios 1.13** - Cliente HTTP
- **XLSX 0.18** - Manejo de archivos Excel
- **Lucide React** - Iconografía
- **Heroicons** - Iconos adicionales
- **Sonner** - Sistema de notificaciones/toasts
- **ESLint** - Linting de código
- **PostCSS & Autoprefixer** - Procesamiento de estilos

### 🚀 Backend

- **FastAPI** - Framework web de alto rendimiento
- **Uvicorn** - Servidor ASGI
- **Supabase** - Base de datos PostgreSQL en la nube
- **Google Generative AI** - Extracción de datos con IA
- **Pydantic** - Validación de datos
- **Python-dotenv** - Gestión de variables de entorno

## Estructura del Proyecto

```
Proyecto-facturas/
├── backend/              # API REST y lógica de negocio
│   ├── main.py          # Punto de entrada de FastAPI
│   ├── extractor.py     # Extracción de datos con IA
│   ├── check-models.py  # Validación de modelos
│   └── requirements.txt # Dependencias de Python
└── frontend/            # Aplicación React
    ├── src/
    │   ├── App.jsx      # Componente principal
    │   ├── api.js       # Cliente API
    │   └── assets/      # Recursos estáticos
    ├── package.json     # Dependencias de Node.js
    ├── vite.config.js   # Configuración de Vite
    └── tailwind.config.js # Configuración de Tailwind
```

## Instalación y Uso

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build  # Para producción
```
